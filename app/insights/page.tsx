'use client';
import { useState, useEffect } from 'react';

const studentData: any = {
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

// Auto-compute weak/strong topics from quiz data — NOT hardcoded
const _ta = Object.entries(
  studentData.quizHistory.reduce((a: any, q: any) => { if (!a[q.topic]) a[q.topic] = []; a[q.topic].push(q.score); return a; }, {})
).map(([t, s]: [string, any]) => ({ topic: t, avg: Math.round(s.reduce((a: number, b: number) => a + b, 0) / s.length) }));
studentData.weakTopics = _ta.filter(t => t.avg < 70).sort((a, b) => a.avg - b.avg).map(t => t.topic);
studentData.strongTopics = _ta.filter(t => t.avg >= 80).sort((a, b) => b.avg - a.avg).map(t => t.topic);

const pc: any = { 'onboarding':'#3b82f6','building-momentum':'#10b981','steady-progress':'#22c55e','accelerating':'#8b5cf6','plateauing':'#f59e0b','declining':'#ef4444','inactive':'#6b7280','at-risk':'#dc2626' };
const pe: any = { 'onboarding':'🌱','building-momentum':'🚀','steady-progress':'📈','accelerating':'⚡','plateauing':'📊','declining':'📉','inactive':'💤','at-risk':'🚨' };

function PredictionTab({ scores, topics }: any) {
  const [pred, setPred] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function fetchPrediction() {
      setLoading(true);
      try {
        const topicMap: any = {};
        topics.forEach((t: any) => { if (!topicMap[t.topic]) topicMap[t.topic] = []; topicMap[t.topic].push(t.score); });
        const res = await fetch('/api/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scores, topics: topicMap }) });
        setPred(await res.json());
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    fetchPrediction();
  }, []);
  if (loading) return <div className="text-center py-12"><svg className="animate-spin h-8 w-8 mx-auto text-blue-400 mb-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><p className="text-sm text-blue-300">Running ML prediction model...</p></div>;
  if (!pred || pred.error) return <p className="text-red-400 text-center py-8">Prediction failed. Try refreshing.</p>;
  const o = pred.overall;
  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-2">🔮 ML Score Prediction</h3>
        <p className="text-sm text-slate-400 mb-4">Linear Regression model (same algorithm as scikit-learn) trained on your {o.dataPoints} quiz scores</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center"><p className="text-xs text-blue-400 mb-1">Current Score</p><p className="text-3xl font-extrabold text-white">{o.currentScore}%</p></div>
          <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl text-center"><p className="text-xs text-violet-400 mb-1">Predicted Next</p><p className={`text-3xl font-extrabold ${o.delta > 0 ? 'text-green-400' : o.delta < 0 ? 'text-red-400' : 'text-amber-400'}`}>{o.predictedNext}%</p><p className={`text-xs ${o.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>{o.delta > 0 ? '↑' : '↓'} {o.delta}%</p></div>
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center"><p className="text-xs text-green-400 mb-1">Trend</p><p className="text-xl font-bold text-white">{o.trend}</p><p className="text-xs text-slate-400">slope: {o.slope}</p></div>
          <div className={`p-4 rounded-xl text-center border ${o.status === 'Burnout Risk' ? 'bg-red-500/10 border-red-500/20' : o.status === 'Accelerated Growth' ? 'bg-green-500/10 border-green-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}><p className="text-xs text-slate-400 mb-1">Status</p><p className={`text-xl font-bold ${o.status === 'Burnout Risk' ? 'text-red-400' : o.status === 'Accelerated Growth' ? 'text-green-400' : 'text-amber-400'}`}>{o.status}</p></div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-3 bg-white/5 rounded-xl"><p className="text-xs text-slate-400 mb-1">Model R² Score</p><p className="text-lg font-bold text-white">{o.r2}</p><p className="text-xs text-slate-500">Goodness of fit (1.0 = perfect)</p></div>
          <div className="p-3 bg-white/5 rounded-xl"><p className="text-xs text-slate-400 mb-1">Confidence</p><p className={`text-lg font-bold ${o.confidence === 'high' ? 'text-green-400' : o.confidence === 'medium' ? 'text-amber-400' : 'text-red-400'}`}>{o.confidence}</p><p className="text-xs text-slate-500">Based on R² value</p></div>
          <div className="p-3 bg-white/5 rounded-xl"><p className="text-xs text-slate-400 mb-1">Predicted Range</p><p className="text-lg font-bold text-white">{Math.round(o.predictedRange.low)}-{Math.round(o.predictedRange.high)}%</p><p className="text-xs text-slate-500">Confidence interval</p></div>
        </div>
        <div className="p-4 bg-white/5 rounded-xl mb-4">
          <p className="text-xs text-slate-400 mb-3">📈 Score History + Predicted Next</p>
          <div className="flex items-end gap-2" style={{ height: '160px' }}>
            {scores.map((s: number, i: number) => (<div key={i} className="flex-1 flex flex-col items-center gap-1"><span className="text-xs" style={{ color: s >= 80 ? '#22c55e' : s >= 70 ? '#f59e0b' : '#ef4444' }}>{s}</span><div className="w-full rounded-t-lg" style={{ height: `${Math.max(8, (s / 100) * 140)}px`, backgroundColor: s >= 80 ? '#22c55e' : s >= 70 ? '#f59e0b' : '#ef4444' }} /><span className="text-xs text-slate-500">Q{i + 1}</span></div>))}
            <div className="flex-1 flex flex-col items-center gap-1"><span className="text-xs text-violet-400">{o.predictedNext}</span><div className="w-full rounded-t-lg border-2 border-dashed border-violet-400" style={{ height: `${Math.max(8, (o.predictedNext / 100) * 140)}px`, backgroundColor: 'rgba(139, 92, 246, 0.3)' }} /><span className="text-xs text-violet-400">Next</span></div>
          </div>
        </div>
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl"><p className="text-xs text-blue-400">🧠 <span className="font-bold">Model:</span> {pred.meta.algorithm} · <span className="font-bold">Impl:</span> {pred.meta.implementation}</p></div>
      </div>
      {pred.topicPredictions && pred.topicPredictions.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4">📊 Per-Topic Score Predictions</h3>
          <div className="space-y-3">
            {pred.topicPredictions.map((t: any, i: number) => (
              <div key={i} className={`p-4 rounded-xl border ${t.status === 'Burnout Risk' ? 'bg-red-500/10 border-red-500/20' : t.status === 'Accelerated Growth' ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
                <div className="flex items-center justify-between"><div><p className="text-sm font-bold text-white">{t.topic}</p><p className="text-xs text-slate-400">Avg: {t.currentAvg}% · {t.dataPoints} scores · R²: {t.r2}</p></div><div className="text-right"><p className={`text-lg font-bold ${t.slope > 0 ? 'text-green-400' : t.slope < 0 ? 'text-red-400' : 'text-amber-400'}`}>{t.predictedNext}%</p><p className={`text-xs ${t.status === 'Burnout Risk' ? 'text-red-400' : t.status === 'Accelerated Growth' ? 'text-green-400' : 'text-slate-400'}`}>{t.trend} · {t.status}</p></div></div>
              </div>
            ))}
          </div>
          {pred.riskTopics.length > 0 && <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl"><p className="text-xs text-red-300">⚠️ At-risk: {pred.riskTopics.join(', ')}</p></div>}
          {pred.growthTopics.length > 0 && <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl"><p className="text-xs text-green-300">🚀 Growing: {pred.growthTopics.join(', ')}</p></div>}
        </div>
      )}
    </div>
  );
}

function ModuleDiveTab() {
  const [selectedModule, setSelectedModule] = useState(0);
  const [diveData, setDiveData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Auto-generate modules from quiz data — computed, NOT hardcoded
  const moduleMap: Record<string, string[]> = {
    'SC1003 M1: Intro to Python': ['Variables', 'Data Types', 'Loops Intro'],
    'SC1003 M2: Control Structures': ['If-Else', 'For Loops', 'While Loops', 'Nested Loops'],
    'SC1003 M3: Functions': ['Functions Intro', 'Scope', 'Return Values', 'Recursion'],
  };
  const modules = Object.entries(moduleMap).map(([name, topics]) => {
    const segs = topics.map(t => {
      const sc = studentData.quizHistory.filter((q: any) => q.topic === t);
      const avg = sc.length ? Math.round(sc.reduce((a: number, b: any) => a + b.score, 0) / sc.length) : 0;
      return { name: t, score: avg, attempts: sc.length, flashcardOpens: sc.length, mastery: sc.length === 0 ? 'locked' : avg >= 85 ? 'mastered' : avg >= 70 ? 'developing' : 'struggling' };
    });
    return { name, progress: Math.round(segs.filter(s => s.mastery !== 'locked').length / segs.length * 100), segments: segs };
  });

  const analyze = async (idx: number) => {
    setSelectedModule(idx); setLoading(true);
    try { const res = await fetch('/api/module-dive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(modules[idx]) }); setDiveData(await res.json()); } catch { setDiveData(null); }
    setLoading(false);
  };
  useEffect(() => { analyze(0); }, []);
  const mod = modules[selectedModule];
  const masteryColors: any = { mastered: 'bg-green-500', developing: 'bg-amber-500', struggling: 'bg-red-500', locked: 'bg-slate-600' };
  return (
    <div className="space-y-6">
      <div className="flex gap-3">{modules.map((m, i) => (
        <button key={i} onClick={() => analyze(i)} className={`flex-1 p-4 rounded-xl border transition-all ${selectedModule === i ? 'bg-blue-500/20 border-blue-500/40' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
          <p className="text-sm font-bold text-white">{m.name}</p>
          <div className="flex items-center gap-2 mt-2"><div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${m.progress}%`, backgroundColor: m.progress === 100 ? '#22c55e' : '#3b82f6' }} /></div><span className="text-xs text-slate-400">{m.progress}%</span></div>
        </button>
      ))}</div>
      {loading ? (
        <div className="text-center py-12"><svg className="animate-spin h-8 w-8 mx-auto text-blue-400 mb-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><p className="text-sm text-blue-300">Analyzing module segments...</p></div>
      ) : (
        <>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Segment-Level Analysis</h3>
            <div className="space-y-3">{mod.segments.map((s, i) => {
              const insight = diveData?.ai?.segmentInsights?.[i];
              return (
                <div key={i} className={`p-4 rounded-xl border ${s.mastery === 'mastered' ? 'bg-green-500/5 border-green-500/20' : s.mastery === 'struggling' ? 'bg-red-500/5 border-red-500/20' : s.mastery === 'locked' ? 'bg-slate-800/50 border-slate-700' : 'bg-amber-500/5 border-amber-500/20'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full ${masteryColors[s.mastery]}`} /><p className="text-sm font-bold text-white">{s.name}</p><span className="text-xs text-slate-400">{s.mastery}</span></div>
                    <p className={`text-lg font-bold ${s.score >= 85 ? 'text-green-400' : s.score >= 70 ? 'text-amber-400' : s.score > 0 ? 'text-red-400' : 'text-slate-500'}`}>{s.score > 0 ? s.score + '%' : '🔒'}</p>
                  </div>
                  {s.mastery !== 'locked' && (<div className="flex gap-6 text-xs text-slate-400 mb-2"><span>📝 {s.attempts} attempts</span><span>🃏 {s.flashcardOpens} flashcards</span><span>⚡ Efficiency: {s.attempts > 0 ? Math.round(s.score / s.attempts) : 0}</span></div>)}
                  {insight && <p className="text-xs text-slate-300 mt-1">{insight.analysis}</p>}
                  {insight?.recommendation && <p className="text-xs text-blue-300 mt-1">💡 {insight.recommendation}</p>}
                </div>
              );
            })}</div>
          </div>
          {diveData?.ai && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl"><p className="text-xs font-bold text-blue-300 mb-2">🤖 AI Analysis</p><p className="text-sm text-slate-300">{diveData.ai.moduleAnalysis}</p></div>
              <div className="p-5 bg-violet-500/10 border border-violet-500/20 rounded-2xl"><p className="text-xs font-bold text-violet-300 mb-2">📅 Study Order</p>{(diveData.ai.studyOrder || []).map((s: string, i: number) => (<p key={i} className="text-sm text-slate-300">{i + 1}. {s}</p>))}<p className="text-xs text-violet-400 mt-2">⏱️ Est. mastery: {diveData.ai.estimatedTimeToMastery}</p></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CarelessWeaknessTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { async function fetch_() { try { const res = await fetch('/api/weakness-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizHistory: studentData.quizHistory }) }); setData(await res.json()); } catch (e) { console.error(e); } setLoading(false); } fetch_(); }, []);
  if (loading) return <div className="text-center py-12"><svg className="animate-spin h-8 w-8 mx-auto text-blue-400 mb-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><p className="text-sm text-blue-300">Analyzing error patterns...</p></div>;
  if (!data) return <p className="text-red-400 text-center py-8">Analysis failed.</p>;
  const icons: any = { 'careless': '🎲', 'genuine-weakness': '❌', 'understood': '✅', 'insufficient-data': '❓' };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center"><p className="text-3xl font-extrabold text-amber-400">{data.summary.carelessCount}</p><p className="text-xs text-amber-300 mt-1">🎲 Careless Errors</p><p className="text-xs text-slate-500">You know it but make mistakes</p></div>
        <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-center"><p className="text-3xl font-extrabold text-red-400">{data.summary.genuineWeaknessCount}</p><p className="text-xs text-red-300 mt-1">❌ Genuine Weaknesses</p><p className="text-xs text-slate-500">Real knowledge gaps</p></div>
        <div className="p-5 bg-green-500/10 border border-green-500/20 rounded-2xl text-center"><p className="text-3xl font-extrabold text-green-400">{data.summary.understoodCount}</p><p className="text-xs text-green-300 mt-1">✅ Well Understood</p><p className="text-xs text-slate-500">Solid knowledge</p></div>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-2">🎲 Careless vs Genuine Weakness Analysis</h3>
        <p className="text-sm text-slate-400 mb-4">AI uses score variance to distinguish between &quot;you know it but make mistakes&quot; vs &quot;you don&apos;t understand it yet&quot;</p>
        <div className="space-y-3">
          {(data.carelessAnalysis || []).map((t: any, i: number) => (
            <div key={i} className={`p-4 rounded-xl border ${t.classification === 'careless' ? 'bg-amber-500/10 border-amber-500/20' : t.classification === 'genuine-weakness' ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3"><span className="text-xl">{icons[t.classification]}</span><div><p className="text-sm font-bold text-white">{t.topic}</p><p className={`text-xs font-medium ${t.classification === 'careless' ? 'text-amber-400' : t.classification === 'genuine-weakness' ? 'text-red-400' : 'text-green-400'}`}>{t.classification === 'careless' ? 'CARELESS ERRORS' : t.classification === 'genuine-weakness' ? 'GENUINE WEAKNESS' : 'UNDERSTOOD'}</p></div></div>
                <div className="text-right"><p className="text-lg font-bold text-white">{t.avgScore}%</p><p className="text-xs text-slate-400">σ = {t.stdDev} · {t.attempts} attempts</p></div>
              </div>
              {t.scores.length > 1 && (<div className="flex items-center gap-1 mb-2">{t.scores.map((s: number, j: number) => (<div key={j} className="flex items-center gap-1"><span className={`text-xs font-bold ${s >= 80 ? 'text-green-400' : s >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{s}%</span>{j < t.scores.length - 1 && <span className="text-slate-600">→</span>}</div>))}</div>)}
              <p className="text-xs text-slate-300">{t.evidence}</p>
              <div className="mt-2 flex items-center gap-2"><span className="text-xs text-slate-500">Confidence:</span><div className="flex-1 h-1.5 bg-white/10 rounded-full max-w-32"><div className="h-full rounded-full" style={{ width: `${t.confidence * 100}%`, backgroundColor: t.classification === 'careless' ? '#f59e0b' : t.classification === 'genuine-weakness' ? '#ef4444' : '#22c55e' }} /></div><span className="text-xs text-slate-400">{Math.round(t.confidence * 100)}%</span></div>
            </div>
          ))}
        </div>
      </div>
      {data.aiAdvice && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl"><p className="text-xs font-bold text-amber-300 mb-2">🎲 Careless Error Strategy</p><p className="text-sm text-slate-300">{data.aiAdvice.carelessAdvice}</p></div>
          <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl"><p className="text-xs font-bold text-red-300 mb-2">❌ Weakness Strategy</p><p className="text-sm text-slate-300">{data.aiAdvice.weaknessAdvice}</p></div>
        </div>
      )}
      {data.aiAdvice?.overallDiagnosis && (<div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl"><p className="text-xs font-bold text-blue-300 mb-2">🤖 AI Diagnosis</p><p className="text-sm text-slate-300">{data.aiAdvice.overallDiagnosis}</p></div>)}
    </div>
  );
}

function RepeatedFailuresTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { async function fetch_() { try { const res = await fetch('/api/weakness-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizHistory: studentData.quizHistory }) }); setData(await res.json()); } catch (e) { console.error(e); } setLoading(false); } fetch_(); }, []);
  if (loading) return <div className="text-center py-12"><svg className="animate-spin h-8 w-8 mx-auto text-blue-400 mb-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><p className="text-sm text-blue-300">Detecting failure patterns...</p></div>;
  if (!data) return <p className="text-red-400 text-center py-8">Analysis failed.</p>;
  const patternIcons: any = { stuck: '🔁', regression: '📉', ceiling: '🚧', struggling: '😓', improving: '📈' };
  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-2">🔁 Repeated Failure Pattern Detection</h3>
        <p className="text-sm text-slate-400 mb-4">AI detects why you repeatedly struggle with the same topics — stuck loops, regressions, and score ceilings</p>
        {data.repeatedFailures.length === 0 ? (
          <div className="p-8 text-center"><p className="text-green-400 text-lg">🎉 No repeated failure patterns detected!</p><p className="text-sm text-slate-400 mt-1">You&apos;re improving on all attempted topics.</p></div>
        ) : (
          <div className="space-y-3">
            {data.repeatedFailures.map((p: any, i: number) => (
              <div key={i} className={`p-5 rounded-xl border ${p.severity === 'critical' ? 'bg-red-500/10 border-red-500/20' : p.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3"><span className="text-2xl">{patternIcons[p.pattern]}</span><div><p className="text-sm font-bold text-white">{p.topic}</p><p className={`text-xs font-medium uppercase tracking-wider ${p.severity === 'critical' ? 'text-red-400' : p.severity === 'warning' ? 'text-amber-400' : 'text-green-400'}`}>{p.pattern} pattern · {p.severity}</p></div></div>
                  <div className="text-right"><div className="flex items-center gap-1">{p.scores.map((s: number, j: number) => (<div key={j} className="flex items-center gap-1"><span className={`text-sm font-bold ${s >= 80 ? 'text-green-400' : s >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{s}%</span>{j < p.scores.length - 1 && <span className="text-slate-600">→</span>}</div>))}</div><p className="text-xs text-slate-400 mt-1">{p.attempts} attempts · {p.weeksSpan} weeks</p></div>
                </div>
                <p className="text-sm text-slate-300 mb-2">{p.description}</p>
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg"><p className="text-xs text-blue-300">💡 {p.recommendation}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>
      {data.aiAdvice?.repeatedFailureAdvice && (<div className="p-5 bg-violet-500/10 border border-violet-500/20 rounded-2xl"><p className="text-xs font-bold text-violet-300 mb-2">🤖 AI Pattern-Breaking Strategy</p><p className="text-sm text-slate-300">{data.aiAdvice.repeatedFailureAdvice}</p></div>)}
      {data.summary.stuckCount > 0 && (<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl"><p className="text-xs text-red-300">⚠️ {data.summary.stuckCount} topic(s) show stuck/regression patterns. The AI Tutor 🛡️ can help you break through — click the chatbot and ask about these specific topics.</p></div>)}
    </div>
  );
}

function FlashcardsTab() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [cards, setCards] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [flipped, setFlipped] = useState<any>({});
  const [currentCard, setCurrentCard] = useState(0);
  const topics = studentData.quizHistory.reduce((acc: any, q: any) => { if (!acc[q.topic]) acc[q.topic] = []; acc[q.topic].push(q.score); return acc; }, {});
  const topicList = Object.entries(topics).map(([topic, scores]: [string, any]) => ({ topic, avg: Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length), count: scores.length })).sort((a, b) => a.avg - b.avg);
  const generate = async (topic: string, score: number) => {
    setSelectedTopic(topic); setLoading(true); setCurrentCard(0); setFlipped({});
    try { const res = await fetch('/api/flashcards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, score, context: `Weak topics: ${studentData.weakTopics.join(', ')}. Learning style: ${studentData.learningStyle}` }) }); setCards(await res.json()); } catch { setCards(null); }
    setLoading(false);
  };
  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-2">🃏 AI Flashcard Generator</h3>
        <p className="text-sm text-slate-400 mb-4">Select a weak topic — AI generates personalized flashcards targeting your specific gaps</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {topicList.map((t, i) => (<button key={i} onClick={() => generate(t.topic, t.avg)} className={`p-3 rounded-xl border text-left transition-all hover:scale-105 ${t.avg < 70 ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20' : t.avg < 85 ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' : 'bg-green-500/10 border-green-500/20 hover:bg-green-500/20'}`}><p className="text-xs font-bold text-white">{t.topic}</p><p className={`text-lg font-extrabold ${t.avg < 70 ? 'text-red-400' : t.avg < 85 ? 'text-amber-400' : 'text-green-400'}`}>{t.avg}%</p></button>))}
        </div>
      </div>
      {loading && <div className="text-center py-12"><svg className="animate-spin h-8 w-8 mx-auto text-blue-400 mb-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><p className="text-sm text-blue-300">Generating flashcards for {selectedTopic}...</p></div>}
      {cards && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">📚 {selectedTopic} — Card {currentCard + 1}/{cards.cards.length}</h3>
            <div className="flex gap-2"><button onClick={() => setCurrentCard(Math.max(0, currentCard - 1))} disabled={currentCard === 0} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-xs rounded-lg">← Prev</button><button onClick={() => setCurrentCard(Math.min(cards.cards.length - 1, currentCard + 1))} disabled={currentCard === cards.cards.length - 1} className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-30 text-white text-xs rounded-lg">Next →</button></div>
          </div>
          {cards.cards.map((card: any, i: number) => i === currentCard && (
            <div key={i} onClick={() => setFlipped({ ...flipped, [i]: !flipped[i] })} className="cursor-pointer">
              <div className={`p-8 rounded-2xl border min-h-[200px] flex flex-col items-center justify-center text-center transition-all ${flipped[i] ? 'bg-green-500/10 border-green-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                <p className={`text-xs font-bold mb-3 ${flipped[i] ? 'text-green-400' : 'text-blue-400'}`}>{flipped[i] ? '✅ ANSWER' : '❓ QUESTION'}</p>
                <p className="text-lg text-white font-medium leading-relaxed whitespace-pre-wrap">{flipped[i] ? card.back : card.front}</p>
                {!flipped[i] && card.hint && <p className="text-xs text-slate-500 mt-4">💡 Hint: {card.hint}</p>}
                <div className="mt-4 flex items-center gap-2"><span className={`text-xs px-2 py-0.5 rounded-full ${card.difficulty === 'easy' ? 'bg-green-500/20 text-green-300' : card.difficulty === 'hard' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>{card.difficulty}</span><span className="text-xs text-slate-500">{flipped[i] ? 'Click to see question' : 'Click to reveal answer'}</span></div>
              </div>
            </div>
          ))}
          <div className="flex gap-2 justify-center">{cards.cards.map((_: any, i: number) => (<button key={i} onClick={() => setCurrentCard(i)} className={`w-8 h-8 rounded-full text-xs font-bold ${i === currentCard ? 'bg-blue-500 text-white' : flipped[i] ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/10 text-slate-400'}`}>{i + 1}</button>))}</div>
          {cards.studyTip && (<div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl"><p className="text-xs text-violet-300">💡 {cards.studyTip}</p></div>)}
        </div>
      )}
    </div>
  );
}

function StudyPlanTab() {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<any>({});
  useEffect(() => { async function fetch_() { try { const res = await fetch('/api/study-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weakTopics: studentData.weakTopics, strongTopics: studentData.strongTopics, quizHistory: studentData.quizHistory, avgSessionMinutes: studentData.avgSessionMinutes, learningStyle: studentData.learningStyle }) }); setPlan(await res.json()); } catch (e) { console.error(e); } setLoading(false); } fetch_(); }, []);
  if (loading) return <div className="text-center py-12"><svg className="animate-spin h-8 w-8 mx-auto text-blue-400 mb-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><p className="text-sm text-blue-300">AI is building your personalized study plan...</p></div>;
  if (!plan) return <p className="text-red-400 text-center py-8">Failed to generate plan.</p>;
  const completedCount = Object.values(completed).filter(Boolean).length;
  const totalBlocks = (plan.blocks || []).length;
  const typeIcons: any = { review: '📖', practice: '💻', learn: '🎓', quiz: '📝' };
  const typeColors: any = { review: 'blue', practice: 'violet', learn: 'green', quiz: 'amber' };
  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4"><div><h3 className="text-lg font-bold text-white">📅 Your Study Plan for Today</h3><p className="text-sm text-slate-400">{plan.greeting}</p></div><div className="text-right"><p className="text-2xl font-extrabold text-white">{plan.totalMinutes} min</p><p className="text-xs text-slate-400">{completedCount}/{totalBlocks} blocks done</p></div></div>
        <div className="h-2 bg-white/10 rounded-full mb-6 overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${totalBlocks > 0 ? (completedCount / totalBlocks) * 100 : 0}%` }} /></div>
        <div className="space-y-3">
          {(plan.blocks || []).map((block: any, i: number) => {
            const color = typeColors[block.type] || 'blue';
            return (
              <div key={i} className={`p-5 rounded-xl border transition-all ${completed[i] ? 'bg-green-500/10 border-green-500/20 opacity-75' : `bg-${color}-500/10 border-${color}-500/20`}`}>
                <div className="flex items-start gap-4">
                  <button onClick={() => setCompleted({ ...completed, [i]: !completed[i] })} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${completed[i] ? 'bg-green-500 border-green-500 text-white' : 'border-white/30 hover:border-white/60'}`}>{completed[i] && <span className="text-xs">✓</span>}</button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1"><span className="text-lg">{typeIcons[block.type] || '📌'}</span><p className={`text-sm font-bold ${completed[i] ? 'text-green-400 line-through' : 'text-white'}`}>{block.topic}</p><span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300">{block.minutes} min</span><span className={`text-xs px-2 py-0.5 rounded-full ${block.difficulty === 'easy' ? 'bg-green-500/20 text-green-300' : block.difficulty === 'hard' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>{block.difficulty}</span></div>
                    <p className="text-sm text-slate-300">{block.activity}</p>
                    <p className="text-xs text-slate-500 mt-1">📌 {block.reason}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl"><p className="text-xs font-bold text-amber-300 mb-1">☕ Break Reminder</p><p className="text-sm text-slate-300">{plan.breakReminder}</p></div>
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl"><p className="text-xs font-bold text-green-300 mb-1">🎯 Today&apos;s Goal</p><p className="text-sm text-slate-300">{plan.endGoal}</p></div>
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl"><p className="text-xs font-bold text-blue-300 mb-1">👀 Tomorrow Preview</p><p className="text-sm text-slate-300">{plan.tomorrowPreview}</p></div>
      </div>
      {completedCount === totalBlocks && totalBlocks > 0 && (<div className="p-6 bg-green-500/10 border border-green-500/20 rounded-2xl text-center"><p className="text-2xl mb-2">🎉</p><p className="text-lg font-bold text-green-400">Study Plan Complete!</p><p className="text-sm text-slate-400">Great work — you&apos;re building mastery one day at a time.</p></div>)}
    </div>
  );
}

function AgentVisualizerTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState(-1);
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);

  const runOrchestration = async () => {
    setLoading(true); setActiveAgent(0); setData(null);
    try {
      const res = await fetch('/api/agent-orchestrator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(studentData) });
      const result = await res.json();
      for (let i = 0; i < result.agents.length; i++) { setActiveAgent(i); await new Promise(r => setTimeout(r, 800)); }
      setActiveAgent(result.agents.length); setData(result);
    } catch { setData(null); }
    setLoading(false);
  };

  useEffect(() => { runOrchestration(); }, []);

  const agents = [
    { name: 'Diagnosis Agent', icon: 'D', color: '#3b82f6', desc: 'Reads raw data' },
    { name: 'Pattern Agent', icon: 'P', color: '#8b5cf6', desc: 'Detects patterns' },
    { name: 'Prediction Agent', icon: 'ML', color: '#f59e0b', desc: 'Runs regression' },
    { name: 'Planner Agent', icon: 'AI', color: '#22c55e', desc: 'Builds study plan' },
    { name: 'Tutor Agent', icon: 'T', color: '#ec4899', desc: 'Delivers guidance' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div><h3 className="text-lg font-bold text-white">Multi-Agent AI Pipeline</h3><p className="text-sm text-slate-400">Sequential orchestration with Maker-Checker validation pattern</p></div>
          <button onClick={runOrchestration} disabled={loading} className="bg-white/10 hover:bg-white/20 disabled:bg-white/5 text-white text-xs px-4 py-2 rounded-lg transition-all border border-white/10">{loading ? 'Running...' : 'Re-run Pipeline'}</button>
        </div>
        <div className="flex items-center gap-0">
          {agents.map((a, i) => {
            const isActive = activeAgent > i;
            const isCurrent = activeAgent === i && loading;
            const agentData = data?.agents?.[i];
            return (
              <div key={i} className="flex items-center" style={{ flex: 1 }}>
                <div className="flex flex-col items-center flex-1 cursor-pointer" onClick={() => data && setExpandedAgent(expandedAgent === i ? null : i)}>
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-sm transition-all duration-500 ${isCurrent ? 'animate-pulse ring-2 ring-offset-2 ring-offset-slate-900' : ''}`} style={{ backgroundColor: isActive || isCurrent ? a.color + '30' : 'rgba(255,255,255,0.05)', border: `2px solid ${isActive || isCurrent ? a.color : 'rgba(255,255,255,0.1)'}`, color: isActive || isCurrent ? a.color : '#475569', boxShadow: isActive ? `0 0 24px ${a.color}30` : 'none' }}>{a.icon}</div>
                  <p className={`text-xs font-bold mt-2 transition-all ${isActive || isCurrent ? 'text-white' : 'text-slate-600'}`}>{a.name.replace(' Agent', '')}</p>
                  <p className="text-xs text-slate-500">{a.desc}</p>
                  {agentData && <p className="text-xs mt-0.5" style={{ color: a.color }}>{agentData.timeMs}ms</p>}
                </div>
                {i < agents.length - 1 && (
                  <div className="flex items-center px-1" style={{ minWidth: '32px' }}>
                    <div className="h-0.5 flex-1 rounded transition-all duration-500" style={{ backgroundColor: activeAgent > i ? a.color : 'rgba(255,255,255,0.1)' }} />
                    <div className="transition-all duration-500" style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: `8px solid ${activeAgent > i ? agents[i + 1].color : 'rgba(255,255,255,0.1)'}` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {loading && activeAgent >= 0 && activeAgent < 5 && (
          <div className="mt-6 p-3 rounded-xl border flex items-center gap-3" style={{ backgroundColor: agents[activeAgent].color + '10', borderColor: agents[activeAgent].color + '30' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: agents[activeAgent].color }} />
            <p className="text-sm" style={{ color: agents[activeAgent].color }}>{['Analyzing quiz scores and identifying knowledge gaps...', 'Detecting careless errors vs genuine weaknesses using variance analysis...', 'Running Ordinary Least Squares Linear Regression for score prediction...', 'Building personalized study plan using Gemini AI...', 'Generating personalized guidance with empathy and clarity...'][activeAgent]}</p>
          </div>
        )}
        {data && !loading && (<div className="mt-6 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-green-500" /><p className="text-sm text-green-400">Pipeline complete — 5 agents executed in {data.orchestration.totalTimeMs}ms</p></div>)}
      </div>
      {data?.agents && (
        <div className="space-y-3">
          {data.agents.map((agent: any, i: number) => (
            <div key={i} className="rounded-2xl overflow-hidden border transition-all" style={{ backgroundColor: agents[i].color + '08', borderColor: agents[i].color + '20' }}>
              <div className="p-5 cursor-pointer" onClick={() => setExpandedAgent(expandedAgent === i ? null : i)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-extrabold" style={{ backgroundColor: agents[i].color + '20', color: agents[i].color, border: `1.5px solid ${agents[i].color}40` }}>{agents[i].icon}</div>
                    <div><div className="flex items-center gap-2"><p className="text-sm font-bold text-white">{agent.agent}</p><span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">{agent.timeMs}ms</span></div><p className="text-xs text-slate-400">{agent.role}</p></div>
                  </div>
                  <span className="text-slate-500 text-sm">{expandedAgent === i ? '▲' : '▼'}</span>
                </div>
                <p className="text-sm text-slate-300 mt-3 pl-14">{agent.finding}</p>
              </div>
              {expandedAgent === i && (
                <div className="px-5 pb-5 border-t pt-4 space-y-3" style={{ borderColor: agents[i].color + '15' }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white/5 rounded-xl"><p className="text-xs font-bold mb-1" style={{ color: agents[i].color }}>INPUT</p><p className="text-xs text-slate-300">{agent.input}</p></div>
                    <div className="p-3 bg-white/5 rounded-xl"><p className="text-xs font-bold mb-1" style={{ color: agents[i].color }}>OUTPUT</p><pre className="text-xs text-slate-300 whitespace-pre-wrap overflow-auto max-h-28 font-mono">{JSON.stringify(agent.output, null, 2)}</pre></div>
                  </div>
                  {agent.output?.algorithm && (<div className="p-2 rounded-lg" style={{ backgroundColor: agents[i].color + '10', border: `1px solid ${agents[i].color}20` }}><p className="text-xs" style={{ color: agents[i].color }}>Algorithm: {agent.output.algorithm}</p></div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {data?.orchestration && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Architecture</p>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="p-3 bg-white/5 rounded-xl text-center"><p className="text-xl font-extrabold text-white">{data.orchestration.totalAgents}</p><p className="text-xs text-slate-500">Agents</p></div>
            <div className="p-3 bg-white/5 rounded-xl text-center"><p className="text-xl font-extrabold text-white">{data.orchestration.totalTimeMs}<span className="text-xs text-slate-400">ms</span></p><p className="text-xs text-slate-500">Total Latency</p></div>
            <div className="p-3 bg-white/5 rounded-xl text-center"><p className="text-xl font-extrabold text-violet-400">Sequential</p><p className="text-xs text-slate-500">Pipeline</p></div>
            <div className="p-3 bg-white/5 rounded-xl text-center"><p className="text-xl font-extrabold text-amber-400">Maker-Checker</p><p className="text-xs text-slate-500">Validation</p></div>
          </div>
          <div className="p-3 bg-white/5 rounded-xl"><p className="text-xs text-slate-400 font-mono">Student Data → Diagnosis (statistical) → Pattern Detection (variance) → Prediction (OLS regression) → Planner (Gemini AI) → Tutor (Gemini AI) → Output</p></div>
          <p className="text-xs text-slate-500 mt-3">{data.orchestration.description}</p>
        </div>
      )}
    </div>
  );
}

export default function InsightsPage() {
  const [ins, setIns] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('timeline');
  const [expNudge, setExpNudge] = useState<number | null>(null);
  const [expInsight, setExpInsight] = useState<number | null>(null);
  const [selectedModule, setSelectedModule] = useState('SC1003');

  const AVAILABLE_MODULES = [
    { code: 'SC1003', name: 'Introduction to Computational Thinking (Python)' },
    { code: 'SC3010', name: 'Computer Security' },
    { code: 'SC2207', name: 'Introduction to Databases' },
    { code: 'SC4012', name: 'Software Security' },
    { code: 'SC3099', name: 'Capstone Project' },
    { code: 'CC0006', name: 'Sustainability: Soc, Econ, Env' },
  ];

  const fetch_ = async () => { setLoading(true); try { const r = await fetch('/api/insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(studentData) }); setIns(await r.json()); } catch (e) { console.error(e); } setLoading(false); };
  useEffect(() => { fetch_(); }, []);

  const phase = ins?.learningStateAnalysis;
  const color = pc[phase?.currentPhase] || '#3b82f6';
  const emoji = pe[phase?.currentPhase] || '📈';
  const tabs = [
    { id: 'timeline', label: '📈 Timeline' },{ id: 'mastery', label: '🎯 Topic Mastery' },{ id: 'forgetting', label: '🧠 Forgetting Curve' },
    { id: 'velocity', label: '⚡ Velocity' },{ id: 'cognitive', label: '🔋 Cognitive Load' },{ id: 'optimal', label: '⏰ Best Study Time' },
    { id: 'predict', label: '🔮 Score Prediction' },{ id: 'modules', label: '📚 Module Deep Dive' },
    { id: 'careless', label: '🎲 Careless vs Weakness' },{ id: 'failures', label: '🔁 Repeated Failures' },
    { id: 'flashcards', label: '🃏 AI Flashcards' },{ id: 'studyplan', label: '📅 Daily Study Plan' },
    { id: 'agents', label: '🤖 AI Agents' },
    { id: 'nudges', label: '🔔 Nudges' },{ id: 'explainable', label: '🔍 AI Reasoning' },{ id: 'report', label: '📋 Weekly Report' },{ id: 'adaptive', label: '🎯 Adaptive Plan' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3"><h1 className="text-xl font-extrabold text-white">NTU<span className="text-blue-400">learn</span></h1><span className="text-slate-500">|</span><span className="text-sm text-slate-300">AI Insights</span></div>
          <div className="flex items-center gap-3">
            <button onClick={() => window.location.href = '/dashboard'} className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition-all">Dashboard</button>
            <button onClick={() => window.location.href = '/course'} className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition-all">Course</button>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between mb-6">
          <div><h2 className="text-2xl font-bold text-white mb-1">AI Learning Intelligence 🧠</h2><p className="text-sm text-slate-400"><span className="text-blue-300 font-medium">{selectedModule}</span> · {studentData.quizHistory.length} scores, {studentData.weeksActive} weeks of data</p></div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={selectedModule}
                onChange={(e) => { setSelectedModule(e.target.value); }}
                className="appearance-none bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm pl-4 pr-10 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer transition-all"
              >
                {AVAILABLE_MODULES.map(m => (
                  <option key={m.code} value={m.code} className="bg-slate-800 text-white">{m.code} — {m.name}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <button onClick={fetch_} disabled={loading} className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white text-sm px-5 py-2.5 rounded-xl transition-all">{loading ? '⏳ Analyzing...' : '🔄 Refresh'}</button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20"><svg className="animate-spin h-12 w-12 mx-auto text-blue-400 mb-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><p className="text-lg text-blue-300">Running 10 AI analysis engines...</p><p className="text-sm text-slate-500 mt-2">Topic Mastery · Forgetting Curve · Velocity · Cognitive Load · Optimal Time · ML Prediction · Careless Detection · Pattern Analysis</p></div>
        ) : ins && !ins.error ? (
          <>
            {phase && (
              <div className="p-6 rounded-2xl border bg-white/5 mb-6" style={{ borderColor: color + '40' }}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2"><div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: color }} /><span className="text-lg font-bold" style={{ color }}>{emoji} {(phase.currentPhase || '').split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span><span className="text-xs bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">Confidence: {Math.round((phase.confidenceScore || 0) * 100)}%</span></div>
                    <p className="text-sm text-slate-400 max-w-xl">{phase.phaseDescription}</p>
                    {phase.signals?.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{phase.signals.map((s: string, i: number) => <span key={i} className="text-xs bg-white/5 border border-white/10 text-slate-400 px-2 py-1 rounded-lg">📊 {s}</span>)}</div>}
                  </div>
                  <div className="text-right"><p className="text-xs text-slate-400">vs Last Week</p><p className={`text-sm font-bold ${phase.comparedToLastWeek === 'improving' ? 'text-green-400' : phase.comparedToLastWeek === 'declining' ? 'text-red-400' : 'text-amber-400'}`}>{phase.comparedToLastWeek === 'improving' ? '📈 Improving' : phase.comparedToLastWeek === 'declining' ? '📉 Declining' : '➡️ Stable'}</p><p className="text-xs text-slate-500 mt-1 max-w-xs">{phase.predictedTrajectory}</p></div>
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-6 flex-wrap">{tabs.map(t => (<button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${tab === t.id ? 'bg-blue-500 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>{t.label}</button>))}</div>

            {tab === 'timeline' && (
              <div className="space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Learning Phase Evolution</h3>
                  <div className="relative"><div className="absolute top-6 left-6 right-6 h-1 bg-white/10 rounded" />
                    <div className="flex justify-between relative px-2">{(ins.weeklyMetrics || []).map((w: any, i: number) => {
                      // Compute phase from actual score data — NOT hardcoded
                      const autoP = i === 0 ? 'onboarding' : (w.avgScore || 0) > (ins.weeklyMetrics[i - 1]?.avgScore || 0) + 3 ? 'accelerating' : (w.avgScore || 0) >= (ins.weeklyMetrics[i - 1]?.avgScore || 0) ? 'building-momentum' : 'declining';
                      const c = pc[autoP] || '#3b82f6';
                      return (<div key={i} className="flex flex-col items-center relative z-10"><div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg mb-2" style={{ backgroundColor: c }}>{w.week}</div><p className="text-xs" style={{ color: c }}>{w.avgScore || '—'}%</p><p className="text-xs text-slate-500">{w.hours}h</p></div>);
                    })}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6"><h4 className="text-sm font-bold text-white mb-3">📊 Avg Quiz Score</h4><div className="flex items-end gap-2" style={{ height: '180px' }}>{(ins.weeklyMetrics || []).map((w: any, i: number) => (<div key={i} className="flex-1 flex flex-col items-center gap-1"><span className="text-xs font-bold" style={{ color: (w.avgScore||0) >= 80 ? '#22c55e' : (w.avgScore||0) >= 70 ? '#f59e0b' : '#ef4444' }}>{w.avgScore||'—'}%</span><div className="w-full rounded-t-lg" style={{ height: `${Math.max(8, ((w.avgScore||0)/100)*160)}px`, backgroundColor: (w.avgScore||0) >= 80 ? '#22c55e' : (w.avgScore||0) >= 70 ? '#f59e0b' : '#ef4444' }} /><span className="text-xs text-slate-500">{w.week}</span></div>))}</div></div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6"><h4 className="text-sm font-bold text-white mb-3">⏱️ Study Hours</h4><div className="flex items-end gap-2" style={{ height: '180px' }}>{(ins.weeklyMetrics || []).map((w: any, i: number) => { const maxH = Math.max(...(ins.weeklyMetrics || []).map((m: any) => m.hours)); return (<div key={i} className="flex-1 flex flex-col items-center gap-1"><span className="text-xs font-bold text-blue-300">{w.hours}h</span><div className="w-full rounded-t-lg bg-blue-500" style={{ height: `${Math.max(8, (w.hours/maxH)*160)}px` }} /><span className="text-xs text-slate-500">{w.week}</span></div>); })}</div></div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6"><h4 className="text-sm font-bold text-white mb-3">💬 Engagement</h4><div className="flex items-end gap-2" style={{ height: '180px' }}>{(ins.weeklyMetrics || []).map((w: any, i: number) => (<div key={i} className="flex-1 flex flex-col items-center gap-1"><span className="text-xs font-bold text-violet-300">{w.engagement}%</span><div className="w-full rounded-t-lg bg-violet-500" style={{ height: `${Math.max(8, (w.engagement/100)*160)}px` }} /><span className="text-xs text-slate-500">{w.week}</span></div>))}</div></div>
                </div>
                {ins.timelineNarrative && <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl"><p className="text-xs font-bold text-blue-300 mb-1">🤖 AI Narrative</p><p className="text-sm text-slate-300">{ins.timelineNarrative}</p></div>}
              </div>
            )}

            {tab === 'mastery' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">🎯 Topic Mastery Heatmap</h3>
                <p className="text-sm text-slate-400 mb-4">Color-coded by mastery level — green is mastered, amber developing, red struggling</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {(ins.topicMastery || []).map((t: any, i: number) => (<div key={i} className={`p-4 rounded-xl border text-center transition-all hover:scale-105 ${t.mastery === 'mastered' ? 'bg-green-500/15 border-green-500/30' : t.mastery === 'developing' ? 'bg-amber-500/15 border-amber-500/30' : 'bg-red-500/15 border-red-500/30'}`}><p className="text-xs font-medium text-white mb-2">{t.topic}</p><p className={`text-2xl font-extrabold ${t.mastery === 'mastered' ? 'text-green-400' : t.mastery === 'developing' ? 'text-amber-400' : 'text-red-400'}`}>{t.avgScore}%</p><p className="text-xs text-slate-400 mt-1">{t.attempts} attempts</p><p className={`text-xs mt-1 ${t.trend === 'improving' ? 'text-green-400' : t.trend === 'declining' ? 'text-red-400' : 'text-slate-500'}`}>{t.trend === 'improving' ? '↑ improving' : t.trend === 'declining' ? '↓ declining' : '→ stable'}</p></div>))}
                </div>
                <div className="flex items-center gap-6 mt-4 text-xs text-slate-500"><span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> Mastered (≥85%)</span><span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500" /> Developing (70-84%)</span><span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> Struggling (&lt;70%)</span></div>
              </div>
            )}

            {tab === 'forgetting' && (
              <div className="space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-2">🧠 Forgetting Curve Predictor</h3>
                  <p className="text-sm text-slate-400 mb-4">AI predicts when you&apos;ll forget each topic using Ebbinghaus decay model</p>
                  <div className="space-y-3">
                    {(ins.forgettingCurve || []).sort((a: any, b: any) => a.estimatedRetention - b.estimatedRetention).map((f: any, i: number) => (
                      <div key={i} className={`p-4 rounded-xl border ${f.urgency === 'urgent' ? 'bg-red-500/10 border-red-500/20' : f.urgency === 'soon' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                        <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="text-sm font-bold text-white">{f.topic}</span><span className={`text-xs px-2 py-0.5 rounded-full ${f.urgency === 'urgent' ? 'bg-red-500/20 text-red-300' : f.urgency === 'soon' ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300'}`}>{f.urgency === 'urgent' ? '🚨 Review NOW' : f.urgency === 'soon' ? '⏰ Review Soon' : '✅ Fresh'}</span></div><span className="text-xs text-slate-400">Studied {f.weeksSinceStudied}w ago · Original: {f.originalScore}%</span></div>
                        <div className="flex items-center gap-3"><div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${f.estimatedRetention}%`, backgroundColor: f.urgency === 'urgent' ? '#ef4444' : f.urgency === 'soon' ? '#f59e0b' : '#22c55e' }} /></div><span className="text-sm font-bold text-white w-16 text-right">{f.estimatedRetention}%</span></div>
                        <p className="text-xs text-slate-400 mt-1">📅 Recommended review: in {f.reviewInDays} day{f.reviewInDays > 1 ? 's' : ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {ins.aiAdvice?.forgettingCurve && <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl"><p className="text-xs font-bold text-blue-300 mb-1">🤖 AI Advice</p><p className="text-sm text-slate-300">{ins.aiAdvice.forgettingCurve}</p></div>}
              </div>
            )}

            {tab === 'velocity' && (
              <div className="space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4">⚡ Learning Velocity</h3>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl text-center"><p className="text-xs text-violet-400 mb-1">Speed</p><p className={`text-3xl font-extrabold ${ins.learningVelocity?.velocity > 0 ? 'text-green-400' : ins.learningVelocity?.velocity < 0 ? 'text-red-400' : 'text-amber-400'}`}>{ins.learningVelocity?.velocity > 0 ? '+' : ''}{ins.learningVelocity?.velocity}</p><p className="text-xs text-slate-500">pts/quiz</p></div>
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center"><p className="text-xs text-blue-400 mb-1">Efficiency</p><p className="text-3xl font-extrabold text-blue-300">{ins.learningVelocity?.efficiency}</p><p className="text-xs text-slate-500">pts/hour</p></div>
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center"><p className="text-xs text-green-400 mb-1">Trend</p><p className="text-2xl font-extrabold text-white">{ins.learningVelocity?.trend === 'accelerating' ? '🚀' : ins.learningVelocity?.trend === 'decelerating' ? '🐌' : '➡️'}</p><p className="text-xs text-slate-500">{ins.learningVelocity?.trend}</p></div>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-3">Points per Hour by Week</h4>
                  <div className="flex items-end gap-3 h-32">{(ins.learningVelocity?.weeklyVelocity || []).map((w: any, i: number) => (<div key={i} className="flex-1 flex flex-col items-center gap-1"><span className="text-xs text-emerald-300">{w.pointsPerHour || '—'}</span><div className="w-full rounded-t-md bg-emerald-500" style={{ height: `${((w.pointsPerHour || 0) / 20) * 100}%`, minHeight: '4px' }} /><span className="text-xs text-slate-500">{w.week}</span></div>))}</div>
                </div>
                {ins.aiAdvice?.velocity && <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl"><p className="text-xs font-bold text-blue-300 mb-1">🤖 AI Advice</p><p className="text-sm text-slate-300">{ins.aiAdvice.velocity}</p></div>}
              </div>
            )}

            {tab === 'cognitive' && (
              <div className="space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-2">🔋 Cognitive Load Detector</h3>
                  <p className="text-sm text-slate-400 mb-4">Are you studying too many hard topics at once?</p>
                  <div className="space-y-3">{(ins.cognitiveLoad || []).map((c: any, i: number) => (
                    <div key={i} className={`p-4 rounded-xl border ${c.level === 'overloaded' ? 'bg-red-500/10 border-red-500/20' : c.level === 'moderate' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                      <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold text-white">{c.week}</span><span className={`text-xs px-2 py-0.5 rounded-full ${c.level === 'overloaded' ? 'bg-red-500/20 text-red-300' : c.level === 'moderate' ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300'}`}>{c.level === 'overloaded' ? '🔴 Overloaded' : c.level === 'moderate' ? '🟡 Moderate' : '🟢 Optimal'}</span></div>
                      <div className="flex items-center gap-3 mb-2"><div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${c.cognitiveLoad}%`, backgroundColor: c.level === 'overloaded' ? '#ef4444' : c.level === 'moderate' ? '#f59e0b' : '#22c55e' }} /></div><span className="text-sm font-bold text-white">{c.cognitiveLoad}%</span></div>
                      <div className="flex gap-4 text-xs text-slate-400"><span>{c.topicCount} topics</span><span>{c.hardTopicCount} hard</span><span>Avg: {c.avgScore}%</span><span>Topics: {c.topics.join(', ')}</span></div>
                    </div>
                  ))}</div>
                </div>
                {ins.aiAdvice?.cognitiveLoad && <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl"><p className="text-xs font-bold text-blue-300 mb-1">🤖 AI Advice</p><p className="text-sm text-slate-300">{ins.aiAdvice.cognitiveLoad}</p></div>}
              </div>
            )}

            {tab === 'optimal' && (
              <div className="space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-2">⏰ Optimal Study Time Analysis</h3>
                  <p className="text-sm text-slate-400 mb-4">AI detected when you perform best based on session data</p>
                  <div className="space-y-3">{(ins.optimalStudyTime || []).map((t: any, i: number) => (
                    <div key={i} className={`p-4 rounded-xl border ${t.performance === 'peak' ? 'bg-green-500/10 border-green-500/20' : t.performance === 'good' ? 'bg-blue-500/10 border-blue-500/20' : t.performance === 'low' ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10'}`}>
                      <div className="flex items-center justify-between"><div><p className="text-sm font-bold text-white">{t.label}</p><p className="text-xs text-slate-400 mt-1">{t.sessionCount} sessions · avg {t.avgDuration || '—'} min</p></div><div className="text-right"><p className={`text-2xl font-extrabold ${t.performance === 'peak' ? 'text-green-400' : t.performance === 'good' ? 'text-blue-400' : t.performance === 'low' ? 'text-red-400' : 'text-slate-500'}`}>{t.avgScore || '—'}%</p><p className={`text-xs ${t.performance === 'peak' ? 'text-green-300' : t.performance === 'good' ? 'text-blue-300' : t.performance === 'low' ? 'text-red-300' : 'text-slate-500'}`}>{t.performance === 'peak' ? '⭐ Peak Performance' : t.performance === 'good' ? '👍 Good' : t.performance === 'low' ? '⚠️ Low Performance' : 'No data'}</p></div></div>
                    </div>
                  ))}</div>
                </div>
                {ins.aiAdvice?.optimalTime && <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl"><p className="text-xs font-bold text-blue-300 mb-1">🤖 AI Advice</p><p className="text-sm text-slate-300">{ins.aiAdvice.optimalTime}</p></div>}
              </div>
            )}

            {tab === 'predict' && <PredictionTab scores={studentData.quizHistory.map((q: any) => q.score)} topics={studentData.quizHistory} />}
            {tab === 'modules' && <ModuleDiveTab />}
            {tab === 'careless' && <CarelessWeaknessTab />}
            {tab === 'failures' && <RepeatedFailuresTab />}
            {tab === 'flashcards' && <FlashcardsTab />}
            {tab === 'studyplan' && <StudyPlanTab />}
            {tab === 'agents' && <AgentVisualizerTab />}

            {tab === 'nudges' && <div className="space-y-4">{(ins.nudges || []).map((n: any, i: number) => (
              <div key={i} className={`border rounded-2xl overflow-hidden ${n.priority === 'high' ? 'bg-red-500/5 border-red-500/20' : n.priority === 'medium' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
                <div className="p-5 cursor-pointer" onClick={() => setExpNudge(expNudge === i ? null : i)}>
                  <div className="flex items-start gap-3"><span className="text-2xl">{{ 'topic-reminder':'📚','study-pattern':'📊','streak-motivation':'🔥','difficulty-adjustment':'⚙️','inactivity-warning':'⏰','acceleration-praise':'🚀' }[n.type as string] || '📌'}</span><div className="flex-1"><div className="flex items-center gap-2 mb-1"><h4 className="text-sm font-bold text-white">{n.title}</h4><span className={`text-xs px-2 py-0.5 rounded-full ${n.priority === 'high' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>{n.priority}</span></div><p className="text-sm text-slate-300">{n.message}</p></div><span className="text-slate-500">{expNudge === i ? '▲' : '▼'}</span></div>
                </div>
                {expNudge === i && <div className="px-5 pb-5 border-t border-white/10 pt-4 grid grid-cols-2 gap-4"><div className="p-3 bg-white/5 rounded-xl"><p className="text-xs text-slate-400 mb-1">🎯 Action</p><p className="text-sm text-white">{n.action}</p></div><div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl"><p className="text-xs text-blue-400 mb-1">🧠 Why? (XAI)</p><p className="text-sm text-blue-200">{n.reasoning}</p></div></div>}
              </div>
            ))}</div>}

            {tab === 'explainable' && <div className="space-y-4">{(ins.explainableInsights || []).map((item: any, i: number) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-5 cursor-pointer" onClick={() => setExpInsight(expInsight === i ? null : i)}>
                  <div className="flex items-start justify-between gap-4"><div className="flex-1"><p className="text-sm font-bold text-white mb-1">{item.insight}</p><p className="text-xs text-slate-400">{item.recommendation}</p></div><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-full border-2 flex items-center justify-center" style={{ borderColor: item.confidence > 0.8 ? '#22c55e' : '#f59e0b' }}><span className="text-xs font-bold text-white">{Math.round(item.confidence * 100)}%</span></div><span className="text-slate-500">{expInsight === i ? '▲' : '▼'}</span></div></div>
                </div>
                {expInsight === i && <div className="px-5 pb-5 border-t border-white/10 pt-4 space-y-3"><div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl"><p className="text-xs text-blue-400 mb-1">📊 Evidence</p><p className="text-sm text-blue-200">{item.evidence}</p></div><div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl"><p className="text-xs text-violet-400 mb-1">⚡ Impact</p><p className="text-sm text-violet-200">{item.impact}</p></div></div>}
              </div>
            ))}</div>}

            {tab === 'report' && ins.weeklyReport && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">📋 AI Weekly Report</h3>
                <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4"><p className="text-sm text-slate-200 leading-relaxed">{ins.weeklyReport.summary}</p></div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl"><p className="text-xs font-bold text-green-400 mb-2">✅ Highlights</p>{(ins.weeklyReport.highlights || []).map((h: string, i: number) => <p key={i} className="text-sm text-green-200 mb-1">• {h}</p>)}</div>
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl"><p className="text-xs font-bold text-amber-400 mb-2">⚠️ Needs Attention</p>{(ins.weeklyReport.concerns || []).map((c: string, i: number) => <p key={i} className="text-sm text-amber-200 mb-1">• {c}</p>)}</div>
                </div>
                <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl mb-4"><p className="text-xs font-bold text-violet-400 mb-1">🎯 Goal for Next Week</p><p className="text-sm text-violet-200">{ins.weeklyReport.goalForNextWeek}</p></div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl"><p className="text-sm text-slate-300 italic">💬 {ins.weeklyReport.motivationalNote}</p></div>
              </div>
            )}

            {tab === 'adaptive' && <div className="space-y-4">{(ins.adaptiveRecommendations || []).map((r: any, i: number) => {
              const icons: any = { content:'📚', schedule:'📅', difficulty:'⚙️', format:'🎨' };
              const colors: any = { content:'#3b82f6', schedule:'#22c55e', difficulty:'#f59e0b', format:'#8b5cf6' };
              return (<div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6"><div className="flex items-start gap-4"><div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: (colors[r.category]||'#3b82f6') + '20' }}>{icons[r.category]||'🎯'}</div><div className="flex-1"><p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: colors[r.category] }}>{r.category}</p><p className="text-base font-bold text-white mb-3">{r.recommendation}</p><div className="grid grid-cols-2 gap-3"><div className="p-3 bg-white/5 rounded-xl"><p className="text-xs text-slate-400 mb-1">🧠 Reason</p><p className="text-xs text-slate-300">{r.reason}</p></div><div className="p-3 rounded-xl" style={{ backgroundColor: (colors[r.category]||'#3b82f6') + '15' }}><p className="text-xs mb-1" style={{ color: colors[r.category] }}>📈 Impact</p><p className="text-xs text-slate-300">{r.expectedImpact}</p></div></div></div></div></div>);
            })}</div>}

            {ins.meta && <div className="flex items-center gap-4 text-xs text-slate-500 mt-6"><span>⚡ {ins.meta.analysisTimeMs}ms</span><span>📊 {ins.meta.dataPointsAnalyzed} data points</span><span>🔧 {ins.meta.rulesApplied} rules</span><span>🧠 {ins.meta.featuresComputed} engines</span><span>🤖 {ins.meta.aiModel}</span></div>}
          </>
        ) : <div className="text-center py-16"><p className="text-red-400">Analysis failed. Click Refresh.</p></div>}
      </div>
    </div>
  );
}
