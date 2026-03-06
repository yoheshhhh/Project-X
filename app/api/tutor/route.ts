import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { logger } from '@/lib/logger';
import { complete as openAIComplete } from '@/lib/openai-ai';
import { retrieveRelevantChunks } from '@/lib/rag';

const log = logger.child('API:AITutor');

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_2;
  if (!key) throw new Error('OpenAI is not configured');
  return new OpenAI({ apiKey: key });
}

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

async function getStudentData(studentId = 'student_1'): Promise<Record<string, any> | null> {
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

async function callTutorAI(prompt: string): Promise<string | null> {
  try {
    return await openAIComplete(prompt);
  } catch (err: unknown) {
    log.error('OpenAI exception', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { question, image } = await request.json() as { question?: string; image?: string };
    const hasImage = typeof image === 'string' && image.startsWith('data:image');
    if (!question && !hasImage) {
      return NextResponse.json({ answer: 'Please ask a question or attach an image!' }, { status: 400 });
    }
    const questionText = question || 'The student shared an image. Extract any text, doubt, or question from the image and answer it.';

    log.info('Tutor query', { question: questionText.slice(0, 80), hasImage });

    // ── Step 1: Get student data ──
    const studentData = await getStudentData('student_1');
    if (!studentData) {
      return NextResponse.json({ answer: 'No module data found for student.' });
    }

    // ── Step 2: Extract fields ──
    const topics: Record<string, any> = studentData.moduleData || {};
    const recommendedSeq: string[] = studentData.predictions?.recommendedSequenceOfTopics || [];
    const history: Record<string, number> = studentData.history || {};
    const dna: Record<string, any> = studentData.dna || {};

    const memoryRetention: Record<string, number> = {};
    const mistakes: Record<string, number> = {};
    const confidence: Record<string, number> = {};
    const flashcardDiff: Record<string, string> = {};
    const hints: Record<string, string> = {};

    for (const t of Object.keys(topics)) {
      memoryRetention[t] = topics[t].memoryRetentionRate;
      mistakes[t] = topics[t].mistakesMade;
      confidence[t] = topics[t].confidence;
      flashcardDiff[t] = topics[t].flashcardDifficulty;
      hints[t] = topics[t].hint;
    }

    const historyScores = Object.values(history);
    const { prediction: pred, status } = analyzePerformance(historyScores);

    // ── Step 2.5: RAG — retrieve relevant course content ──
    const relevantChunks = await retrieveRelevantChunks(question, 4);
    const courseContext = relevantChunks.length > 0
      ? `\nRelevant course material from lectures:\n${relevantChunks.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}`
      : '';

    // ── Step 3: Build prompt ──
    const prompt = `
You are Guardian AI, an academic tutor for a Software Security module (SC3010).

Student learning style: ${dna.learningStyle || 'unknown'}
Personality traits: ${JSON.stringify(dna.personalityTraits || [])}
Peak focus time: ${studentData.studyPatterns?.peakFocusTime || 'unknown'}

Detailed performance per topic:
${Object.entries(topics).map(([k, v]: any) =>
  `- ${v.name}:
    * Confidence: ${Math.round((v.confidence || 0) * 100)}%
    * Memory Retention: ${Math.round((v.memoryRetentionRate || 0) * 100)}%
    * Mistakes Made: ${v.mistakesMade || 0}
    * Flashcard Difficulty: ${v.flashcardDifficulty || 'unknown'}
    * Time Spent: ${v.timeTakenMinutes || 0} minutes
    * Study Method Used: ${v.studyMethod || 'unknown'}
    * Completed: ${v.completed}
    * Hint: ${v.hint || 'none'}`
).join('\n')}

Study patterns:
- Peak focus time: ${studentData.studyPatterns?.peakFocusTime || 'unknown'}
- Preferred session length: ${studentData.studyPatterns?.preferredSessionLengthMinutes || 'unknown'} minutes
- Review frequency: ${studentData.studyPatterns?.reviewFrequency || 'unknown'}
- Best day: ${studentData.studyPatterns?.bestDayOfWeek || 'unknown'}
- Worst day: ${studentData.studyPatterns?.worstDayOfWeek || 'unknown'}

Easiest topics: ${JSON.stringify(studentData.topicInsights?.easiestTopics || [])}
Hardest topics: ${JSON.stringify(studentData.topicInsights?.hardestTopics || [])}
Most time consuming: ${JSON.stringify(studentData.topicInsights?.mostTimeConsuming || [])}

Quiz score history: ${JSON.stringify(historyScores)}
Predicted next score: ${pred}, Trend: ${status}
Topics to focus next: ${JSON.stringify(studentData.predictions?.topicsToFocusNext || [])}
${courseContext}

Student question: ${question}

Recent quiz mistakes:
${Object.entries(studentData.quizDetails || {}).map(([quiz, details]: any) =>
  `${quiz} (${details.topic}, score: ${details.score}/${details.totalQuestions}):
${(details.wrongQuestions || []).map((q: any) =>
  `  - Question: "${q.question}"
     Student answered: "${q.studentAnswer}"
     Correct answer: "${q.correctAnswer}"
     Concept: ${q.concept}
     Mistake type: ${q.mistakeType}`
).join('\n')}`
).join('\n\n')}

Based on the student's performance data, quiz mistakes AND the relevant course material above:
1. Answer their question directly, referencing specific lecture content where relevant.
2. Mention specific quiz mistakes that relate to their question — call out exact wrong answers.
3. Analyse their memory retention and confidence for related topics — use the actual numbers.
4. Reference their mistake pattern (conceptual vs memory mistakes) to explain why they struggle.
5. Look at their study patterns (peak focus time: ${studentData.studyPatterns?.peakFocusTime}, best day: ${studentData.studyPatterns?.bestDayOfWeek}) and tailor advice around those.
6. Suggest a very specific next action based on their flashcard difficulty and preferred study method.
7. Be detailed, data-driven, and encouraging — like a personal tutor who knows everything about this student.

`;

    // ── Step 4: Call OpenAI (vision when image attached) ──
    let response: string | null = null;
    if (hasImage && image) {
      try {
        const openai = getOpenAI();
        const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        const completion = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: image } },
              ],
            },
          ],
          max_tokens: 1024,
          temperature: 0.7,
        });
        response = completion.choices[0]?.message?.content?.trim() ?? null;
      } catch (err: unknown) {
        log.error('OpenAI vision exception', { error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (!response) {
      response = await callTutorAI(prompt);
    }

    if (response) {
      return NextResponse.json({ answer: response });
    }

    // Fallback
    return NextResponse.json({
      answer: `Tutor is resting 😴 AI is unavailable right now. Quick summary from your data: your weakest topics are ${Object.entries(confidence).sort((a, b) => (a[1] as number) - (b[1] as number)).slice(0, 3).map(([k, v]) => `${topics[k]?.name || k} (${Math.round((v as number) * 100)}%)`).join(', ')}. Focus on those first!`,
    });

  } catch (error: any) {
    log.error('Tutor crashed', { error: error.message });
    return NextResponse.json({ answer: `Tutor is resting 😴 Error: ${error.message}` }, { status: 200 });
  }
}