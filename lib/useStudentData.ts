'use client';
import { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, getUserProfile, getAllModuleProgress, getAllSegmentQuizScores, getStudySessions } from './firebase';

// ---- Mock / fallback data (used when user has < 1 real quiz score) ----
const MOCK_STUDENT_DATA: any = {
  name: 'Narhen K.', learningStyle: 'Long-term Gradual', weeksActive: 8,
  modules: [{ name: 'SC1003 M1: Intro to Python', progress: 100 },{ name: 'SC1003 M2: Control Structures', progress: 67 },{ name: 'SC1003 M3: Functions', progress: 30 }],
  weeklyHoursHistory: [8, 12, 15, 10, 14, 16, 13, 11],
  quizHistory: [
    { topic: 'Variables', score: 92, week: 1 },{ topic: 'Variables', score: 88, week: 2 },{ topic: 'Variables', score: 55, week: 5 },
    { topic: 'Data Types', score: 85, week: 1 },{ topic: 'Data Types', score: 90, week: 3 },{ topic: 'Data Types', score: 88, week: 6 },
    { topic: 'If-Else', score: 80, week: 2 },{ topic: 'If-Else', score: 92, week: 4 },{ topic: 'If-Else', score: 58, week: 6 },
    { topic: 'Loops Intro', score: 75, week: 3 },{ topic: 'Loops Intro', score: 78, week: 5 },
    { topic: 'For Loops', score: 85, week: 3 },{ topic: 'For Loops', score: 90, week: 5 },{ topic: 'For Loops', score: 62, week: 7 },
    { topic: 'While Loops', score: 70, week: 4 },{ topic: 'While Loops', score: 68, week: 6 },{ topic: 'While Loops', score: 65, week: 8 },
    { topic: 'Nested Loops', score: 65, week: 4 },{ topic: 'Nested Loops', score: 60, week: 6 },{ topic: 'Nested Loops', score: 58, week: 8 },
    { topic: 'Functions Intro', score: 80, week: 5 },{ topic: 'Functions Intro', score: 82, week: 7 },
    { topic: 'Scope', score: 60, week: 5 },{ topic: 'Scope', score: 55, week: 7 },{ topic: 'Scope', score: 52, week: 8 },
    { topic: 'Return Values', score: 75, week: 6 },{ topic: 'Return Values', score: 70, week: 8 },
    { topic: 'Recursion', score: 45, week: 7 },{ topic: 'Recursion', score: 48, week: 8 },
    { topic: 'List Operations', score: 82, week: 7 },{ topic: 'List Operations', score: 50, week: 8 },
  ],
  loginFrequency: [3, 5, 6, 4, 5, 6, 5, 4], avgSessionMinutes: 95,
  flashcardsReviewed: 42, lostClicks: 5, lastActive: '2 hours ago', daysSinceLogin: 0,
};

// Pre-compute weak/strong for mock data
const _ta = Object.entries(
  MOCK_STUDENT_DATA.quizHistory.reduce((a: any, q: any) => { if (!a[q.topic]) a[q.topic] = []; a[q.topic].push(q.score); return a; }, {})
).map(([t, s]: [string, any]) => ({ topic: t, avg: Math.round(s.reduce((a: number, b: number) => a + b, 0) / s.length) }));
MOCK_STUDENT_DATA.weakTopics = _ta.filter(t => t.avg < 70).sort((a, b) => a.avg - b.avg).map(t => t.topic);
MOCK_STUDENT_DATA.strongTopics = _ta.filter(t => t.avg >= 80).sort((a, b) => b.avg - a.avg).map(t => t.topic);

const MOCK_DASHBOARD_DATA: any = {
  student: { name: 'Narhen K.', email: 'student@ntu.edu.sg', persona: 'Long-term Gradual Learner', streak: 7 },
  modules: [
    { name: 'SC1003 Module 2: Control Structures', progress: 67, segments: { completed: 2, total: 3 }, quizAvg: 85, status: 'in-progress' },
    { name: 'SC1003 Module 3: Functions', progress: 30, segments: { completed: 1, total: 4 }, quizAvg: 70, status: 'in-progress' },
    { name: 'SC1003 Module 1: Intro to Python', progress: 100, segments: { completed: 3, total: 3 }, quizAvg: 95, status: 'completed' },
  ],
  weeklyHours: [
    { day: 'Mon', hours: 2.5 }, { day: 'Tue', hours: 1.8 }, { day: 'Wed', hours: 3.2 },
    { day: 'Thu', hours: 2.0 }, { day: 'Fri', hours: 1.5 }, { day: 'Sat', hours: 4.0 }, { day: 'Sun', hours: 0.5 },
  ],
  quizScores: [
    { quiz: 'M1 S1', score: 90 }, { quiz: 'M1 S2', score: 85 }, { quiz: 'M1 S3', score: 95 },
    { quiz: 'M2 S1', score: 80 }, { quiz: 'M2 S2', score: 85 }, { quiz: 'M3 S1', score: 70 },
  ],
  peerComparison: { you: 78, cohortAvg: 65, top10: 92 },
  burnout: { riskLevel: 'low', riskScore: 15, signals: [], breakdown: [], recommendation: 'Your study patterns look healthy! Keep it up.', schedule: null, weeklyTip: '', mentalHealthResources: [] },
  flashcardsGenerated: 24,
  practiceQuestionsAttempted: 47,
  imLostClicks: 3,
};

function computeWeakStrong(quizHistory: any[]) {
  const ta = Object.entries(
    quizHistory.reduce((a: any, q: any) => { if (!a[q.topic]) a[q.topic] = []; a[q.topic].push(q.score); return a; }, {})
  ).map(([t, s]: [string, any]) => ({ topic: t, avg: Math.round(s.reduce((a: number, b: number) => a + b, 0) / s.length) }));
  return {
    weakTopics: ta.filter(t => t.avg < 70).sort((a, b) => a.avg - b.avg).map(t => t.topic),
    strongTopics: ta.filter(t => t.avg >= 80).sort((a, b) => b.avg - a.avg).map(t => t.topic),
  };
}

/** Simple client-side phase detection (mirrors server logic in api/insights/route.ts) */
export function detectPhase(data: any) {
  const signals: string[] = [];
  let phase = 'steady-progress';
  let confidence = 0.7;
  if (data.daysSinceLogin > 7) return { phase: 'inactive', confidence: 0.95, signals: [`No login for ${data.daysSinceLogin} days`] };
  if (data.daysSinceLogin > 3) signals.push(`${data.daysSinceLogin} days since last login`);
  const scores = (data.quizHistory || []).map((q: any) => q.score);
  if (scores.length >= 3) {
    const recent = scores.slice(-3), older = scores.slice(-6, -3);
    const rAvg = recent.reduce((a: number, b: number) => a + b, 0) / recent.length;
    const oAvg = older.length > 0 ? older.reduce((a: number, b: number) => a + b, 0) / older.length : rAvg;
    const delta = rAvg - oAvg;
    if (delta > 10) { phase = 'accelerating'; confidence = 0.85; signals.push(`Scores up +${delta.toFixed(0)}%`); }
    else if (delta < -10) { phase = 'declining'; confidence = 0.85; signals.push(`Scores down ${delta.toFixed(0)}%`); }
    else if (Math.abs(delta) <= 3 && rAvg < 70) { phase = 'plateauing'; confidence = 0.75; signals.push(`Stuck at ${rAvg.toFixed(0)}%`); }
  }
  const hours = data.weeklyHoursHistory || [];
  if (hours.length >= 2) {
    const last = hours[hours.length - 1], prev = hours[hours.length - 2];
    if (last > prev * 1.5) { signals.push(`Hours surged ${prev}h->${last}h`); if (phase === 'steady-progress') phase = 'building-momentum'; }
    else if (last < prev * 0.5) { signals.push(`Hours dropped ${prev}h->${last}h`); if (phase !== 'declining') phase = 'at-risk'; }
  }
  if (data.weeksActive <= 1) { phase = 'onboarding'; confidence = 0.9; signals.push('First week'); }
  return { phase, confidence, signals };
}

// ---- Module-level cache ----
let _cache: { studentData: any; dashboardData: any; isRealData: boolean; uid: string } | null = null;
/** Monotonic version counter — incremented by clearStudentDataCache to force re-fetch */
let _cacheVersion = 0;

/** Call after quiz completion to force fresh Firestore fetch on next page load */
export function clearStudentDataCache() { _cache = null; _cacheVersion++; }

/** Helper: compute dashboard module shape from real Firestore moduleProgress doc */
function buildDashModule(m: any) {
  // Real fields from ModuleProgress type: quizScores (Record<number,number>), segmentMastery, unlockedSegmentIndex, etc.
  const quizScoresMap: Record<string, number> = m.quizScores || {};
  const scoreValues = Object.values(quizScoresMap) as number[];
  const totalSegments = Math.max(Object.keys(quizScoresMap).length, m.unlockedSegmentIndex || 0, 3);
  const completedSegments = scoreValues.filter((s: number) => s >= 70).length;
  const quizAvg = scoreValues.length > 0
    ? Math.round(scoreValues.reduce((a: number, b: number) => a + b, 0) / scoreValues.length)
    : 0;
  const progress = Math.round((completedSegments / totalSegments) * 100);

  return {
    name: m.moduleName || m.moduleTopic || m.moduleId || m.id || 'Module',
    progress,
    segments: { completed: completedSegments, total: totalSegments },
    quizAvg,
    status: progress >= 100 ? 'completed' as const : 'in-progress' as const,
  };
}

/** Read localStorage progress and build real data from it (works for demo user without Firebase Auth) */
function buildDataFromLocalStorage(): { studentData: any; dashboardData: any } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('lams_progress');
    if (!raw) return null;
    const all: Record<string, any> = JSON.parse(raw);
    const entries = Object.values(all).filter((m: any) => m.quizScores && Object.keys(m.quizScores).length > 0);
    if (entries.length === 0) return null;

    // Build quiz history
    const quizHistory: any[] = [];
    entries.forEach((m: any) => {
      const scores: Record<string, number> = m.quizScores || {};
      Object.entries(scores).forEach(([seg, score]) => {
        quizHistory.push({ topic: m.moduleTopic || m.moduleName || m.moduleId || 'Unknown', score, week: 1 });
      });
    });

    const { weakTopics, strongTopics } = computeWeakStrong(quizHistory);

    // Build modules for dashboard
    const dashModules = entries.map(buildDashModule);

    const quizScoresList = quizHistory.map((q, i) => ({
      quiz: `${q.topic.slice(0, 15)} S${i + 1}`,
      score: q.score,
    }));

    const avgScore = quizScoresList.length > 0
      ? Math.round(quizScoresList.reduce((a, q) => a + q.score, 0) / quizScoresList.length)
      : 0;

    const studentData = {
      ...MOCK_STUDENT_DATA,
      modules: entries.map((m: any) => ({ name: m.moduleTopic || m.moduleName || 'Module', progress: buildDashModule(m).progress })),
      quizHistory,
      weakTopics,
      strongTopics,
    };

    const dashboardData = {
      ...MOCK_DASHBOARD_DATA,
      modules: dashModules,
      quizScores: quizScoresList.slice(0, 10),
      peerComparison: { you: avgScore, cohortAvg: 65, top10: 92 },
      practiceQuestionsAttempted: quizHistory.length,
    };

    return { studentData, dashboardData };
  } catch {
    return null;
  }
}

export function useStudentData() {
  const [studentData, setStudentData] = useState<any>(_cache?.studentData ?? MOCK_STUDENT_DATA);
  const [dashboardData, setDashboardData] = useState<any>(_cache?.dashboardData ?? MOCK_DASHBOARD_DATA);
  const [loading, setLoading] = useState(!_cache);
  const [isRealData, setIsRealData] = useState(_cache?.isRealData ?? false);
  const [uid, setUid] = useState<string | null>(_cache?.uid ?? null);
  const [version, setVersion] = useState(_cacheVersion);

  // Re-check when cache is invalidated (e.g. after quiz completion)
  useEffect(() => {
    const id = setInterval(() => {
      if (_cacheVersion !== version) {
        setVersion(_cacheVersion);
        _cache = null;
      }
    }, 500);
    return () => clearInterval(id);
  }, [version]);

  useEffect(() => {
    // If cached, skip fetch entirely
    if (_cache) {
      setStudentData(_cache.studentData);
      setDashboardData(_cache.dashboardData);
      setIsRealData(_cache.isRealData);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;
      if (!user) {
        // No Firebase Auth — try localStorage for demo user
        const local = buildDataFromLocalStorage();
        if (local) {
          setStudentData(local.studentData);
          setDashboardData(local.dashboardData);
          setIsRealData(true);
          _cache = { studentData: local.studentData, dashboardData: local.dashboardData, isRealData: true, uid: 'local' };
        }
        setLoading(false);
        return;
      }
      setUid(user.uid);

      try {
        const [profile, moduleProgress, quizScores, sessions] = await Promise.all([
          getUserProfile(user.uid),
          getAllModuleProgress(user.uid),
          getAllSegmentQuizScores(user.uid),
          getStudySessions(user.uid),
        ]);

        if (cancelled) return;

        // Need at least 1 quiz score to use real Firestore data; fall back to localStorage
        if (quizScores.length < 1) {
          const local = buildDataFromLocalStorage();
          if (local) {
            setStudentData(local.studentData);
            setDashboardData(local.dashboardData);
            setIsRealData(true);
            _cache = { studentData: local.studentData, dashboardData: local.dashboardData, isRealData: true, uid: user.uid };
          }
          setLoading(false);
          return;
        }

        setIsRealData(true);

        // ---- Build quizHistory from segmentQuizScores ----
        const quizHistory = quizScores.map((q: any) => ({
          topic: q.topic || q.moduleTopic || q.moduleId || 'Unknown',
          score: q.score ?? 0,
          week: q.updatedAt?.toDate
            ? Math.max(1, Math.ceil((Date.now() - q.updatedAt.toDate().getTime()) / (7 * 86400000)))
            : 1,
        }));

        // ---- Compute weeklyHoursHistory from study sessions ----
        const weeklyHoursMap: Record<number, number> = {};
        sessions.forEach((s: any) => {
          const ts = s.timestamp?.toDate ? s.timestamp.toDate() : new Date();
          const weekNum = Math.max(1, Math.ceil((Date.now() - ts.getTime()) / (7 * 86400000)));
          weeklyHoursMap[weekNum] = (weeklyHoursMap[weekNum] || 0) + (s.durationMinutes || 0) / 60;
        });
        const maxWeek = Math.max(1, ...Object.keys(weeklyHoursMap).map(Number));
        const weeklyHoursHistory = Array.from({ length: Math.min(maxWeek, 12) }, (_, i) =>
          Math.round((weeklyHoursMap[i + 1] || 0) * 10) / 10
        );

        // ---- Build module list from moduleProgress (reuse buildDashModule for consistency) ----
        const modules = moduleProgress.length > 0
          ? moduleProgress.map((m: any) => {
              const dm = buildDashModule(m);
              return { name: dm.name, progress: dm.progress };
            })
          : MOCK_STUDENT_DATA.modules;

        // ---- Days since last login ----
        const lastStudy = profile?.lastStudyDate?.toDate ? profile.lastStudyDate.toDate() : null;
        const daysSinceLogin = lastStudy ? Math.floor((Date.now() - lastStudy.getTime()) / 86400000) : 0;

        const weeksActive = Math.max(1, maxWeek);
        const { weakTopics, strongTopics } = computeWeakStrong(quizHistory);

        const realStudentData: any = {
          name: profile?.displayName || user.displayName || 'Student',
          learningStyle: profile?.persona?.learningStyle || 'Long-term Gradual',
          weeksActive,
          modules,
          weeklyHoursHistory: weeklyHoursHistory.length > 0 ? weeklyHoursHistory : [0],
          quizHistory,
          loginFrequency: weeklyHoursHistory.map(() => Math.round(Math.random() * 3 + 3)),
          avgSessionMinutes: sessions.length > 0
            ? Math.round(sessions.reduce((a: number, s: any) => a + (s.durationMinutes || 0), 0) / sessions.length)
            : 60,
          flashcardsReviewed: profile?.flashcardsReviewed || 0,
          lostClicks: profile?.imLostClicks || 0,
          lastActive: daysSinceLogin === 0 ? 'Today' : `${daysSinceLogin} days ago`,
          daysSinceLogin,
          weakTopics,
          strongTopics,
        };

        // ---- Build dashboard data ----
        const quizScoresList = quizScores.map((q: any) => {
          const short = (q.topic || q.moduleName || q.moduleId || 'Quiz').replace(/^[\d-]+/, '').trim().slice(0, 15);
          return { quiz: `${short} S${(q.segmentIndex ?? 0) + 1}`, score: q.score ?? 0 };
        });

        const dashModules = moduleProgress.length > 0
          ? moduleProgress.map(buildDashModule)
          : MOCK_DASHBOARD_DATA.modules;

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dailyMap: Record<string, number> = {};
        sessions.forEach((s: any) => {
          const ts = s.timestamp?.toDate ? s.timestamp.toDate() : new Date();
          const dayDiff = Math.floor((Date.now() - ts.getTime()) / 86400000);
          if (dayDiff < 7) {
            const dayKey = dayNames[ts.getDay()];
            dailyMap[dayKey] = (dailyMap[dayKey] || 0) + (s.durationMinutes || 0) / 60;
          }
        });
        const weeklyHours = dayNames.slice(1).concat(dayNames.slice(0, 1)).map(d => ({
          day: d, hours: Math.round((dailyMap[d] || 0) * 10) / 10,
        }));

        const avgScore = quizScoresList.length > 0
          ? Math.round(quizScoresList.reduce((a, q) => a + q.score, 0) / quizScoresList.length)
          : 0;

        const realDashboardData: any = {
          student: {
            name: profile?.displayName || user.displayName || 'Student',
            email: user.email || '',
            persona: profile?.persona?.learningStyle || 'Learner',
            streak: profile?.streakDays || 0,
          },
          modules: dashModules,
          weeklyHours,
          quizScores: quizScoresList.slice(0, 10),
          peerComparison: { you: avgScore, cohortAvg: 65, top10: 92 },
          burnout: MOCK_DASHBOARD_DATA.burnout,
          flashcardsGenerated: profile?.flashcardsReviewed || 0,
          practiceQuestionsAttempted: quizScores.length,
          imLostClicks: profile?.imLostClicks || 0,
        };

        if (cancelled) return;

        setStudentData(realStudentData);
        setDashboardData(realDashboardData);
        _cache = { studentData: realStudentData, dashboardData: realDashboardData, isRealData: true, uid: user.uid };
      } catch (err) {
        console.error('useStudentData: failed to fetch Firestore data, trying localStorage', err);
        const local = buildDataFromLocalStorage();
        if (local && !cancelled) {
          setStudentData(local.studentData);
          setDashboardData(local.dashboardData);
          setIsRealData(true);
          _cache = { studentData: local.studentData, dashboardData: local.dashboardData, isRealData: true, uid: user.uid };
        }
      }
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; unsub(); };
  }, [version]);

  return { studentData, dashboardData, loading, isRealData, uid };
}
