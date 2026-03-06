import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { generateSegmentFlashcards, generateFlashcardsForSegmentByTopic } from '@/lib/openai-ai';
import { logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/api-auth';

const log = logger.child('API:GenerateSegmentFlashcards');

const CACHE_FILE = path.join(process.cwd(), '.cache', 'flashcards.json');

function readCache(): Record<string, Array<{ front: string; back: string }>> {
  try {
    if (!fs.existsSync(CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeCache(data: Record<string, Array<{ front: string; back: string }>>) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_2;
  if (!key) throw new Error('OpenAI is not configured: set OPENAI_API_KEY in .env.local');
  return new OpenAI({ apiKey: key });
}

/** Checker: validate segment flashcard set. Defaults to PASS if parse fails so we never block the user. */
async function checkSegmentFlashcards(
  openai: OpenAI,
  flashcards: Array<{ front: string; back: string }>,
  topic: string,
  segmentIndex: number
): Promise<{ pass: boolean; reason: string }> {
  const sample = flashcards.slice(0, 3).map((c, i) => `Card ${i + 1}: Front: ${c.front} | Back: ${c.back}`).join('\n');
  const checkerPrompt = `You are a strict flashcard quality checker.

Evaluate this set of flashcards for a student reviewing segment ${segmentIndex + 1}${topic ? ` of a course on "${topic}"` : ''}.

${sample}
${flashcards.length > 3 ? `(... and ${flashcards.length - 3} more cards in the set)` : ''}

Check:
1. Are they factually correct and aligned with the segment material?
2. Do they test understanding, not just memorization?
3. Are they clear and useful for a struggling student?

Reply in this exact JSON format only:
{ "result": "PASS" or "FAIL", "reason": "one sentence explanation" }`;

  try {
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: checkerPrompt }],
      max_tokens: 100,
      temperature: 0.3,
    });
    const text = res.choices[0]?.message?.content?.trim() ?? '';
    const parsed = JSON.parse(text) as { result?: string; reason?: string };
    return { pass: parsed.result === 'PASS', reason: parsed.reason ?? 'No reason given' };
  } catch {
    return { pass: true, reason: 'Checker could not parse — defaulting to pass' };
  }
}

/**
 * POST /api/generate-segment-flashcards
 * Generate AI flashcards (from slides when available, otherwise from topic). Maker-checker: validate then optional one retry with feedback.
 * Body: { segmentIndex: number, segmentSlides?: string, topic?: string, count?: number }
 * Returns: { flashcards: { front: string, back: string }[] }
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let segmentIndex = 0;
  try {
    const body = await request.json();
    segmentIndex = body.segmentIndex;
    const slides = typeof body.segmentSlides === 'string' ? body.segmentSlides.trim() : '';
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    const count = typeof body.count === 'number' && body.count > 0 ? Math.min(body.count, 10) : 6;

    if (typeof segmentIndex !== 'number' || segmentIndex < 0)
      return NextResponse.json({ error: 'Invalid segmentIndex' }, { status: 400 });

    const cache = readCache();
    const cacheKey = slides.length ? `segment-${segmentIndex}` : `segment-${segmentIndex}-topic-${topic || 'unknown'}`;

    if (cache[cacheKey]) {
      log.info('Returning cached flashcards', { segmentIndex });
      return NextResponse.json({ flashcards: cache[cacheKey] });
    }

    let flashcards: Array<{ front: string; back: string }>;

    if (slides.length > 0) {
      log.info('Segment flashcards requested from slides', { segmentIndex });
      flashcards = await generateSegmentFlashcards(segmentIndex, slides, count);
    } else if (topic.length > 0) {
      log.info('Segment flashcards requested from topic (no slides)', { segmentIndex, topic });
      flashcards = await generateFlashcardsForSegmentByTopic(segmentIndex, topic, count);
    } else {
      return NextResponse.json(
        { error: 'Provide segmentSlides or topic to generate flashcards.' },
        { status: 400 }
      );
    }

    // --- CHECKER: validate (skip if no OpenAI key) ---
    try {
      const openai = getOpenAI();
      const check = await checkSegmentFlashcards(openai, flashcards, topic, segmentIndex);
      if (!check.pass) {
        log.info('Checker rejected segment flashcards, regenerating once', { segmentIndex, reason: check.reason });
        if (slides.length > 0) {
          flashcards = await generateSegmentFlashcards(segmentIndex, slides, count, check.reason);
        } else {
          flashcards = await generateFlashcardsForSegmentByTopic(segmentIndex, topic, count, check.reason);
        }
      }
    } catch {
      // No API key or checker error: use maker result as-is
    }

    cache[cacheKey] = flashcards;
    writeCache(cache);

    return NextResponse.json({ flashcards });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate flashcards';
    log.error('Segment flashcards generation failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
