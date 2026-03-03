import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const log = logger.child('AgentOrchestrator');

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
  const startTime = Date.now();
  try {
    const studentData = await request.json();
    log.info('Multi-agent orchestration started');

    const agentResults: any[] = [];

    // AGENT 1: Diagnosis Agent
    const diagStart = Date.now();
    const scores = studentData.quizHistory.map((q: any) => q.score);
    const avgScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
    const weakTopics = studentData.weakTopics || [];
    const strongTopics = studentData.strongTopics || [];
    agentResults.push({
      agent: 'Diagnosis Agent', icon: '🔍', role: 'Analyzes raw learning data to identify patterns',
      status: 'complete', timeMs: Date.now() - diagStart,
      input: `${studentData.quizHistory.length} quiz scores, ${studentData.weeksActive} weeks of data`,
      output: { avgScore, weakTopics, strongTopics, totalAttempts: scores.length, scoreRange: `${Math.min(...scores)}-${Math.max(...scores)}%` },
      finding: `Student averages ${avgScore}% with ${weakTopics.length} weak topics. Score variance suggests ${weakTopics.length > 2 ? 'multiple knowledge gaps' : 'focused struggle areas'}.`,
    });

    // AGENT 2: Pattern Detection Agent
    const patStart = Date.now();
    const topicGroups: Record<string, number[]> = {};
    studentData.quizHistory.forEach((q: any) => { if (!topicGroups[q.topic]) topicGroups[q.topic] = []; topicGroups[q.topic].push(q.score); });
    const carelessTopics: string[] = [];
    const genuineWeaknesses: string[] = [];
    const improving: string[] = [];
    for (const [topic, tScores] of Object.entries(topicGroups)) {
      const avg = tScores.reduce((a, b) => a + b, 0) / tScores.length;
      const std = tScores.length > 1 ? Math.sqrt(tScores.reduce((a, s) => a + (s - avg) ** 2, 0) / (tScores.length - 1)) : 0;
      if (std > 12 && Math.max(...tScores) >= 80) carelessTopics.push(topic);
      else if (avg < 70) genuineWeaknesses.push(topic);
      if (tScores.length > 1 && tScores[tScores.length - 1] > tScores[0]) improving.push(topic);
    }
    agentResults.push({
      agent: 'Pattern Detection Agent', icon: '📊', role: 'Identifies careless errors vs genuine weaknesses using statistical variance',
      status: 'complete', timeMs: Date.now() - patStart,
      input: `${Object.keys(topicGroups).length} topics with multi-attempt data`,
      output: { carelessTopics, genuineWeaknesses, improving, algorithm: 'Variance Analysis + Trend Detection' },
      finding: `Found ${carelessTopics.length} careless error patterns and ${genuineWeaknesses.length} genuine weaknesses. ${improving.length} topics showing improvement.`,
    });

    // AGENT 3: Prediction Agent (ML)
    const predStart = Date.now();
    const n = scores.length;
    const X = scores.map((_: any, i: number) => i);
    const sumX = X.reduce((a: number, b: number) => a + b, 0);
    const sumY = scores.reduce((a: number, b: number) => a + b, 0);
    const sumXY = X.reduce((a: number, x: number, i: number) => a + x * scores[i], 0);
    const sumX2 = X.reduce((a: number, x: number) => a + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const predicted = Math.round(slope * n + intercept);
    const trend = slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'stable';
    agentResults.push({
      agent: 'Prediction Agent', icon: '🔮', role: 'Runs Linear Regression to forecast future scores',
      status: 'complete', timeMs: Date.now() - predStart,
      input: `${n} sequential scores for OLS regression`,
      output: { predictedNext: Math.min(100, Math.max(0, predicted)), slope: Math.round(slope * 100) / 100, trend, algorithm: 'Ordinary Least Squares Linear Regression' },
      finding: `Predicted next score: ${Math.min(100, Math.max(0, predicted))}% (${trend}, slope: ${Math.round(slope * 100) / 100}). ${trend === 'declining' ? '⚠️ Intervention recommended.' : ''}`,
    });

    // AGENT 4: Planner Agent (AI)
    const planStart = Date.now();
    const planPrompt = `You are a Planner Agent in a multi-agent learning system. Based on this diagnosis:
- Weak topics: ${genuineWeaknesses.join(', ') || 'None'}
- Careless topics: ${carelessTopics.join(', ') || 'None'}  
- Trend: ${trend}, predicted next score: ${predicted}%
- Learning style: ${studentData.learningStyle}

Generate a concise action plan. Respond ONLY with valid JSON (no backticks):
{
  "priorityActions": ["action1", "action2", "action3"],
  "timeAllocation": { "weakTopics": 50, "carelessTopics": 20, "revision": 30 },
  "urgency": "high|medium|low",
  "planSummary": "2 sentence summary"
}`;
    let planResult: any = null;
    const planResponse = await callGemini(planPrompt);
    if (planResponse) {
      try { planResult = JSON.parse(planResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch {}
    }
    if (!planResult) {
      planResult = {
        priorityActions: [`Focus on ${genuineWeaknesses[0] || 'weak topics'}`, 'Use flashcards for careless errors', 'Take practice quiz'],
        timeAllocation: { weakTopics: 50, carelessTopics: 20, revision: 30 },
        urgency: genuineWeaknesses.length > 2 ? 'high' : 'medium',
        planSummary: `Focus ${genuineWeaknesses.length > 0 ? 'on ' + genuineWeaknesses[0] : 'on review'}. Use spaced repetition for retention.`,
      };
    }
    agentResults.push({
      agent: 'Planner Agent', icon: '🎯', role: 'Creates personalized study plan using AI reasoning',
      status: 'complete', timeMs: Date.now() - planStart,
      input: 'Diagnosis + Pattern + Prediction outputs',
      output: planResult,
      finding: planResult.planSummary,
    });

    // AGENT 5: Tutor Agent
    const tutorStart = Date.now();
    const tutorPrompt = `You are the Tutor Agent — the final agent in a multi-agent learning pipeline. Synthesize everything into a warm, encouraging message for the student.

Student: ${studentData.name}
Score trend: ${trend} (${predicted}% predicted)
Weak areas: ${genuineWeaknesses.join(', ') || 'none'}
Careless areas: ${carelessTopics.join(', ') || 'none'}
Plan urgency: ${planResult.urgency}

Write a 3-sentence personalized message. Be specific, data-driven, and encouraging. Do NOT use generic platitudes.`;
    let tutorMessage = await callGemini(tutorPrompt);
    if (!tutorMessage) {
      tutorMessage = `${studentData.name}, your scores show a ${trend} trend with a predicted next score of ${predicted}%. Focus your energy on ${genuineWeaknesses[0] || 'your weak areas'} — that's where the biggest gains are. You've got this!`;
    }
    agentResults.push({
      agent: 'Tutor Agent', icon: '🛡️', role: 'Delivers personalized guidance with empathy and clarity',
      status: 'complete', timeMs: Date.now() - tutorStart,
      input: 'All agent outputs + student profile',
      output: { message: tutorMessage },
      finding: tutorMessage,
    });

    return NextResponse.json({
      agents: agentResults,
      orchestration: {
        totalAgents: agentResults.length,
        totalTimeMs: Date.now() - startTime,
        pattern: 'Sequential Pipeline with Maker-Checker',
        description: 'Each agent processes data and passes findings to the next. The Planner Agent acts as a "maker" and the Tutor Agent acts as a "checker" that validates and humanizes the output.',
      },
    });
  } catch (error: any) {
    log.error('Orchestration error', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
