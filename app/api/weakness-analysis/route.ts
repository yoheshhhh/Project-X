import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const log = logger.child('WeaknessAnalysis');

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

interface QuizAttempt {
  topic: string;
  score: number;
  week: number;
  timeSpent?: number;
  questionsTotal?: number;
  questionsMissed?: string[];
}

class WeaknessAnalyzer {
  private quizHistory: QuizAttempt[];

  constructor(quizHistory: QuizAttempt[]) {
    this.quizHistory = quizHistory;
  }

  /**
   * Careless vs Genuine Weakness Detection
   * 
   * Algorithm:
   * - Group scores by topic
   * - If topic has HIGH VARIANCE (std dev > 12) AND at least one score >= 80 → CARELESS
   *   (Student CAN do it but sometimes doesn't → careless mistakes)
   * - If topic has LOW VARIANCE AND avg < 70 → GENUINE WEAKNESS
   *   (Student consistently struggles → doesn't understand the concept)
   * - If topic has LOW VARIANCE AND avg >= 70 → UNDERSTOOD
   */
  detectCarelessVsWeakness() {
    const topicGroups: Record<string, number[]> = {};
    this.quizHistory.forEach(q => {
      if (!topicGroups[q.topic]) topicGroups[q.topic] = [];
      topicGroups[q.topic].push(q.score);
    });

    const results: any[] = [];
    for (const [topic, scores] of Object.entries(topicGroups)) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.length > 1 
        ? Math.sqrt(scores.reduce((a, s) => a + (s - avg) ** 2, 0) / (scores.length - 1))
        : 0;
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);
      const range = maxScore - minScore;

      let classification: 'careless' | 'genuine-weakness' | 'understood' | 'insufficient-data';
      let confidence: number;
      let evidence: string;

      if (scores.length < 2) {
        // Single attempt — use score threshold
        if (avg >= 80) {
          classification = 'understood';
          confidence = 0.5;
          evidence = `Only 1 attempt (${avg}%). Need more data to confirm.`;
        } else if (avg >= 65) {
          classification = 'careless';
          confidence = 0.4;
          evidence = `Score ${avg}% on single attempt — could be careless errors or partial understanding.`;
        } else {
          classification = 'genuine-weakness';
          confidence = 0.5;
          evidence = `Scored ${avg}% — likely a genuine gap in understanding.`;
        }
      } else if (variance > 12 && maxScore >= 80) {
        classification = 'careless';
        confidence = Math.min(0.95, 0.6 + (variance / 100));
        evidence = `Scores range from ${minScore}% to ${maxScore}% (std dev: ${Math.round(variance)}). You CAN score ${maxScore}% but sometimes drop to ${minScore}% — indicates careless mistakes, not lack of understanding.`;
      } else if (avg < 70) {
        classification = 'genuine-weakness';
        confidence = Math.min(0.95, 0.7 + ((70 - avg) / 100));
        evidence = `Average ${Math.round(avg)}% across ${scores.length} attempts with low variance (std dev: ${Math.round(variance)}). Consistently below 70% — this is a genuine knowledge gap.`;
      } else {
        classification = 'understood';
        confidence = Math.min(0.95, 0.6 + (avg / 200));
        evidence = `Average ${Math.round(avg)}% with consistent performance (std dev: ${Math.round(variance)}). Topic is well understood.`;
      }

      results.push({
        topic,
        classification,
        confidence: Math.round(confidence * 100) / 100,
        avgScore: Math.round(avg),
        scores,
        stdDev: Math.round(variance),
        range,
        maxScore,
        minScore,
        attempts: scores.length,
        evidence,
      });
    }

    // Sort: genuine weaknesses first, then careless, then understood
    const order = { 'genuine-weakness': 0, 'careless': 1, 'insufficient-data': 2, 'understood': 3 };
    return results.sort((a, b) => order[a.classification] - order[b.classification]);
  }

  /**
   * Repeated Failure Pattern Detection
   * 
   * Algorithm:
   * - Find topics attempted 2+ times where latest score < 75
   * - Detect if scores are FLAT (not improving despite retries) → "stuck pattern"
   * - Detect if scores DROPPED from first to last → "regression pattern"
   * - Detect specific score ranges that repeat → "ceiling pattern"
   */
  detectRepeatedFailures() {
    const topicGroups: Record<string, QuizAttempt[]> = {};
    this.quizHistory.forEach(q => {
      if (!topicGroups[q.topic]) topicGroups[q.topic] = [];
      topicGroups[q.topic].push(q);
    });

    const patterns: any[] = [];
    for (const [topic, attempts] of Object.entries(topicGroups)) {
      const sorted = attempts.sort((a, b) => a.week - b.week);
      const scores = sorted.map(a => a.score);
      const latest = scores[scores.length - 1];
      const first = scores[0];

      if (scores.length < 1 || latest >= 85) continue; // Skip mastered topics

      const avgImprovement = scores.length > 1 
        ? (latest - first) / (scores.length - 1) 
        : 0;

      let pattern: string;
      let severity: 'critical' | 'warning' | 'monitor';
      let description: string;
      let recommendation: string;

      if (scores.length >= 2 && Math.abs(avgImprovement) < 3 && latest < 75) {
        // Flat — not improving
        pattern = 'stuck';
        severity = latest < 60 ? 'critical' : 'warning';
        description = `Attempted ${scores.length} times (scores: ${scores.join('→')}) with minimal improvement. You're stuck in a loop — same mistakes repeating.`;
        recommendation = `Try a completely different approach: watch video explanations, use flashcards, or ask the AI Tutor to explain ${topic} from scratch.`;
      } else if (scores.length >= 2 && latest < first - 5) {
        // Regression
        pattern = 'regression';
        severity = 'critical';
        description = `Score dropped from ${first}% to ${latest}% over ${scores.length} attempts. This suggests the topic is being forgotten or confused with newer material.`;
        recommendation = `Urgent: Review ${topic} fundamentals before moving forward. The forgetting curve shows this knowledge is decaying.`;
      } else if (scores.length >= 2 && latest >= 65 && latest < 80 && avgImprovement < 5) {
        // Ceiling
        pattern = 'ceiling';
        severity = 'warning';
        description = `Scores plateaued around ${latest}% (${scores.join('→')}). You understand the basics but hit a ceiling on harder aspects.`;
        recommendation = `Focus specifically on the harder sub-topics within ${topic}. Try harder practice questions to break through the ${latest}% ceiling.`;
      } else if (latest < 70) {
        // General struggle
        pattern = 'struggling';
        severity = latest < 50 ? 'critical' : 'warning';
        description = `Latest score ${latest}% indicates ongoing difficulty with ${topic}.`;
        recommendation = `Break down ${topic} into smaller sub-concepts and master each one individually.`;
      } else {
        pattern = 'improving';
        severity = 'monitor';
        description = `Improving from ${first}% to ${latest}% — keep going!`;
        recommendation = `Continue current study approach. You're on the right track.`;
      }

      patterns.push({
        topic,
        pattern,
        severity,
        description,
        recommendation,
        scores,
        attempts: scores.length,
        firstScore: first,
        latestScore: latest,
        improvement: Math.round(avgImprovement * 10) / 10,
        weeksSpan: sorted.length > 1 ? sorted[sorted.length-1].week - sorted[0].week : 0,
      });
    }

    const order = { 'critical': 0, 'warning': 1, 'monitor': 2 };
    return patterns.sort((a, b) => order[a.severity] - order[b.severity]);
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  try {
    const { quizHistory } = await request.json();
    log.info('Weakness analysis started', { quizCount: quizHistory.length });

    const analyzer = new WeaknessAnalyzer(quizHistory);
    const carelessAnalysis = analyzer.detectCarelessVsWeakness();
    const repeatedFailures = analyzer.detectRepeatedFailures();

    // Get AI advice
    const carelessTopics = carelessAnalysis.filter(t => t.classification === 'careless');
    const weakTopics = carelessAnalysis.filter(t => t.classification === 'genuine-weakness');
    const stuckTopics = repeatedFailures.filter(p => p.pattern === 'stuck' || p.pattern === 'regression');

    const prompt = `You are an expert learning analytics AI. Analyze this student's error patterns:

CARELESS MISTAKES (high variance, CAN do well but sometimes don't):
${carelessTopics.map(t => `- ${t.topic}: scores ${t.scores.join(', ')}%, std dev ${t.stdDev}`).join('\n') || 'None detected'}

GENUINE WEAKNESSES (consistently low):
${weakTopics.map(t => `- ${t.topic}: avg ${t.avgScore}%, ${t.attempts} attempts`).join('\n') || 'None detected'}

STUCK/REGRESSION PATTERNS:
${stuckTopics.map(p => `- ${p.topic}: ${p.pattern}, scores ${p.scores.join('→')}%`).join('\n') || 'None detected'}

Respond ONLY with valid JSON (no backticks):
{
  "carelessAdvice": "2 sentences: specific strategies to reduce careless errors",
  "weaknessAdvice": "2 sentences: how to address genuine knowledge gaps",
  "repeatedFailureAdvice": "2 sentences: how to break out of stuck patterns",
  "overallDiagnosis": "3 sentence summary distinguishing between careless errors and real weaknesses for this specific student"
}`;

    let aiAdvice = null;
    const aiResponse = await callGemini(prompt);
    if (aiResponse) {
      try { aiAdvice = JSON.parse(aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch {}
    }

    // Fallback advice
    if (!aiAdvice) {
      aiAdvice = {
        carelessAdvice: carelessTopics.length > 0 
          ? `You're making careless errors in ${carelessTopics.map(t=>t.topic).join(', ')} — slow down and double-check your work. Your high scores prove you understand the material.`
          : 'No significant careless error patterns detected. Keep up the consistent work!',
        weaknessAdvice: weakTopics.length > 0
          ? `${weakTopics.map(t=>t.topic).join(', ')} need focused review — these are genuine gaps in understanding. Try breaking each topic into smaller sub-concepts.`
          : 'No major knowledge gaps detected. All topics show adequate understanding.',
        repeatedFailureAdvice: stuckTopics.length > 0
          ? `You're stuck on ${stuckTopics.map(p=>p.topic).join(', ')} — try a completely different learning approach like videos, peer discussion, or hands-on coding.`
          : 'No stuck patterns detected. Your retry strategy is working.',
        overallDiagnosis: `Analysis of ${carelessAnalysis.length} topics: ${carelessTopics.length} show careless error patterns, ${weakTopics.length} are genuine weaknesses, and ${carelessAnalysis.filter(t=>t.classification==='understood').length} are well understood. Focus your limited study time on genuine weaknesses, not topics where you just need to slow down.`,
      };
    }

    const result = {
      carelessAnalysis,
      repeatedFailures,
      aiAdvice,
      summary: {
        totalTopics: carelessAnalysis.length,
        carelessCount: carelessTopics.length,
        genuineWeaknessCount: weakTopics.length,
        understoodCount: carelessAnalysis.filter(t => t.classification === 'understood').length,
        stuckCount: stuckTopics.length,
      },
      meta: {
        analysisTimeMs: Date.now() - startTime,
        algorithm: 'Statistical Variance Analysis + Pattern Detection',
        aiAvailable: !!aiResponse,
      },
    };

    log.info('Weakness analysis complete', { ...result.summary, timeMs: result.meta.analysisTimeMs });
    return NextResponse.json(result);
  } catch (error: any) {
    log.error('Weakness analysis error', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
