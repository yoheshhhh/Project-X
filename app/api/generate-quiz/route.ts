import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { generateSegmentQuizQuestions } from '@/lib/openai-ai';
import { logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/api-auth';

const log = logger.child('API:GenerateQuiz');

type CachedQuiz = { id: string; question: string; options: string[]; correctIndex: number }[];

declare global {
  // eslint-disable-next-line no-var
  var __quizCache: Map<string, { data: CachedQuiz; ts: number }> | undefined;
}

const quizCache = globalThis.__quizCache ?? (globalThis.__quizCache = new Map());
const TTL_MS = 1000 * 60 * 60 * 24; // 24h

function hashText(s: string): string {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
}

/** Load pre-generated quiz for a segment (used when Gemini returns 429). */
async function loadFallback(segmentIndex: number): Promise<CachedQuiz> {
  const file = path.join(process.cwd(), 'data', 'quizzes', `segment-${segmentIndex}.json`);
  const raw = await fs.readFile(file, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid fallback quiz');
  return parsed.map((q: any, i: number) => ({
    id: q.id ?? `s${segmentIndex}-q${i + 1}`,
    question: q.question ?? '',
    options: Array.isArray(q.options) ? q.options.slice(0, 4) : [],
    correctIndex: typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < 4 ? q.correctIndex : 0,
  }));
}

/**
 * POST /api/generate-quiz
 * Generate AI quiz questions by reading the segment's slides document.
 * Body: { segmentIndex: number, segmentSlides: string }
 * Returns: { questions: QuizQuestion[], cached?: boolean }
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let segmentIndex = 0;
  try {
    const body = await request.json();
    const idx = body.segmentIndex;
    const segmentSlides = body.segmentSlides;
    if (typeof idx !== 'number' || idx < 0) {
      return NextResponse.json({ error: 'Invalid segmentIndex' }, { status: 400 });
    }
    segmentIndex = idx;
    const slides = typeof segmentSlides === 'string' ? segmentSlides.trim() : '';
    if (!slides.length) {
      return NextResponse.json({ error: 'Missing or empty segmentSlides (slides document for this segment)' }, { status: 400 });
    }

    const key = `${segmentIndex}:${hashText(slides)}`;
    const cached = quizCache.get(key);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      log.info('Quiz cache hit', { segmentIndex });
      return NextResponse.json({ questions: cached.data, cached: true });
    }

    log.info('Quiz generation requested from slides', { segmentIndex });
    const questions = await generateSegmentQuizQuestions(segmentIndex, slides);
    quizCache.set(key, { data: questions, ts: Date.now() });

    return NextResponse.json({ questions, cached: false });
  } catch (error: any) {
    const message = error?.message ?? 'Failed to generate quiz questions';
    log.error('Quiz generation failed', { error: message });
    const isConfig = typeof message === 'string' && (
      message.includes('not configured') ||
      message.includes('GEMINI') ||
      message.includes('API_KEY')
    );
    // On 429: serve fallback quiz so UI loads instantly without failing
    if (typeof message === 'string' && message.toLowerCase().includes('rate limit')) {
      try {
        const fallback = await loadFallback(segmentIndex);
        log.info('Serving fallback quiz after rate limit', { segmentIndex });
        return NextResponse.json({ questions: fallback, fallback: true });
      } catch (fallbackErr) {
        log.warn('Fallback quiz missing or invalid', { segmentIndex });
        return NextResponse.json({ error: message }, { status: 429 });
      }
    }
    return NextResponse.json(
      { error: message },
      { status: isConfig ? 503 : 500 }
    );
  }
}
