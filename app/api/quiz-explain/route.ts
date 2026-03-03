import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const log = logger.child('QuizExplainer');

async function callGemini(prompt: string) {
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter(Boolean);
  for (let attempt = 0; attempt < keys.length * 2; attempt++) {
    const apiKey = keys[attempt % keys.length];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1500, temperature: 0.7 } }) });
      if (res.status === 429) { await new Promise(r => setTimeout(r, 1500)); continue; }
      if (!res.ok) continue;
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch { continue; }
  }
  return null;
}

export async function POST(request: Request) {
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

    const aiResponse = await callGemini(prompt);
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
