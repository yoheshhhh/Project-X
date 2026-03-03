import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const log = logger.child('FlashcardGenerator');

async function callGemini(prompt: string) {
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter(Boolean);
  for (let attempt = 0; attempt < keys.length * 2; attempt++) {
    const apiKey = keys[attempt % keys.length];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2000, temperature: 0.7 } }) });
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
    const { topic, score, context } = await request.json();
    log.info('Generating flashcards', { topic, score });

    const prompt = `You are an expert CS tutor at NTU Singapore. Generate exactly 6 flashcards for a student struggling with "${topic}" (current score: ${score}%).
${context ? `Student context: ${context}` : ''}

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

    const aiResponse = await callGemini(prompt);
    let result;
    if (aiResponse) {
      try { result = JSON.parse(aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch {}
    }

    if (!result) {
      result = {
        cards: [
          { front: `What is the core concept behind ${topic}?`, back: `${topic} is a fundamental programming concept that you need to understand step by step.`, difficulty: 'easy', hint: 'Think about the basics first' },
          { front: `Write a simple example of ${topic} in Python`, back: `# Example code for ${topic}\n# Practice writing this from memory`, difficulty: 'medium', hint: 'Start with the syntax' },
          { front: `What common mistakes do students make with ${topic}?`, back: `Common mistakes include: incorrect syntax, wrong logic flow, and forgetting edge cases.`, difficulty: 'medium', hint: 'Think about what went wrong in your quizzes' },
          { front: `How does ${topic} relate to other concepts you've learned?`, back: `${topic} builds on previous concepts and is used in more advanced topics.`, difficulty: 'medium', hint: 'Connect it to what you already know' },
          { front: `What is an edge case in ${topic}?`, back: `Edge cases are unusual inputs or conditions that can cause unexpected behavior.`, difficulty: 'hard', hint: 'Think about boundary values' },
          { front: `Can you solve a problem using ${topic} without looking at notes?`, back: `Try to solve a practice problem from scratch to test your understanding.`, difficulty: 'hard', hint: 'If you can teach it, you know it' },
        ],
        studyTip: `Review these flashcards daily using spaced repetition — quiz yourself after 1 day, 3 days, and 7 days.`,
      };
    }

    return NextResponse.json({ topic, score, ...result, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    log.error('Flashcard generation error', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
