/**
 * Client-side learning science algorithms.
 * Pure functions — no API calls. Everything computed from quiz history + study sessions already in memory.
 */

export interface QuizEntry {
  topic: string;
  score: number;
  week: number;
  /** Days since this quiz was taken (optional — enables sub-week decay precision) */
  daysSince?: number;
}

export interface RetentionRate {
  topic: string;
  originalScore: number;
  retention: number;
  daysSinceStudied: number;
  reviewInDays: number;
  urgency: 'critical' | 'review-soon' | 'fading' | 'fresh';
}

export interface LearningVelocity {
  velocity: number;
  trend: 'accelerating' | 'steady' | 'decelerating';
  efficiency: number;
}

export interface PredictedScore {
  predicted: number;
  confidence: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface StudyEfficiency {
  pointsPerHour: number;
  rating: 'excellent' | 'good' | 'needs-improvement';
}

/**
 * Ebbinghaus forgetting curve per topic.
 * Groups by topic, uses most recent score, applies R = score * e^(-0.3 * weeksSince).
 */
export function computeRetentionRates(quizHistory: QuizEntry[], weeksActive: number): RetentionRate[] {
  if (!quizHistory || quizHistory.length === 0) return [];

  // Group by topic → keep most recent entry (lowest daysSince, or highest week)
  const latest: Record<string, QuizEntry> = {};
  for (const q of quizHistory) {
    const existing = latest[q.topic];
    if (!existing) { latest[q.topic] = q; continue; }
    // Prefer daysSince comparison (smaller = more recent)
    if (q.daysSince !== undefined && existing.daysSince !== undefined) {
      if (q.daysSince < existing.daysSince) latest[q.topic] = q;
    } else if (q.week > existing.week) {
      latest[q.topic] = q;
    }
  }

  return Object.values(latest).map((q) => {
    // Use daysSince directly if available, otherwise fall back to week-level
    const daysSinceStudied = q.daysSince !== undefined
      ? q.daysSince
      : Math.max(0, weeksActive - q.week) * 7;
    const weeksSince = daysSinceStudied / 7;
    const retention = Math.max(5, Math.round((q.score / 100) * 100 * Math.exp(-0.3 * weeksSince)));
    const reviewInDays = Math.max(1, Math.round(7 * Math.exp(-0.1 * (100 - q.score))));

    let urgency: RetentionRate['urgency'];
    if (retention < 40) urgency = 'critical';
    else if (retention < 60) urgency = 'review-soon';
    else if (retention < 75) urgency = 'fading';
    else urgency = 'fresh';

    return { topic: q.topic, originalScore: q.score, retention, daysSinceStudied: Math.round(daysSinceStudied), reviewInDays, urgency };
  });
}

/**
 * Weighted average of all topic retentions → single "Memory Retention Rate" percentage.
 */
export function computeOverallRetention(retentionRates: RetentionRate[]): number {
  if (!retentionRates || retentionRates.length === 0) return 0;
  const sum = retentionRates.reduce((acc, r) => acc + r.retention, 0);
  return Math.round(sum / retentionRates.length);
}

/**
 * Average score delta between consecutive quizzes.
 * Trend: accelerating (>+2), steady (-2 to +2), decelerating (<-2).
 * Efficiency = total score gain / total study hours.
 */
export function computeLearningVelocity(quizHistory: QuizEntry[]): LearningVelocity {
  if (!quizHistory || quizHistory.length < 2) {
    return { velocity: 0, trend: 'steady', efficiency: 0 };
  }

  // Sort by week for chronological order
  const sorted = [...quizHistory].sort((a, b) => a.week - b.week);
  const deltas: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    deltas.push(sorted[i].score - sorted[i - 1].score);
  }

  const velocity = Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10;
  let trend: LearningVelocity['trend'];
  if (velocity > 2) trend = 'accelerating';
  else if (velocity < -2) trend = 'decelerating';
  else trend = 'steady';

  return { velocity, trend, efficiency: 0 };
}

/**
 * Simple linear regression on recent scores to predict next score.
 */
export function computePredictedScore(quizHistory: QuizEntry[]): PredictedScore {
  if (!quizHistory || quizHistory.length < 2) {
    return { predicted: 0, confidence: 0, trend: 'stable' };
  }

  const sorted = [...quizHistory].sort((a, b) => a.week - b.week);
  const recent = sorted.slice(-8); // use last 8 data points
  const n = recent.length;

  // Linear regression: y = mx + b
  const xMean = recent.reduce((s, _, i) => s + i, 0) / n;
  const yMean = recent.reduce((s, q) => s + q.score, 0) / n;

  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (recent[i].score - yMean);
    den += (i - xMean) ** 2;
  }

  const slope = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;
  const predicted = Math.round(Math.min(100, Math.max(0, slope * n + intercept)));

  // R-squared for confidence
  const ssTot = recent.reduce((s, q) => s + (q.score - yMean) ** 2, 0);
  const ssRes = recent.reduce((s, q, i) => s + (q.score - (slope * i + intercept)) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const confidence = Math.round(Math.max(0.3, Math.min(0.95, rSquared)) * 100) / 100;

  let trend: PredictedScore['trend'];
  if (slope > 1) trend = 'improving';
  else if (slope < -1) trend = 'declining';
  else trend = 'stable';

  return { predicted, confidence, trend };
}

/**
 * Points gained per hour studied.
 */
export function computeStudyEfficiency(quizHistory: QuizEntry[], weeklyHoursHistory: number[]): StudyEfficiency {
  if (!quizHistory || quizHistory.length < 2 || !weeklyHoursHistory || weeklyHoursHistory.length === 0) {
    return { pointsPerHour: 0, rating: 'needs-improvement' };
  }

  const totalHours = weeklyHoursHistory.reduce((a, b) => a + b, 0);
  if (totalHours === 0) return { pointsPerHour: 0, rating: 'needs-improvement' };

  const sorted = [...quizHistory].sort((a, b) => a.week - b.week);
  const totalGain = Math.abs(sorted[sorted.length - 1].score - sorted[0].score);
  const pointsPerHour = Math.round((totalGain / totalHours) * 10) / 10;

  let rating: StudyEfficiency['rating'];
  if (pointsPerHour >= 3) rating = 'excellent';
  else if (pointsPerHour >= 1) rating = 'good';
  else rating = 'needs-improvement';

  return { pointsPerHour, rating };
}

/**
 * Filter topics needing review (retention < 60% or urgency critical/review-soon).
 * Sorted by urgency (most urgent first).
 */
export function getReviewDueTopics(retentionRates: RetentionRate[]): RetentionRate[] {
  if (!retentionRates || retentionRates.length === 0) return [];

  const urgencyOrder: Record<string, number> = { critical: 0, 'review-soon': 1, fading: 2, fresh: 3 };

  return retentionRates
    .filter((r) => r.retention < 60 || r.urgency === 'critical' || r.urgency === 'review-soon')
    .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
}

/* ────────────────────────────────────────────────────────────────────────────
 * NEW: Optimal Study Time, Cognitive Load, Weekly Report, Knowledge Graph
 * ──────────────────────────────────────────────────────────────────────── */

export interface StudySession {
  hour: number;       // 0-23
  score: number;      // quiz score achieved after/during session
  duration: number;   // minutes
  timestamp?: number; // epoch ms
}

export interface TimeBlock {
  label: string;
  range: [number, number];
  avgScore: number | null;
  avgDuration: number | null;
  sessionCount: number;
  performance: 'peak' | 'good' | 'low' | 'no-data';
}

/**
 * Analyze study sessions by time-of-day blocks to find peak performance windows.
 */
export function computeOptimalStudyTime(sessions: StudySession[]): TimeBlock[] {
  const blocks: (TimeBlock & { _scores: number[]; _durations: number[] })[] = [
    { label: 'Early Morning (6-9am)', range: [6, 9], avgScore: null, avgDuration: null, sessionCount: 0, performance: 'no-data', _scores: [], _durations: [] },
    { label: 'Morning (9am-12pm)', range: [9, 12], avgScore: null, avgDuration: null, sessionCount: 0, performance: 'no-data', _scores: [], _durations: [] },
    { label: 'Afternoon (12-5pm)', range: [12, 17], avgScore: null, avgDuration: null, sessionCount: 0, performance: 'no-data', _scores: [], _durations: [] },
    { label: 'Evening (5-9pm)', range: [17, 21], avgScore: null, avgDuration: null, sessionCount: 0, performance: 'no-data', _scores: [], _durations: [] },
    { label: 'Night (9pm-12am)', range: [21, 24], avgScore: null, avgDuration: null, sessionCount: 0, performance: 'no-data', _scores: [], _durations: [] },
  ];

  for (const s of sessions) {
    const b = blocks.find(b => s.hour >= b.range[0] && s.hour < b.range[1]);
    if (b) { b._scores.push(s.score); b._durations.push(s.duration); }
  }

  return blocks.map(b => {
    const avgScore = b._scores.length > 0 ? Math.round(b._scores.reduce((a, s) => a + s, 0) / b._scores.length) : null;
    const avgDuration = b._durations.length > 0 ? Math.round(b._durations.reduce((a, d) => a + d, 0) / b._durations.length) : null;
    const performance: TimeBlock['performance'] = avgScore === null ? 'no-data' : avgScore >= 85 ? 'peak' : avgScore >= 70 ? 'good' : 'low';
    return { label: b.label, range: b.range, avgScore, avgDuration, sessionCount: b._scores.length, performance };
  });
}

export interface CognitiveLoadWeek {
  week: string;
  topicCount: number;
  hardTopicCount: number;
  avgScore: number;
  cognitiveLoad: number;  // 0-100
  level: 'optimal' | 'moderate' | 'overloaded';
  topics: string[];
}

/**
 * Cognitive load per week — how many topics studied and how many were hard (< 70%).
 */
export function computeCognitiveLoad(quizHistory: QuizEntry[]): CognitiveLoadWeek[] {
  if (!quizHistory || quizHistory.length === 0) return [];

  const weekTopics: Record<number, { topic: string; score: number }[]> = {};
  for (const q of quizHistory) {
    if (!weekTopics[q.week]) weekTopics[q.week] = [];
    weekTopics[q.week].push({ topic: q.topic, score: q.score });
  }

  return Object.entries(weekTopics)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([week, topics]) => {
      const hardTopics = topics.filter(t => t.score < 70).length;
      const totalTopics = topics.length;
      const avgScore = Math.round(topics.reduce((a, t) => a + t.score, 0) / topics.length);
      const load = Math.min(100, Math.round((hardTopics / Math.max(totalTopics, 1)) * 60 + (totalTopics / 4) * 40));
      const level: CognitiveLoadWeek['level'] = load > 70 ? 'overloaded' : load > 40 ? 'moderate' : 'optimal';
      return { week: `W${week}`, topicCount: totalTopics, hardTopicCount: hardTopics, avgScore, cognitiveLoad: load, level, topics: topics.map(t => t.topic) };
    });
}

/**
 * Current cognitive load (most recent week).
 */
export function getCurrentCognitiveLoad(loadHistory: CognitiveLoadWeek[]): { load: number; level: string; trend: 'increasing' | 'stable' | 'decreasing' } {
  if (!loadHistory || loadHistory.length === 0) return { load: 0, level: 'optimal', trend: 'stable' };
  const current = loadHistory[loadHistory.length - 1];
  let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (loadHistory.length >= 2) {
    const prev = loadHistory[loadHistory.length - 2];
    if (current.cognitiveLoad > prev.cognitiveLoad + 10) trend = 'increasing';
    else if (current.cognitiveLoad < prev.cognitiveLoad - 10) trend = 'decreasing';
  }
  return { load: current.cognitiveLoad, level: current.level, trend };
}

export interface WeeklyReport {
  weekNumber: number;
  totalHours: number;
  quizzesCompleted: number;
  avgScore: number;
  topicsStudied: string[];
  improvement: number;        // score change vs previous week
  retentionAlerts: number;    // topics needing review
  cognitiveLoad: number;
  highlights: string[];
  concerns: string[];
  goalSuggestion: string;
}

/**
 * Generate a weekly progress report from data.
 */
export function computeWeeklyReport(
  quizHistory: QuizEntry[],
  weeklyHoursHistory: number[],
  retentionRates: RetentionRate[],
  cognitiveLoad: CognitiveLoadWeek[]
): WeeklyReport {
  if (!quizHistory || quizHistory.length === 0) {
    return { weekNumber: 1, totalHours: 0, quizzesCompleted: 0, avgScore: 0, topicsStudied: [], improvement: 0, retentionAlerts: 0, cognitiveLoad: 0, highlights: ['Start your first quiz to see insights!'], concerns: [], goalSuggestion: 'Complete your first module segment' };
  }

  const maxWeek = Math.max(...quizHistory.map(q => q.week));
  const thisWeekQuizzes = quizHistory.filter(q => q.week === maxWeek);
  const prevWeekQuizzes = quizHistory.filter(q => q.week === maxWeek - 1);

  const thisAvg = thisWeekQuizzes.length > 0
    ? Math.round(thisWeekQuizzes.reduce((a, q) => a + q.score, 0) / thisWeekQuizzes.length)
    : 0;
  const prevAvg = prevWeekQuizzes.length > 0
    ? Math.round(prevWeekQuizzes.reduce((a, q) => a + q.score, 0) / prevWeekQuizzes.length)
    : thisAvg;

  const retentionAlerts = retentionRates.filter(r => r.urgency === 'critical' || r.urgency === 'review-soon').length;
  const currentLoad = cognitiveLoad.length > 0 ? cognitiveLoad[cognitiveLoad.length - 1].cognitiveLoad : 0;
  const totalHours = weeklyHoursHistory.length > 0 ? weeklyHoursHistory[weeklyHoursHistory.length - 1] : 0;

  const highlights: string[] = [];
  const concerns: string[] = [];

  if (thisAvg >= 80) highlights.push(`Strong quiz performance averaging ${thisAvg}%`);
  if (thisAvg > prevAvg) highlights.push(`Scores improved by ${thisAvg - prevAvg}% vs last week`);
  if (thisWeekQuizzes.length >= 3) highlights.push(`Completed ${thisWeekQuizzes.length} quizzes this week`);
  if (highlights.length === 0) highlights.push(`Completed ${thisWeekQuizzes.length} quiz${thisWeekQuizzes.length !== 1 ? 'zes' : ''}`);

  if (retentionAlerts > 0) concerns.push(`${retentionAlerts} topic${retentionAlerts > 1 ? 's' : ''} need review due to memory decay`);
  if (thisAvg < prevAvg - 5) concerns.push(`Scores dropped by ${prevAvg - thisAvg}% from last week`);
  if (currentLoad > 70) concerns.push('Cognitive load is high — consider spacing out difficult topics');

  const weakTopics = retentionRates.filter(r => r.urgency === 'critical' || r.urgency === 'review-soon').map(r => r.topic);
  const goalSuggestion = weakTopics.length > 0
    ? `Review ${weakTopics[0]} to bring retention above 60%`
    : thisAvg < 80
    ? `Push average score above 80% by practicing weak areas`
    : 'Maintain your streak and explore advanced topics';

  return {
    weekNumber: maxWeek,
    totalHours,
    quizzesCompleted: thisWeekQuizzes.length,
    avgScore: thisAvg,
    topicsStudied: Array.from(new Set(thisWeekQuizzes.map(q => q.topic))),
    improvement: thisAvg - prevAvg,
    retentionAlerts,
    cognitiveLoad: currentLoad,
    highlights,
    concerns,
    goalSuggestion,
  };
}

export interface KnowledgeNode {
  topic: string;
  mastery: number;       // 0-100 average score
  retention: number;     // 0-100 current retention
  attempts: number;
  status: 'mastered' | 'developing' | 'struggling' | 'new';
  connections: string[]; // related topics
}

/**
 * Build a knowledge map — topic nodes with mastery, retention, and connections.
 */
export function computeKnowledgeMap(quizHistory: QuizEntry[], retentionRates: RetentionRate[]): KnowledgeNode[] {
  if (!quizHistory || quizHistory.length === 0) return [];

  const topicScores: Record<string, number[]> = {};
  for (const q of quizHistory) {
    if (!topicScores[q.topic]) topicScores[q.topic] = [];
    topicScores[q.topic].push(q.score);
  }

  const retentionMap: Record<string, number> = {};
  for (const r of retentionRates) retentionMap[r.topic] = r.retention;

  const topics = Object.keys(topicScores);

  return topics.map(topic => {
    const scores = topicScores[topic];
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const retention = retentionMap[topic] ?? avg;
    const status: KnowledgeNode['status'] = avg >= 85 ? 'mastered' : avg >= 70 ? 'developing' : avg >= 1 ? 'struggling' : 'new';

    // Simple connection: topics studied in same week are connected
    const topicWeeks = quizHistory.filter(q => q.topic === topic).map(q => q.week);
    const connections = topics.filter(t => t !== topic && quizHistory.some(q => q.topic === t && topicWeeks.includes(q.week)));

    return { topic, mastery: avg, retention, attempts: scores.length, status, connections: Array.from(new Set(connections)) };
  });
}
