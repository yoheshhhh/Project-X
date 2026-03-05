'use client';

import { useState } from 'react';
import { useStudentData, detectPhase } from '@/lib/useStudentData';

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
  const { dashboardData, studentData, loading: dataLoading, isRealData } = useStudentData();
  const data = dashboardData;
  const [burnout, setBurnout] = useState<any>(data.burnout);
  const [burnoutLoading, setBurnoutLoading] = useState(false);

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

  const overallProgress = Math.round(data.modules.reduce((sum, m) => sum + m.progress, 0) / data.modules.length);

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

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Overall Progress', value: `${overallProgress}%`, icon: '📊' },
            { label: 'Day Streak', value: `${data.student.streak} days`, icon: '🔥' },
            { label: 'Hours This Week', value: `${totalHours.toFixed(1)}h`, icon: '⏱️' },
            { label: 'AI Flashcards', value: data.flashcardsGenerated, icon: '🃏' },
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
            </div>

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
            {/* Peer Comparison */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">👥 Anonymous Peer Comparison</h3>
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
              {burnoutLoading ? (
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
