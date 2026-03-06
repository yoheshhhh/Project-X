import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { complete as openAIComplete } from '@/lib/openai-ai';
import { verifyAuth } from '@/lib/api-auth';

const log = logger.child('API:AdaptiveQuiz');

/**
 * POST /api/adaptive-quiz
 *
 * Generates quiz questions with difficulty adapted to the student's performance.
 * Uses ML-based difficulty adjustment: tracks consecutive high/low scores to
 * dynamically adjust between easy/medium/hard/expert levels.
 *
 * Body: {
 *   segmentSlides: string,        // slide content for the segment
 *   segmentIndex: number,
 *   currentDifficulty: 'easy' | 'medium' | 'hard' | 'expert',
 *   recentScores: number[],       // last 5 quiz scores
 *   weakTopics: string[],         // student's weak topics
 *   strongTopics: string[],       // student's strong topics
 *   topic?: string,               // current topic being studied
 * }
 *
 * Returns: {
 *   questions: QuizQuestion[],
 *   difficulty: string,
 *   adjustmentReason: string,
 *   nextDifficulty: string,
 * }
 */

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

function computeAdaptiveDifficulty(
  currentDifficulty: Difficulty,
  recentScores: number[],
  weakTopics: string[],
  topic?: string
): { difficulty: Difficulty; reason: string; nextDifficulty: Difficulty } {
  if (recentScores.length === 0) {
    return { difficulty: 'medium', reason: 'Starting at medium difficulty', nextDifficulty: 'medium' };
  }

  const avgRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  const lastScore = recentScores[recentScores.length - 1];
  const isWeakTopic = topic && weakTopics.includes(topic);

  // Count consecutive high/low scores
  let consecutiveHigh = 0;
  let consecutiveLow = 0;
  for (let i = recentScores.length - 1; i >= 0; i--) {
    if (recentScores[i] >= 85) consecutiveHigh++;
    else break;
  }
  for (let i = recentScores.length - 1; i >= 0; i--) {
    if (recentScores[i] < 60) consecutiveLow++;
    else break;
  }

  const difficultyLevels: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];
  const currentIdx = difficultyLevels.indexOf(currentDifficulty);
  let newIdx = currentIdx;
  let reason = '';

  // Increase difficulty: 3+ consecutive high scores or avg > 90
  if (consecutiveHigh >= 3 || avgRecent > 90) {
    newIdx = Math.min(3, currentIdx + 1);
    reason = consecutiveHigh >= 3
      ? `${consecutiveHigh} consecutive high scores (${recentScores.slice(-3).join(', ')}%) — increasing challenge`
      : `Average score ${Math.round(avgRecent)}% indicates mastery — stepping up difficulty`;
  }
  // Decrease difficulty: 2+ consecutive low scores or avg < 50
  else if (consecutiveLow >= 2 || avgRecent < 50) {
    newIdx = Math.max(0, currentIdx - 1);
    reason = consecutiveLow >= 2
      ? `${consecutiveLow} consecutive low scores — reducing difficulty to build confidence`
      : `Average score ${Math.round(avgRecent)}% — adapting to ensure learning`;
  }
  // Weak topic override: cap at medium
  else if (isWeakTopic && currentIdx > 1) {
    newIdx = 1;
    reason = `"${topic}" is a weak topic — capping at medium to reinforce fundamentals`;
  }
  // Steady
  else {
    reason = `Maintaining ${currentDifficulty} — scores averaging ${Math.round(avgRecent)}%`;
  }

  const difficulty = difficultyLevels[newIdx];
  // Predict next difficulty based on current trend
  const nextIdx = lastScore >= 85 ? Math.min(3, newIdx + 1) : lastScore < 60 ? Math.max(0, newIdx - 1) : newIdx;

  return { difficulty, reason, nextDifficulty: difficultyLevels[nextIdx] };
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const {
      segmentSlides,
      segmentIndex = 0,
      currentDifficulty = 'medium',
      recentScores = [],
      weakTopics = [],
      strongTopics = [],
      topic = '',
    } = body;

    if (!segmentSlides || typeof segmentSlides !== 'string' || !segmentSlides.trim()) {
      return NextResponse.json({ error: 'Missing segmentSlides' }, { status: 400 });
    }

    // Compute adaptive difficulty
    const { difficulty, reason, nextDifficulty } = computeAdaptiveDifficulty(
      currentDifficulty as Difficulty,
      recentScores,
      weakTopics,
      topic
    );

    log.info('Adaptive quiz generation', { segmentIndex, currentDifficulty, adaptedDifficulty: difficulty, reason });

    // Difficulty-specific prompt adjustments
    const difficultyInstructions: Record<Difficulty, string> = {
      easy: `Generate EASY questions that test basic recall and understanding. Use straightforward wording. Include helpful context in the question. Make wrong options clearly distinguishable from the correct one.`,
      medium: `Generate MEDIUM difficulty questions that test comprehension and application. Questions should require understanding, not just memorization. Wrong options should be plausible but distinguishable.`,
      hard: `Generate HARD questions that test analysis and application of concepts. Include scenario-based questions that require applying multiple concepts. Wrong options should be very plausible — require deep understanding to distinguish.`,
      expert: `Generate EXPERT-level questions that test synthesis and evaluation. Include multi-step reasoning problems, edge cases, and questions that combine multiple topics. All options should be highly plausible — only thorough understanding reveals the correct answer.`,
    };

    const weakTopicFocus = weakTopics.length > 0
      ? `\nThe student is weak in: ${weakTopics.join(', ')}. If the content covers any of these topics, include extra questions on them.`
      : '';

    const strongTopicNote = strongTopics.length > 0
      ? `\nThe student is strong in: ${strongTopics.join(', ')}. For these topics, make questions more challenging.`
      : '';

    const prompt = `You are a quiz generator for an educational platform. Generate exactly 5 multiple-choice questions from the following lecture content.

DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
${difficultyInstructions[difficulty]}
${weakTopicFocus}
${strongTopicNote}

LECTURE CONTENT:
${segmentSlides.slice(0, 3000)}

Return ONLY a valid JSON array (no backticks, no explanation):
[
  {
    "id": "s${segmentIndex}-q1",
    "question": "question text",
    "options": ["option A", "option B", "option C", "option D"],
    "correctIndex": 0,
    "difficulty": "${difficulty}",
    "explanation": "Brief explanation of why this is correct"
  }
]

IMPORTANT: Return exactly 5 questions. Each must have exactly 4 options. correctIndex must be 0-3.`;

    const aiResponse = await openAIComplete(prompt, { maxTokens: 2000 });
    if (!aiResponse) {
      return NextResponse.json({ error: 'AI unavailable' }, { status: 503 });
    }

    const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const questions = JSON.parse(cleaned);

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'Invalid quiz format from AI' }, { status: 500 });
    }

    // Validate and sanitize
    const sanitized = questions.slice(0, 5).map((q: any, i: number) => ({
      id: q.id || `s${segmentIndex}-q${i + 1}`,
      question: q.question || '',
      options: Array.isArray(q.options) ? q.options.slice(0, 4) : [],
      correctIndex: typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < 4 ? q.correctIndex : 0,
      difficulty: q.difficulty || difficulty,
      explanation: q.explanation || '',
    }));

    return NextResponse.json({
      questions: sanitized,
      difficulty,
      adjustmentReason: reason,
      nextDifficulty,
    });

  } catch (error: any) {
    log.error('Adaptive quiz generation failed', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
