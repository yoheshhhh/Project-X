'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStudentData, detectPhase } from '@/lib/useStudentData';
import { auth, saveStudyGoal, getStudyGoals, updateStudyGoal, deleteStudyGoal } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

function BarChart({ data, maxVal, color }: { data: { label: string; value: number }[]; maxVal?: number; color?: string }) {
  const max = maxVal || Math.max(...data.map(d => d.value), 1);
  const BAR_MAX_PX = 120;
  return (
    <div className="flex items-end gap-2">
      {data.map((d, i) => {
        const barH = max > 0 ? Math.round((d.value / max) * BAR_MAX_PX) : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-slate-400">{d.value}</span>
            <div className="w-full flex items-end" style={{ height: `${BAR_MAX_PX}px` }}>
              <div className="w-full rounded-t-md transition-all duration-500" style={{ height: `${Math.max(barH, d.value > 0 ? 4 : 0)}px`, backgroundColor: color || '#3b82f6' }} />
            </div>
            <span className="text-xs text-slate-500 truncate w-full text-center">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { dashboardData, studentData, loading: dataLoading, isRealData, uid } = useStudentData();
  const data = dashboardData;
  const [burnout, setBurnout] = useState<any>(data.burnout);
  const [burnoutLoading, setBurnoutLoading] = useState(false);
  const [burnoutChecked, setBurnoutChecked] = useState(false);

  // Sync burnout when dashboardData changes
  useEffect(() => {
    setBurnout(data.burnout);
  }, [data.burnout]);

  // Auto-run burnout check when real data loads
  useEffect(() => {
    if (isRealData && !burnoutChecked && !dataLoading) {
      setBurnoutChecked(true);
      checkBurnoutRef.current();
    }
  }, [isRealData, burnoutChecked, dataLoading]);

  // Client-side phase detection for adaptive greeting
  const { phase } = detectPhase(studentData);

  const totalHours = data.weeklyHours.reduce((sum: number, d: any) => sum + d.hours, 0);

  const checkBurnout = async () => {
    setBurnoutLoading(true);
    try {
      const res = await fetch('/api/burnout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionsThisWeek: data.weeklyHours.filter((d: any) => d.hours > 0).length,
          avgDurationMinutes: studentData.avgSessionMinutes || 60,
          avgSessionHour: new Date().getHours(),
          scoresTrend: data.quizScores.slice(-5).map((q: any) => q.score),
          streakDays: data.student.streak || 0,
          totalHoursThisWeek: totalHours,
        }),
      });
      const result = await res.json();
      const b = result || {};
      setBurnout({ riskLevel: b.riskLevel || 'low', riskScore: b.riskScore || 0, signals: b.signals || [], breakdown: b.breakdown || [], recommendation: b.recommendation || 'Your study patterns look healthy!', schedule: b.schedule || null, weeklyTip: b.weeklyTip || '', mentalHealthResources: b.mentalHealthResources || [] });
    } catch { setBurnout({ riskLevel: 'moderate', riskScore: 45, signals: ['Late night studying', 'Declining scores'], breakdown: [], recommendation: 'Consider taking a break.', schedule: null, weeklyTip: 'Try sleeping before midnight tonight.', mentalHealthResources: [] }); }
    setBurnoutLoading(false);
  };

  const checkBurnoutRef = useRef(checkBurnout);
  checkBurnoutRef.current = checkBurnout;

  const overallProgress = Math.round(data.modules.reduce((sum, m) => sum + m.progress, 0) / data.modules.length);

  // Algorithm-computed metrics
  const overallRetention = studentData.overallRetention ?? 0;
  const retentionRates = studentData.retentionRates ?? [];
  const learningVelocity = studentData.learningVelocity ?? { velocity: 0, trend: 'steady' };
  const predictedScore = studentData.predictedScore ?? { predicted: 0, confidence: 0, trend: 'stable' };
  const reviewDueTopics = studentData.reviewDueTopics ?? [];

  // New algorithm-computed metrics
  const optimalStudyTime = studentData.optimalStudyTime ?? [];
  const currentCognitiveLoad = studentData.currentCognitiveLoad ?? { load: 0, level: 'optimal', trend: 'stable' };
  const weeklyReport = studentData.weeklyReport ?? { weekNumber: 1, totalHours: 0, quizzesCompleted: 0, avgScore: 0, topicsStudied: [], improvement: 0, retentionAlerts: 0, cognitiveLoad: 0, highlights: [], concerns: [], goalSuggestion: '' };
  const knowledgeMap = studentData.knowledgeMap ?? [];
  const peakTime = optimalStudyTime.find((t: any) => t.performance === 'peak') || optimalStudyTime.find((t: any) => t.sessionCount > 0) || null;

  // Goal management
  const [goals, setGoals] = useState<any[]>([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState({ goalType: 'score' as 'score' | 'hours' | 'streak' | 'topic-mastery', targetValue: 80, description: '', topic: '' });

  const loadGoals = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const g = await getStudyGoals(user.uid);
      setGoals(g);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) loadGoals();
    });
    return () => unsub();
  }, [loadGoals]);

  const handleAddGoal = async () => {
    const user = auth.currentUser;
    if (!user || !goalForm.description.trim()) return;
    try {
      await saveStudyGoal(user.uid, goalForm);
      setShowGoalForm(false);
      setGoalForm({ goalType: 'score', targetValue: 80, description: '', topic: '' });
      await loadGoals();
    } catch (e: any) { console.error('Failed to save goal:', e.message); }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      await deleteStudyGoal(goalId);
      await loadGoals();
    } catch (e: any) { console.error('Failed to delete goal:', e.message); }
  };

  const handleCompleteGoal = async (goalId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await updateStudyGoal(user.uid, goalId, { status: 'completed', progress: 100 });
      await loadGoals();
    } catch (e: any) { console.error('Failed to complete goal:', e.message); }
  };

  const retentionColor = overallRetention >= 75 ? 'text-green-400' : overallRetention >= 50 ? 'text-amber-400' : 'text-red-400';
  const trendArrow = learningVelocity.trend === 'accelerating' ? '\u2191' : learningVelocity.trend === 'decelerating' ? '\u2193' : '\u2192';
  const trendColor = learningVelocity.trend === 'accelerating' ? 'text-green-400' : learningVelocity.trend === 'decelerating' ? 'text-red-400' : 'text-slate-400';
  const cogLoadColor = currentCognitiveLoad.level === 'optimal' ? 'text-green-400' : currentCognitiveLoad.level === 'moderate' ? 'text-amber-400' : 'text-red-400';
  const cogLoadBarColor = currentCognitiveLoad.level === 'optimal' ? '#22c55e' : currentCognitiveLoad.level === 'moderate' ? '#f59e0b' : '#ef4444';

  // Phase-adaptive greeting
  const firstName = data.student.name.split(' ')[0];
  const daysSince = studentData.daysSinceLogin || 0;
  let greeting = `Welcome back, ${firstName}! 👋`;
  let greetingSub = '';
  if (phase === 'inactive' && daysSince > 7) {
    greeting = `Welcome back, ${firstName}! It's been ${daysSince} days.`;
    greetingSub = 'Here\'s a quick review of where you left off.';
  } else if (phase === 'accelerating') {
    greeting = `You're on fire, ${firstName}! 🔥`;
    greetingSub = 'Ready for a harder challenge?';
  } else if (phase === 'declining') {
    greeting = `Let's get back on track, ${firstName} 💪`;
    greetingSub = 'A focused session could help turn things around.';
  }

  if (dataLoading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <svg className="animate-spin h-10 w-10 mx-auto text-blue-400 mb-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        <p className="text-blue-300">Loading your dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-white">NTU<span className="text-blue-400">learn</span></h1>
          <div className="flex items-center gap-4">
            <button onClick={() => window.location.href = '/course'} className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition-all">Continue Learning</button>
            <button onClick={() => window.location.href = '/insights'} className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg transition-all">🧠 AI Insights</button>
            <button onClick={() => window.location.href = '/community'} className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition-all">💬 Community</button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">{data.student.name.charAt(0)}</div>
              <span className="text-sm text-slate-300">{data.student.name}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Data source banner */}
        <div className={`mb-4 px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 ${isRealData ? 'bg-green-500/10 border border-green-500/20 text-green-300' : 'bg-amber-500/10 border border-amber-500/20 text-amber-300'}`}>
          <span>{isRealData ? '🟢 Live data from your Firestore learning history' : '🟡 Demo data — complete quizzes to see your real progress'}</span>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">{greeting}</h2>
          <p className="text-slate-400 text-sm">
            {greetingSub && <span className="text-blue-300 mr-2">{greetingSub}</span>}
            Learner DNA: <span className="text-violet-300 font-medium">{data.student.persona}</span>
          </p>
        </div>

        {/* Contextual action prompt based on phase */}
        {phase === 'inactive' && <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between"><p className="text-sm text-amber-200">💤 You&apos;ve been away for a while. A quick 15-minute review session can rebuild momentum.</p><button onClick={() => window.location.href = '/watch'} className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-4 py-2 rounded-lg transition-all whitespace-nowrap">Quick Review</button></div>}
        {phase === 'accelerating' && <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between"><p className="text-sm text-green-200">⚡ Your scores are climbing fast! Try a practice paper to push your limits.</p><button onClick={() => window.location.href = '/practice-paper'} className="bg-green-500 hover:bg-green-600 text-white text-xs px-4 py-2 rounded-lg transition-all whitespace-nowrap">Take Challenge</button></div>}
        {phase === 'declining' && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between"><p className="text-sm text-red-200">📉 Your recent scores have dipped. A focused session on weak topics can help reverse the trend.</p><button onClick={() => window.location.href = '/insights'} className="bg-red-500 hover:bg-red-600 text-white text-xs px-4 py-2 rounded-lg transition-all whitespace-nowrap">View Insights</button></div>}

        {/* Review Due Banner */}
        {reviewDueTopics.length > 0 && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
            <p className="text-sm text-red-200">
              {reviewDueTopics.length} topic{reviewDueTopics.length > 1 ? 's' : ''} need{reviewDueTopics.length === 1 ? 's' : ''} review &mdash; your memory of <span className="font-bold">{reviewDueTopics[0].topic}</span> is at {reviewDueTopics[0].retention}%
            </p>
            <button onClick={() => window.location.href = '/watch'} className="bg-red-500 hover:bg-red-600 text-white text-xs px-4 py-2 rounded-lg transition-all whitespace-nowrap">Review Now</button>
          </div>
        )}

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🧠</span>
              <span className="text-xs text-slate-400">Memory Retention</span>
            </div>
            <p className={`text-2xl font-bold ${retentionColor}`}>{overallRetention}%</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📈</span>
              <span className="text-xs text-slate-400">Learning Velocity</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {learningVelocity.velocity > 0 ? '+' : ''}{learningVelocity.velocity}
              <span className="text-sm font-normal text-slate-400"> pts/quiz</span>
              <span className={`ml-1 text-lg ${trendColor}`}>{trendArrow}</span>
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🧩</span>
              <span className="text-xs text-slate-400">Cognitive Load</span>
            </div>
            <p className={`text-2xl font-bold ${cogLoadColor}`}>{currentCognitiveLoad.load}%</p>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${currentCognitiveLoad.load}%`, backgroundColor: cogLoadBarColor }} />
            </div>
          </div>
          {[
            { label: 'Day Streak', value: `${data.student.streak} days`, icon: '🔥' },
            { label: 'Hours This Week', value: `${totalHours.toFixed(1)}h`, icon: '⏱️' },
            { label: 'Practice Qs', value: data.practiceQuestionsAttempted, icon: '📝' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{stat.icon}</span>
                <span className="text-xs text-slate-400">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Module Progress */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">📚 Module Progress</h3>
              <div className="space-y-4">
                {data.modules.map((m, i) => (
                  <div key={i} className="p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-slate-200">{m.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'completed' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'}`}>
                        {m.status === 'completed' ? '✅ Complete' : '📖 In Progress'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${m.progress}%`, background: m.progress === 100 ? '#22c55e' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }} />
                      </div>
                      <span className="text-sm font-bold text-white w-12 text-right">{m.progress}%</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span>Segments: {m.segments.completed}/{m.segments.total}</span>
                      <span>Quiz Avg: {m.quizAvg}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Study Hours Chart */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">⏱️ Study Hours This Week</h3>
              <BarChart data={data.weeklyHours.map(d => ({ label: d.day, value: d.hours }))} maxVal={5} color="#3b82f6" />
              <p className="text-xs text-slate-400 mt-3 text-center">Total: {totalHours.toFixed(1)} hours this week</p>
            </div>

            {/* Quiz Scores Chart */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">📈 Quiz Score Trend</h3>
              <BarChart data={data.quizScores.map(d => ({ label: d.quiz, value: d.score }))} maxVal={100} color="#8b5cf6" />
              {predictedScore.predicted > 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="text-slate-400">Predicted next score:</span>
                  <span className={`font-bold ${predictedScore.trend === 'improving' ? 'text-green-400' : predictedScore.trend === 'declining' ? 'text-red-400' : 'text-blue-400'}`}>
                    {predictedScore.predicted}%
                  </span>
                  <span className="text-xs text-slate-500">(confidence: {Math.round(predictedScore.confidence * 100)}%)</span>
                </div>
              )}
            </div>

            {/* Weekly Progress Report */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">📊 Weekly Progress Report</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-white/5 rounded-xl text-center">
                  <p className="text-2xl font-bold text-blue-400">{weeklyReport.quizzesCompleted}</p>
                  <p className="text-xs text-slate-400">Quizzes</p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl text-center">
                  <p className={`text-2xl font-bold ${weeklyReport.avgScore >= 80 ? 'text-green-400' : weeklyReport.avgScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{weeklyReport.avgScore}%</p>
                  <p className="text-xs text-slate-400">Avg Score</p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl text-center">
                  <p className={`text-2xl font-bold ${weeklyReport.improvement >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {weeklyReport.improvement >= 0 ? '+' : ''}{weeklyReport.improvement}%
                  </p>
                  <p className="text-xs text-slate-400">vs Last Week</p>
                </div>
              </div>
              {weeklyReport.highlights.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-green-400 font-medium mb-1.5">Highlights</p>
                  {weeklyReport.highlights.map((h: string, i: number) => (
                    <p key={i} className="text-xs text-slate-300 flex items-start gap-1.5 mb-1"><span className="text-green-400 mt-0.5">+</span>{h}</p>
                  ))}
                </div>
              )}
              {weeklyReport.concerns.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-amber-400 font-medium mb-1.5">Areas to Watch</p>
                  {weeklyReport.concerns.map((c: string, i: number) => (
                    <p key={i} className="text-xs text-slate-300 flex items-start gap-1.5 mb-1"><span className="text-amber-400 mt-0.5">!</span>{c}</p>
                  ))}
                </div>
              )}
              {weeklyReport.goalSuggestion && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-xs text-blue-300"><span className="font-medium">AI Goal Suggestion:</span> {weeklyReport.goalSuggestion}</p>
                </div>
              )}
            </div>

            {/* Knowledge Map */}
            {knowledgeMap.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">🗺️ Knowledge Map</h3>
                <div className="flex flex-wrap gap-3 justify-center">
                  {knowledgeMap.map((node: any) => {
                    const size = Math.max(60, Math.min(100, 40 + node.attempts * 15));
                    const bgColor = node.status === 'mastered' ? 'bg-green-500/20 border-green-500/40' :
                      node.status === 'developing' ? 'bg-blue-500/20 border-blue-500/40' :
                      node.status === 'struggling' ? 'bg-red-500/20 border-red-500/40' :
                      'bg-slate-500/20 border-slate-500/40';
                    const textColor = node.status === 'mastered' ? 'text-green-300' :
                      node.status === 'developing' ? 'text-blue-300' :
                      node.status === 'struggling' ? 'text-red-300' : 'text-slate-400';
                    return (
                      <div key={node.topic} className={`${bgColor} border rounded-2xl flex flex-col items-center justify-center p-3 transition-all hover:scale-105`}
                        style={{ width: `${size}px`, height: `${size}px` }}>
                        <span className={`text-xs font-bold ${textColor} text-center leading-tight`}>{node.topic.length > 12 ? node.topic.slice(0, 10) + '..' : node.topic}</span>
                        <span className={`text-xs ${textColor} mt-1`}>{node.mastery}%</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500/30 border border-green-500/50" /> Mastered</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500/30 border border-blue-500/50" /> Developing</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500/50" /> Struggling</span>
                </div>
              </div>
            )}

            {/* AI Practice Paper — now links to full page */}
            <div className="bg-gradient-to-r from-violet-500/10 to-blue-500/10 border border-violet-500/20 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">📝 AI Practice Paper Generator</h3>
                  <p className="text-sm text-slate-400 mt-1">Full mock exams with MCQ + short answer — AI-generated from your course topics</p>
                </div>
                <button onClick={() => window.location.href = '/practice-paper'}
                  className="bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/25 flex items-center gap-2">
                  ✨ Generate Practice Paper
                </button>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Memory Retention by Topic */}
            {retentionRates.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">🧠 Memory Retention by Topic</h3>
                <div className="space-y-3">
                  {retentionRates
                    .sort((a: any, b: any) => a.retention - b.retention)
                    .map((r: any) => {
                      const barColor = r.retention >= 75 ? '#22c55e' : r.retention >= 50 ? '#f59e0b' : '#ef4444';
                      const urgencyBadge = r.urgency === 'critical'
                        ? 'bg-red-500/20 text-red-300'
                        : r.urgency === 'review-soon'
                        ? 'bg-amber-500/20 text-amber-300'
                        : r.urgency === 'fading'
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-green-500/20 text-green-300';
                      return (
                        <div key={r.topic} className="p-3 bg-white/5 rounded-xl">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm text-slate-200 truncate flex-1">{r.topic}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${urgencyBadge}`}>{r.urgency}</span>
                              <span className="text-sm font-bold text-white w-10 text-right">{r.retention}%</span>
                            </div>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-1.5">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${r.retention}%`, backgroundColor: barColor }} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">{r.daysSinceStudied}d ago &middot; was {r.originalScore}%</span>
                            {(r.urgency === 'critical' || r.urgency === 'review-soon') && (
                              <button onClick={() => window.location.href = '/watch'} className="text-xs text-red-400 hover:text-red-300 font-medium">Review Now</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Optimal Study Time */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">🕐 Optimal Study Time</h3>
              {peakTime ? (
                <div className="mb-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <p className="text-sm text-green-300 font-medium">Peak: {peakTime.label}</p>
                  <p className="text-xs text-slate-400 mt-1">Avg score: {peakTime.avgScore}% across {peakTime.sessionCount} sessions</p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mb-3">Complete more study sessions to discover your peak time.</p>
              )}
              <div className="space-y-2">
                {optimalStudyTime.map((t: any) => {
                  const perfColor = t.performance === 'peak' ? '#22c55e' : t.performance === 'good' ? '#3b82f6' : t.performance === 'low' ? '#ef4444' : '#334155';
                  const perfBadge = t.performance === 'peak' ? 'bg-green-500/20 text-green-300' : t.performance === 'good' ? 'bg-blue-500/20 text-blue-300' : t.performance === 'low' ? 'bg-red-500/20 text-red-300' : 'bg-slate-500/20 text-slate-500';
                  return (
                    <div key={t.label} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-32 truncate">{t.label}</span>
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${t.avgScore || 0}%`, backgroundColor: perfColor }} />
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${perfBadge}`}>
                        {t.avgScore ? `${t.avgScore}%` : '--'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Goal Setting */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">🎯 Study Goals</h3>
                <button onClick={() => setShowGoalForm(!showGoalForm)} className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-1.5 rounded-lg transition-all">
                  {showGoalForm ? 'Cancel' : '+ New Goal'}
                </button>
              </div>
              {showGoalForm && (
                <div className="mb-4 p-3 bg-white/5 rounded-xl space-y-2">
                  <select value={goalForm.goalType} onChange={e => setGoalForm(f => ({ ...f, goalType: e.target.value as any }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                    <option value="score">Target Score</option>
                    <option value="hours">Study Hours</option>
                    <option value="streak">Day Streak</option>
                    <option value="topic-mastery">Topic Mastery</option>
                  </select>
                  <input type="text" placeholder="Goal description..." value={goalForm.description}
                    onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500" />
                  <div className="flex gap-2">
                    <input type="number" placeholder="Target" value={goalForm.targetValue}
                      onChange={e => setGoalForm(f => ({ ...f, targetValue: Number(e.target.value) }))}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                    {goalForm.goalType === 'topic-mastery' && (
                      <input type="text" placeholder="Topic" value={goalForm.topic}
                        onChange={e => setGoalForm(f => ({ ...f, topic: e.target.value }))}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500" />
                    )}
                  </div>
                  <button onClick={handleAddGoal} className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 rounded-lg transition-all">Save Goal</button>
                </div>
              )}
              {goals.length > 0 ? (
                <div className="space-y-2">
                  {goals.slice(0, 5).map((g: any) => {
                    const isComplete = g.status === 'completed';
                    return (
                      <div key={g.id} className={`p-3 rounded-xl ${isComplete ? 'bg-green-500/10 border border-green-500/20' : 'bg-white/5'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm ${isComplete ? 'text-green-300 line-through' : 'text-slate-200'}`}>{g.description}</span>
                          <div className="flex items-center gap-1">
                            {!isComplete && (
                              <button onClick={() => handleCompleteGoal(g.id)} className="text-xs text-green-400 hover:text-green-300 px-1">Done</button>
                            )}
                            <button onClick={() => handleDeleteGoal(g.id)} className="text-xs text-slate-500 hover:text-red-400 px-1">x</button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-white/5">{g.goalType}</span>
                          <span>Target: {g.targetValue}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-3">No goals set yet. Create one to track your progress!</p>
              )}
            </div>

            {/* Peer Comparison */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">👥 Anonymous Peer Comparison</h3>
              {data.peerComparison.cohortAvg == null || data.peerComparison.top10 == null ? (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-400">Not enough cohort data yet.</p>
                  <p className="text-xs text-slate-500 mt-1">Peer comparison will appear once more students complete quizzes.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {[
                    { label: 'Your Score', value: data.peerComparison.you, color: '#3b82f6' },
                    { label: 'Cohort Average', value: data.peerComparison.cohortAvg, color: '#6b7280' },
                    { label: 'Top 10%', value: data.peerComparison.top10, color: '#22c55e' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300">{item.label}</span>
                        <span className="font-bold text-white">{item.value}%</span>
                      </div>
                      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-500 mt-3">📊 All comparisons are anonymous. No individual data is shared.</p>
            </div>

            {/* Enhanced Burnout Detector */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">🧘 AI Burnout Analysis</h3>
                <button onClick={checkBurnout} disabled={burnoutLoading} className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-all">
                  {burnoutLoading ? '⏳ AI analyzing...' : '🔄 Check Now'}
                </button>
              </div>
              {burnoutLoading || !burnout ? (
                <div className="text-center py-6">
                  <svg className="animate-spin h-8 w-8 mx-auto text-violet-400 mb-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  <p className="text-sm text-violet-300">AI is analyzing your study patterns...</p>
                </div>
              ) : (
                <>
                  <div className={`p-4 rounded-xl border mb-3 ${burnout.riskLevel === 'low' ? 'bg-green-500/10 border-green-500/20' : burnout.riskLevel === 'moderate' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{burnout.riskLevel === 'low' ? '😊' : burnout.riskLevel === 'moderate' ? '😐' : '😰'}</span>
                      <span className={`text-sm font-bold ${burnout.riskLevel === 'low' ? 'text-green-300' : burnout.riskLevel === 'moderate' ? 'text-amber-300' : 'text-red-300'}`}>
                        {(burnout.riskLevel || 'low').charAt(0).toUpperCase() + (burnout.riskLevel || 'low').slice(1)} Risk
                      </span>
                      <span className="text-xs text-slate-400 ml-auto">Score: {burnout.riskScore || 0}/100</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${burnout.riskScore || 0}%`, backgroundColor: burnout.riskLevel === 'low' ? '#22c55e' : burnout.riskLevel === 'moderate' ? '#f59e0b' : '#ef4444' }} />
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{burnout.recommendation}</p>
                  </div>

                  {burnout.breakdown && burnout.breakdown.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-slate-400 font-medium mb-2">📊 Signal Breakdown</p>
                      <div className="space-y-2">
                        {burnout.breakdown.map((b: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${b.status === 'healthy' ? 'bg-green-400' : b.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'}`} />
                              <span className="text-xs text-slate-300">{b.signal}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400">{b.value}</span>
                              {b.points > 0 && <span className="text-xs text-red-400">+{b.points}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {burnout.schedule && (
                    <div className="mb-3 p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                      <p className="text-xs font-medium text-violet-300 mb-2">📅 AI-Suggested Schedule</p>
                      <div className="space-y-2">
                        {[
                          { icon: '🌅', label: 'Morning', value: burnout.schedule.morning },
                          { icon: '☀️', label: 'Afternoon', value: burnout.schedule.afternoon },
                          { icon: '🌆', label: 'Evening', value: burnout.schedule.evening },
                          { icon: '🌙', label: 'Night', value: burnout.schedule.night },
                        ].map((s) => (
                          <div key={s.label} className="flex items-start gap-2">
                            <span className="text-sm">{s.icon}</span>
                            <div>
                              <span className="text-xs font-medium text-slate-300">{s.label}: </span>
                              <span className="text-xs text-slate-400">{s.value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {burnout.weeklyTip && (
                    <div className="mb-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <p className="text-xs text-blue-300">💡 <span className="font-medium">Tip:</span> {burnout.weeklyTip}</p>
                    </div>
                  )}

                  {burnout.mentalHealthResources && burnout.mentalHealthResources.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-400 font-medium mb-2">🫂 NTU Support Resources</p>
                      <div className="space-y-2">
                        {burnout.mentalHealthResources.map((r: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                            <div>
                              <p className="text-xs text-slate-300">{r.name}</p>
                              <p className="text-xs text-slate-500">{r.type}</p>
                            </div>
                            <span className="text-xs text-blue-400">{r.contact}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Streak */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-3">🔥 Study Streak</h3>
              <div className="text-center">
                <div className="text-5xl font-extrabold text-amber-400 mb-2">{data.student.streak}</div>
                <p className="text-sm text-slate-400">consecutive days</p>
              </div>
              <div className="flex justify-center gap-1 mt-4">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i < data.student.streak % 7 || data.student.streak >= 7 ? 'bg-amber-500/30 text-amber-300' : 'bg-white/5 text-slate-500'}`}>{d}</div>
                ))}
              </div>
            </div>

            {/* AI Features Used */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-3">🤖 AI Features Used</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">🃏 Flashcards Generated</span>
                  <span className="text-sm font-bold text-white">{data.flashcardsGenerated}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">📝 Practice Qs Attempted</span>
                  <span className="text-sm font-bold text-white">{data.practiceQuestionsAttempted}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">😵 "I am Lost" Clicks</span>
                  <span className="text-sm font-bold text-white">{data.imLostClicks}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
