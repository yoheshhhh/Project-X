import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { logger } from '@/lib/logger';
import { complete } from '@/lib/openai-ai';
import { verifyAuth } from '@/lib/api-auth';

const log = logger.child('FlashcardGenerator');

type Card = { front: string; back: string; difficulty: string; hint?: string };

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_2;
  if (!key) throw new Error('OpenAI is not configured: set OPENAI_API_KEY in .env.local');
  return new OpenAI({ apiKey: key });
}

/** Checker: validate flashcard set quality. Defaults to PASS if parse fails so we never block the user. */
async function checkFlashcards(
  openai: OpenAI,
  cards: Card[],
  topic: string,
  score: number
): Promise<{ pass: boolean; reason: string }> {
  const sample = cards.slice(0, 3).map((c, i) => `Card ${i + 1}: Front: ${c.front} | Back: ${c.back} | Difficulty: ${c.difficulty}`).join('\n');
  const checkerPrompt = `You are a strict flashcard quality checker.

Evaluate this set of flashcards for a student studying "${topic}" (current score: ${score}%).

${sample}
${cards.length > 3 ? `(... and ${cards.length - 3} more cards in the set)` : ''}

Check:
1. Are they factually correct?
2. Do they test understanding, not just memorization?
3. Is the difficulty appropriate for a struggling student?

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

/** Maker: generate 6 flashcards. Optional feedback used when checker fails and we regenerate once. */
async function generateFlashcards(
  topic: string,
  score: number,
  context: string | undefined,
  feedback?: string
): Promise<{ cards: Card[]; studyTip: string }> {
  const prompt = `You are an expert CS tutor at NTU Singapore. Generate exactly 6 flashcards for a student struggling with "${topic}" (current score: ${score}%).
${context ? `Student context: ${context}` : ''}
${feedback ? `\nNote: Previous attempt was rejected because: ${feedback}. Improve accordingly.` : ''}

The flashcards should:
- Start from fundamental concepts and build up
- Use simple, clear language
- Include code examples where relevant (use Python)
- Target the specific gaps that would cause a ${score}% score
- Include 1-2 tricky edge cases students commonly miss

Respond ONLY with valid JSON (no backticks):
{
  "cards": [
    { "front": "Question or concept prompt", "back": "Clear answer or explanation", "difficulty": "easy|medium|hard", "hint": "Optional hint to help recall" }
  ],
  "studyTip": "One sentence tip for mastering this topic"
}`;

  try {
    const aiResponse = await complete(prompt, { maxTokens: 2000 });
    if (aiResponse) {
      const parsed = JSON.parse(aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as { cards?: Card[]; studyTip?: string };
      if (Array.isArray(parsed.cards) && parsed.cards.length >= 1) {
        return {
          cards: parsed.cards.slice(0, 6),
          studyTip: typeof parsed.studyTip === 'string' ? parsed.studyTip : 'Review these cards using spaced repetition.',
        };
      }
    }
  } catch {
    // fall through to fallback
  }

  return {
    cards: [
      { front: `What is the core concept behind ${topic}?`, back: `${topic} is a fundamental programming concept that you need to understand step by step.`, difficulty: 'easy', hint: 'Think about the basics first' },
      { front: `Write a simple example of ${topic} in Python`, back: `# Example code for ${topic}\n# Practice writing this from memory`, difficulty: 'medium', hint: 'Start with the syntax' },
      { front: `What common mistakes do students make with ${topic}?`, back: `Common mistakes include: incorrect syntax, wrong logic flow, and forgetting edge cases.`, difficulty: 'medium', hint: 'Think about what went wrong in your quizzes' },
      { front: `How does ${topic} relate to other concepts you've learned?`, back: `${topic} builds on previous concepts and is used in more advanced topics.`, difficulty: 'medium', hint: 'Connect it to what you already know' },
      { front: `What is an edge case in ${topic}?`, back: `Edge cases are unusual inputs or conditions that can cause unexpected behavior.`, difficulty: 'hard', hint: 'Think about boundary values' },
      { front: `Can you solve a problem using ${topic} without looking at notes?`, back: `Try to solve a practice problem from scratch to test your understanding.`, difficulty: 'hard', hint: 'If you can teach it, you know it' },
    ],
    studyTip: 'Review these flashcards daily using spaced repetition — quiz yourself after 1 day, 3 days, and 7 days.',
  };
}

export async function POST(request: Request) {
  const authResult = await verifyAuth(request);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { topic, score, context } = await request.json();
    log.info('Generating flashcards', { topic, score });

    // --- MAKER: generate flashcards ---
    let result = await generateFlashcards(topic, score ?? 0, context);

    // --- CHECKER: validate (only if we have OpenAI client for checker) ---
    try {
      const openai = getOpenAI();
      const check = await checkFlashcards(openai, result.cards, topic, score ?? 0);
      if (!check.pass) {
        log.info('Checker rejected flashcards, regenerating once', { reason: check.reason });
        result = await generateFlashcards(topic, score ?? 0, context, check.reason);
      }
    } catch {
      // No API key or checker error: skip checker, use maker result as-is
    }

    return NextResponse.json({ topic, score, cards: result.cards, studyTip: result.studyTip, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    log.error('Flashcard generation error', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
