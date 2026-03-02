'use client';

import { useState } from 'react';

const mockData = {
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

function BarChart({ data, maxVal, color }) {
  const max = maxVal || Math.max(...data.map(d => d.value));
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs text-slate-400">{d.value}</span>
          <div className="w-full rounded-t-md transition-all duration-500" style={{ height: `${(d.value / max) * 100}%`, backgroundColor: color || '#3b82f6', minHeight: d.value > 0 ? '4px' : '0' }} />
          <span className="text-xs text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [data] = useState(mockData);
  const [burnout, setBurnout] = useState(data.burnout);
  const [burnoutLoading, setBurnoutLoading] = useState(false);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [practiceAnswers, setPracticeAnswers] = useState({});
  const [showPractice, setShowPractice] = useState(false);

  const checkBurnout = async () => {
    setBurnoutLoading(true);
    try {
      const res = await fetch('/api/burnout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionsThisWeek: 12, avgDurationMinutes: 120, avgSessionHour: 22, scoresTrend: [90, 85, 70], streakDays: 14, totalHoursThisWeek: 28 }),
      });
      const result = await res.json();
      const b = result || {};
      setBurnout({ riskLevel: b.riskLevel || 'low', riskScore: b.riskScore || 0, signals: b.signals || [], breakdown: b.breakdown || [], recommendation: b.recommendation || 'Your study patterns look healthy!', schedule: b.schedule || null, weeklyTip: b.weeklyTip || '', mentalHealthResources: b.mentalHealthResources || [] });
    } catch { setBurnout({ riskLevel: 'moderate', riskScore: 45, signals: ['Late night studying', 'Declining scores'], breakdown: [], recommendation: 'Consider taking a break.', schedule: null, weeklyTip: 'Try sleeping before midnight tonight.', mentalHealthResources: [] }); }
    setBurnoutLoading(false);
  };

  const generatePractice = async () => {
    setPracticeLoading(true);
    setShowPractice(true);
    try {
      const res = await fetch('/api/practice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleName: 'SC1003 Intro to Computational Thinking', weakTopics: ['Control Structures', 'Loops', 'Conditionals'], preferredFormat: 'mcq', questionCount: 5 }),
      });
      const result = await res.json();
      setPracticeQuestions(result.questions || result || []);
    } catch { setPracticeQuestions([]); }
    setPracticeLoading(false);
  };

  const totalHours = data.weeklyHours.reduce((sum, d) => sum + d.hours, 0);
  const overallProgress = Math.round(data.modules.reduce((sum, m) => sum + m.progress, 0) / data.modules.length);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-white">NTU<span className="text-blue-400">learn</span></h1>
          <div className="flex items-center gap-4">
            <button onClick={() => window.location.href = '/course'} className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition-all">Continue Learning</button>
            <button onClick={() => window.location.href = '/community'} className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition-all">💬 Community</button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">N</div>
              <span className="text-sm text-slate-300">{data.student.name}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">Welcome back, {data.student.name.split(' ')[0]}! 👋</h2>
          <p className="text-slate-400 text-sm">Learner DNA: <span className="text-violet-300 font-medium">{data.student.persona}</span></p>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Overall Progress', value: `${overallProgress}%`, icon: '📊', color: 'blue' },
            { label: 'Day Streak', value: `${data.student.streak} days`, icon: '🔥', color: 'amber' },
            { label: 'Hours This Week', value: `${totalHours.toFixed(1)}h`, icon: '⏱️', color: 'green' },
            { label: 'AI Flashcards', value: data.flashcardsGenerated, icon: '🃏', color: 'violet' },
            { label: 'Practice Qs', value: data.practiceQuestionsAttempted, icon: '📝', color: 'rose' },
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

            {/* AI Practice Paper */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">📝 AI Practice Paper Generator</h3>
                <button onClick={generatePractice} disabled={practiceLoading} className="bg-violet-500 hover:bg-violet-600 disabled:bg-violet-500/50 text-white text-sm px-4 py-2 rounded-lg transition-all">
                  {practiceLoading ? '⏳ Generating...' : '✨ Generate Practice Paper'}
                </button>
              </div>
              {showPractice && (
                <div className="space-y-4">
                  {practiceLoading ? (
                    <div className="text-center py-8">
                      <svg className="animate-spin h-8 w-8 mx-auto text-violet-400 mb-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      <p className="text-sm text-violet-300">AI is generating personalized questions based on your weak topics...</p>
                    </div>
                  ) : practiceQuestions.length > 0 ? (
                    practiceQuestions.map((q, qi) => (
                      <div key={qi} className="p-4 bg-white/5 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${q.difficulty === 'easy' ? 'bg-green-500/20 text-green-300' : q.difficulty === 'hard' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>{q.difficulty}</span>
                          <span className="text-xs text-slate-500">{q.topic}</span>
                        </div>
                        <p className="text-sm text-slate-200 mb-3">{qi + 1}. {q.question}</p>
                        {q.options && (
                          <div className="space-y-2">
                            {q.options.map((opt, oi) => (
                              <button key={oi} onClick={() => setPracticeAnswers({ ...practiceAnswers, [qi]: oi })}
                                className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${practiceAnswers[qi] === oi ? 'bg-blue-500/20 border-blue-500/50 text-blue-200' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : <p className="text-sm text-slate-400 text-center py-4">No questions generated. Try again.</p>}
                </div>
              )}
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

                  {/* Signal Breakdown */}
                  {burnout.breakdown && burnout.breakdown.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-slate-400 font-medium mb-2">📊 Signal Breakdown</p>
                      <div className="space-y-2">
                        {burnout.breakdown.map((b, i) => (
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

                  {/* AI Study Schedule */}
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

                  {/* Weekly Tip */}
                  {burnout.weeklyTip && (
                    <div className="mb-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <p className="text-xs text-blue-300">💡 <span className="font-medium">Tip:</span> {burnout.weeklyTip}</p>
                    </div>
                  )}

                  {/* Mental Health Resources */}
                  {burnout.mentalHealthResources && burnout.mentalHealthResources.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-400 font-medium mb-2">🫂 NTU Support Resources</p>
                      <div className="space-y-2">
                        {burnout.mentalHealthResources.map((r, i) => (
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
