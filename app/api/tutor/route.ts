import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const log = logger.child('API:AITutor');

// ─────────────────────────────────────────────────────────────────────────────
// Guardian AI Tutor — /api/tutor
// 1:1 port of Pranati's ai_engine.py (dashboard_final.zip)
// Same prompt, same data extraction, same model (gemini-2.5-flash)
// ─────────────────────────────────────────────────────────────────────────────

/* ── analyze_performance (exact copy of Pranati's Python function) ───── */

function analyzePerformance(history: number[]): { prediction: number | null; status: string } {
  if (!history || history.length < 2) {
    return { prediction: null, status: 'Not enough data' };
  }

  // Linear regression (same as Pranati's sklearn LinearRegression)
  const n = history.length;
  const xMean = (n - 1) / 2;
  const yMean = history.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (history[i] - yMean);
    den += (i - xMean) ** 2;
  }

  const slope = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;
  const prediction = Math.round((slope * n + intercept) * 10) / 10;

  let status = 'Stable';
  if (slope < 0) status = 'Burnout Risk';
  else if (slope > 2) status = 'Accelerated Growth';

  return { prediction, status };
}

/* ── get_student_data (Firestore → JSON fallback) ─────────────────────── */

async function getStudentData(studentId = 'student_1'): Promise<Record<string, any> | null> {
  // Try Firestore first (same as Pranati's db.collection("students").document(student_id))
  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    if (adminDb) {
      const doc = await (adminDb as any).collection('students').doc(studentId).get();
      if (doc.exists) {
        log.info('Student data from Firestore');
        return doc.data();
      }
    }
  } catch (err: any) {
    log.debug('Firestore unavailable', { reason: err.message });
  }

  // Fallback: local JSON (Pranati's student_data.json)
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const raw = await fs.readFile(path.join(process.cwd(), 'data', 'student_data.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed?.students?.[studentId]) {
      log.info('Student data from local JSON');
      return parsed.students[studentId];
    }
  } catch (err: any) {
    log.error('Local JSON failed too', { error: err.message });
  }

  return null;
}

/* ── callGemini ───────────────────────────────────────────────────────── */

async function callGemini(prompt: string): Promise<string | null> {
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter(Boolean) as string[];

  if (keys.length === 0) {
    log.error('No GEMINI_API_KEY in environment');
    return null;
  }

  for (let attempt = 0; attempt < keys.length * 2; attempt++) {
    const apiKey = keys[attempt % keys.length];
    // Same model as Pranati: gemini-2.5-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    try {
      log.debug('Gemini attempt', { attempt: attempt + 1 });

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // No maxOutputTokens constraint — let Gemini give full response like Pranati's
        }),
      });

      if (res.status === 429) {
        log.warn('Rate limited', { attempt: attempt + 1 });
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        log.error('Gemini error', { status: res.status, body: errText.slice(0, 200) });
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (text) {
        log.info('Gemini OK', { length: text.length });
        return text;
      }

      log.warn('Empty Gemini response');
    } catch (err: any) {
      log.error('Gemini exception', { error: err.message });
      continue;
    }
  }

  return null;
}

/* ── POST /api/tutor — exact mirror of Pranati's get_ai_tutor_advice ── */

export async function POST(request: Request) {
  try {
    const { question } = await request.json();
    if (!question) {
      return NextResponse.json({ answer: 'Please ask a question!' }, { status: 400 });
    }

    log.info('Tutor query', { question: question.slice(0, 80) });

    // ── Step 1: get_student_data (same as Pranati) ──
    const studentData = await getStudentData('student_1');
    if (!studentData) {
      return NextResponse.json({ answer: 'No module data found for student.' });
    }

    // ── Step 2: Extract data EXACTLY like Pranati's code ──
    // topics = student_data.get("moduleData", {})
    const topics: Record<string, any> = studentData.moduleData || {};

    // recommended_seq = student_data.get("predictions", {}).get("recommendedSequenceOfTopics", [])
    const recommendedSeq: string[] = studentData.predictions?.recommendedSequenceOfTopics || [];

    // history = student_data.get("history", {})
    const history: Record<string, number> = studentData.history || {};

    // dna = student_data.get("dna", {})
    const dna: Record<string, any> = studentData.dna || {};

    // memory_retention = {t: topics[t].get('memoryRetentionRate') for t in topics}
    const memoryRetention: Record<string, number> = {};
    for (const t of Object.keys(topics)) {
      memoryRetention[t] = topics[t].memoryRetentionRate;
    }

    // mistakes = {t: topics[t].get('mistakesMade') for t in topics}
    const mistakes: Record<string, number> = {};
    for (const t of Object.keys(topics)) {
      mistakes[t] = topics[t].mistakesMade;
    }

    // confidence = {t: topics[t].get('confidence') for t in topics}
    const confidence: Record<string, number> = {};
    for (const t of Object.keys(topics)) {
      confidence[t] = topics[t].confidence;
    }

    // flashcard_diff = {t: topics[t].get('flashcardDifficulty') for t in topics}
    const flashcardDiff: Record<string, string> = {};
    for (const t of Object.keys(topics)) {
      flashcardDiff[t] = topics[t].flashcardDifficulty;
    }

    // hints = {t: topics[t].get('hint') for t in topics}
    const hints: Record<string, string> = {};
    for (const t of Object.keys(topics)) {
      hints[t] = topics[t].hint;
    }

    // history_scores = list(history.values())
    const historyScores = Object.values(history);

    // pred, status = analyze_performance(history_scores)
    const { prediction: pred, status } = analyzePerformance(historyScores);

    // ── Step 3: Build EXACT same prompt as Pranati ──
    const prompt = `
You are Guardian AI, an academic tutor.

Student learning style: ${dna.learningStyle || 'unknown'}
Personality traits: ${JSON.stringify(dna.personalityTraits || [])}
Topics studied: ${JSON.stringify(Object.keys(topics))}
Memory retention per topic: ${JSON.stringify(memoryRetention)}
Mistakes made per topic: ${JSON.stringify(mistakes)}
Confidence per topic: ${JSON.stringify(confidence)}
Flashcard difficulty: ${JSON.stringify(flashcardDiff)}
Hints for AI tutor: ${JSON.stringify(hints)}
Quiz score history: ${JSON.stringify(historyScores)}
Predicted next score: ${pred}, Trend: ${status}
Recommended sequence of topics: ${JSON.stringify(recommendedSeq)}

Student question: ${question}

Task:
1. Ask 2-3 personalized questions, prioritizing weakest topics first.
2. Suggest an activity for each topic (flashcards, hints, practice exercises).
3. Explain why this sequence and activity is recommended.
4. Make guidance actionable, data-driven, and concise.
`;

    // ── Step 4: Call Gemini (same model as Pranati: gemini-2.5-flash) ──
    const response = await callGemini(prompt);

    if (response) {
      return NextResponse.json({ answer: response });
    }

    // Fallback if Gemini is completely down
    return NextResponse.json({
      answer: `Tutor is resting 😴 Gemini is unavailable right now. Quick summary from your data: your weakest topics are ${Object.entries(confidence).sort((a, b) => (a[1] as number) - (b[1] as number)).slice(0, 3).map(([k, v]) => `${topics[k]?.name || k} (${Math.round((v as number) * 100)}%)`).join(', ')}. Focus on those first!`,
    });

  } catch (error: any) {
    log.error('Tutor crashed', { error: error.message });
    return NextResponse.json({ answer: `Tutor is resting 😴 Error: ${error.message}` }, { status: 200 });
  }
}
