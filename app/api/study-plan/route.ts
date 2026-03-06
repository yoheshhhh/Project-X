import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { complete } from '@/lib/openai-ai';
import { verifyAuth } from '@/lib/api-auth';

const log = logger.child('StudyPlan');

async function callAI(prompt: string): Promise<string | null> {
  try {
    return await complete(prompt, { maxTokens: 2000 });
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAuth(request);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { weakTopics, strongTopics, quizHistory, avgSessionMinutes, learningStyle } = await request.json();
    log.info('Generating study plan', { weakCount: weakTopics.length, style: learningStyle });

    const topicScores: Record<string, number[]> = {};
    quizHistory.forEach((q: any) => { if (!topicScores[q.topic]) topicScores[q.topic] = []; topicScores[q.topic].push(q.score); });
    const prioritized = Object.entries(topicScores)
      .map(([topic, scores]) => ({ topic, avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), latest: scores[scores.length - 1], attempts: scores.length }))
      .sort((a, b) => a.avg - b.avg);

    const prompt = `You are Guardian AI — a smart study planner for an NTU Singapore student.

STUDENT PROFILE:
- Learning style: ${learningStyle}
- Avg session: ${avgSessionMinutes} minutes
- Weak topics: ${weakTopics.join(', ')}
- Strong topics: ${strongTopics.join(', ')}

TOPIC SCORES (sorted by priority):
${prioritized.map(t => `- ${t.topic}: avg ${t.avg}%, latest ${t.latest}%, ${t.attempts} attempts`).join('\n')}

Generate a personalized daily study plan. Total time should be ~${avgSessionMinutes} minutes.

Respond ONLY with valid JSON (no backticks):
{
  "greeting": "Personalized greeting with student's current situation (1 sentence)",
  "totalMinutes": ${avgSessionMinutes},
  "blocks": [
    {
      "order": 1,
      "topic": "Topic name",
      "activity": "What specifically to do (e.g., 'Review flashcards on scope rules', 'Solve 3 nested loop problems')",
      "minutes": 20,
      "type": "review|practice|learn|quiz",
      "reason": "Why this is scheduled now (1 sentence)",
      "difficulty": "easy|medium|hard"
    }
  ],
  "breakReminder": "When to take a break and what kind",
  "endGoal": "What the student should be able to do after completing today's plan",
  "tomorrowPreview": "Brief preview of what's planned for tomorrow"
}`;

    const aiResponse = await callAI(prompt);
    let result;
    if (aiResponse) {
      try { result = JSON.parse(aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch {}
    }

    if (!result) {
      const weakSorted = prioritized.filter(t => t.avg < 70);
      const reviewTopics = prioritized.filter(t => t.avg >= 70 && t.avg < 85);
      result = {
        greeting: `Based on your recent scores, let's focus on strengthening ${weakSorted[0]?.topic || 'your weak areas'} today.`,
        totalMinutes: avgSessionMinutes,
        blocks: [
          ...(weakSorted.slice(0, 2).map((t, i) => ({
            order: i + 1, topic: t.topic, activity: `Focused review: re-read notes on ${t.topic}, then solve 3 practice problems`, minutes: 25, type: 'review', reason: `Score of ${t.avg}% needs immediate attention`, difficulty: 'medium'
          }))),
          ...(reviewTopics.slice(0, 1).map((t, i) => ({
            order: weakSorted.length + i + 1, topic: t.topic, activity: `Quick quiz: test yourself on ${t.topic} with 5 questions`, minutes: 15, type: 'quiz', reason: `${t.avg}% is close to mastery — push it over 85%`, difficulty: 'medium'
          }))),
          { order: prioritized.length > 3 ? 4 : 3, topic: 'Mixed Review', activity: 'Flashcard review of all topics studied today', minutes: 10, type: 'review', reason: 'Spaced repetition locks in today\'s learning', difficulty: 'easy' },
        ],
        breakReminder: 'Take a 5-minute break after 45 minutes. Stand up, stretch, hydrate.',
        endGoal: `You should be able to solve basic ${weakSorted[0]?.topic || 'programming'} problems without looking at notes.`,
        tomorrowPreview: `Tomorrow: deeper dive into ${weakSorted[1]?.topic || 'advanced topics'} with harder practice problems.`,
      };
    }

    return NextResponse.json({ ...result, generatedAt: new Date().toISOString(), topicPriority: prioritized.slice(0, 5) });
  } catch (error: any) {
    log.error('Study plan error', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
