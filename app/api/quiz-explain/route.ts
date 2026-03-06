import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { complete } from '@/lib/openai-ai';
import { verifyAuth } from '@/lib/api-auth';

const log = logger.child('QuizExplainer');

async function callAI(prompt: string): Promise<string | null> {
  try {
    return await complete(prompt);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAuth(request);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { question, userAnswer, correctAnswer, topic, allOptions } = await request.json();
    log.info('Explaining quiz answer', { topic, correct: userAnswer === correctAnswer });

    const prompt = `You are Guardian AI Tutor at NTU Singapore. A student got this question wrong:

TOPIC: ${topic}
QUESTION: ${question}
OPTIONS: ${(allOptions || []).join(' | ')}
STUDENT CHOSE: ${userAnswer}
CORRECT ANSWER: ${correctAnswer}

Explain in a supportive, educational way. Respond ONLY with valid JSON (no backticks):
{
  "whyWrong": "2 sentences explaining why their answer is incorrect — be specific about the misconception",
  "whyCorrect": "2-3 sentences explaining why the correct answer is right — include a simple example if helpful",
  "concept": "The key concept name they need to review",
  "quickTip": "One memorable trick or mnemonic to remember this",
  "similarMistake": "A common related mistake to watch out for",
  "confidenceBoost": "One encouraging sentence"
}`;

    const aiResponse = await callAI(prompt);
    let result;
    if (aiResponse) {
      try { result = JSON.parse(aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch {}
    }

    if (!result) {
      result = {
        whyWrong: `"${userAnswer}" is incorrect because it doesn't match what ${topic} requires in this context. Review the fundamentals to understand why.`,
        whyCorrect: `The correct answer is "${correctAnswer}". This follows from the core rules of ${topic}.`,
        concept: topic,
        quickTip: `When in doubt about ${topic}, trace through the logic step by step on paper.`,
        similarMistake: `Students often confuse similar-looking concepts in ${topic}. Pay attention to the details.`,
        confidenceBoost: `Making mistakes is how you learn — the fact that you're reviewing this shows real dedication!`,
      };
    }

    return NextResponse.json({ ...result, topic, question, userAnswer, correctAnswer, timestamp: new Date().toISOString() });
  } catch (error: any) {
    log.error('Quiz explain error', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
