'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { demoModule } from '@/data/demoModule';
import { authFetch } from '@/lib/api-client';

/* ── Types ─────────────────────────────────────────────────────────────── */

interface MCQQuestion {
  id: string;
  type: 'mcq';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  marks: number;
}

interface ShortAnswerQuestion {
  id: string;
  type: 'short-answer';
  question: string;
  modelAnswer: string;
  keywords: string[];
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  marks: number;
}

type PaperQuestion = MCQQuestion | ShortAnswerQuestion;

interface PaperSection {
  name: string;
  instructions: string;
  questions: PaperQuestion[];
  totalMarks: number;
}

interface PracticePaper {
  title: string;
  course: string;
  module: string;
  duration: number;
  totalMarks: number;
  sections: PaperSection[];
  generatedAt: string;
  meta: { model: string; questionsGenerated: number; topicsCovered: string[] };
}

/* ── Extract topics from demoModule ───────────────────────────────────── */

const COURSE = {
  code: '2552-SC3010',
  title: 'COMPUTER SECURITY',
  instructor: 'CCDS LI YI',
};

const SEGMENTS = demoModule.segmentTitles.map((title, i) => ({
  index: i,
  title,
  slides: demoModule.segmentSlides[i],
}));

const TOPIC_MAP: Record<string, string[]> = {
  'Format Specifiers & printf Vulnerability': [
    'Format specifiers', 'printf vulnerability', 'User-controlled format strings', 'Stack memory layout',
  ],
  'Format String Attacks (Leak, Crash, Overwrite)': [
    'CIA triad in format strings', 'Stack leak with %x/%p', 'Crash with %s', '%n write primitive', 'Memory overwrite attacks',
  ],
  'Fixes & Other Vulnerabilities': [
    'Format string fixes', 'Integer overflow', 'Bypass length checking', 'Command injection', 'SQL injection', 'Parameterized queries', 'XSS (stored & reflected)', 'Content Security Policy',
  ],
};

const ALL_TOPICS = Object.entries(TOPIC_MAP);

/* ── Component ─────────────────────────────────────────────────────────── */

export default function PracticePaperPage() {
  /* State: setup */
  const [selectedSegments, setSelectedSegments] = useState<number[]>([0, 1, 2]);
  const [selectedSubTopics, setSelectedSubTopics] = useState<string[]>(
    ALL_TOPICS.flatMap(([, subs]) => subs),
  );
  const [mcqCount, setMcqCount] = useState(10);
  const [shortAnswerCount, setShortAnswerCount] = useState(3);
  const [difficulty, setDifficulty] = useState<'mixed' | 'easy' | 'medium' | 'hard'>('mixed');

  /* State: generation */
  const [paper, setPaper] = useState<PracticePaper | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* State: exam */
  const [phase, setPhase] = useState<'setup' | 'exam' | 'results'>('setup');
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [saAnswers, setSaAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  /* State: results */
  const [showExplanations, setShowExplanations] = useState<Record<string, boolean>>({});
  const [saGrades, setSaGrades] = useState<Record<string, { score: number; feedback: string }>>({});
  const [gradingInProgress, setGradingInProgress] = useState(false);

  /* State: history */
  const [history, setHistory] = useState<any[]>([]);
  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem('pp_history') || '[]')); } catch { setHistory([]); }
  }, []);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Timer ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setTimerActive(false);
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  /* ── Segment / topic toggle helpers ─────────────────────────────────── */

  const toggleSegment = (idx: number) => {
    const topicEntry = ALL_TOPICS[idx];
    const subTopics = topicEntry ? topicEntry[1] : [];

    if (selectedSegments.includes(idx)) {
      setSelectedSegments(prev => prev.filter(s => s !== idx));
      setSelectedSubTopics(prev => prev.filter(t => !subTopics.includes(t)));
    } else {
      setSelectedSegments(prev => [...prev, idx]);
      setSelectedSubTopics(prev => Array.from(new Set([...prev, ...subTopics])));
    }
  };

  const toggleSubTopic = (topic: string) => {
    setSelectedSubTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic],
    );
  };

  /* ── Generate Paper ─────────────────────────────────────────────────── */

  const generatePaper = useCallback(async () => {
    if (selectedSegments.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const slidesContent = selectedSegments
        .map(i => demoModule.segmentSlides[i])
        .join('\n\n---\n\n');

      const topics = selectedSubTopics.length > 0
        ? selectedSubTopics
        : selectedSegments.map(i => SEGMENTS[i].title);

      const res = await authFetch('/api/practice-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: `${COURSE.code} ${COURSE.title}`,
          topics,
          segmentSlides: slidesContent,
          difficulty,
          mcqCount,
          shortAnswerCount,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      const data: PracticePaper = await res.json();
      setPaper(data);
      setTimeLeft(data.duration * 60);
      setPhase('exam');
      setTimerActive(true);
      setMcqAnswers({});
      setSaAnswers({});
      setSaGrades({});
    } catch (err: any) {
      setError(err.message || 'Failed to generate paper');
    }
    setLoading(false);
  }, [selectedSegments, selectedSubTopics, difficulty, mcqCount, shortAnswerCount]);

  /* ── Submit & Grade ─────────────────────────────────────────────────── */

  const saveToHistory = useCallback((pct: number) => {
    const entry = { id: Date.now(), date: new Date().toISOString(), title: paper?.title || 'Practice Paper', score: pct, totalMarks: paper?.totalMarks || 0, topics: paper?.meta.topicsCovered || [], questions: paper?.meta.questionsGenerated || 0 };
    const updated = [entry, ...history].slice(0, 20);
    setHistory(updated);
    try { localStorage.setItem('pp_history', JSON.stringify(updated)); } catch { /* ignore */ }
  }, [paper, history]);

  const handleSubmit = useCallback(async () => {
    setTimerActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('results');

    if (!paper) return;
    const saQuestions = paper.sections.find(s => s.questions[0]?.type === 'short-answer')?.questions as ShortAnswerQuestion[] | undefined;
    if (!saQuestions || saQuestions.length === 0) return;

    setGradingInProgress(true);
    const grades: Record<string, { score: number; feedback: string }> = {};

    for (const q of saQuestions) {
      const answer = saAnswers[q.id] || '';
      if (!answer.trim()) {
        grades[q.id] = { score: 0, feedback: 'No answer provided.' };
        continue;
      }

      const lower = answer.toLowerCase();
      const matched = q.keywords.filter(kw => lower.includes(kw.toLowerCase()));
      const keywordScore = q.keywords.length > 0 ? matched.length / q.keywords.length : 0;
      const lengthBonus = answer.split(/\s+/).length >= 15 ? 0.1 : 0;
      const rawScore = Math.min(1, keywordScore + lengthBonus);
      const finalScore = Math.round(rawScore * q.marks * 10) / 10;

      grades[q.id] = {
        score: finalScore,
        feedback: matched.length === q.keywords.length
          ? 'Excellent — all key concepts covered.'
          : matched.length > 0
            ? `Good attempt. You covered: ${matched.join(', ')}. Missing: ${q.keywords.filter(k => !matched.includes(k)).join(', ')}.`
            : 'The answer does not address the key concepts. Review the model answer below.',
      };
    }

    setSaGrades(grades);
    setGradingInProgress(false);

    // Save to history
    const mcqSection = paper.sections.find(s => s.questions[0]?.type === 'mcq');
    let mcqS = 0;
    (mcqSection?.questions as MCQQuestion[] || []).forEach(q => { if (mcqAnswers[q.id] === q.correctIndex) mcqS += q.marks; });
    let saS = 0; Object.values(grades).forEach(g => { saS += g.score; });
    const pct = paper.totalMarks > 0 ? Math.round(((mcqS + saS) / paper.totalMarks) * 100) : 0;
    saveToHistory(pct);
  }, [paper, saAnswers, mcqAnswers, saveToHistory]);

  /* ── Score Calculation ──────────────────────────────────────────────── */

  const calculateScores = () => {
    if (!paper) return { mcqScore: 0, mcqTotal: 0, saScore: 0, saTotal: 0, total: 0, max: 0, pct: 0 };

    const mcqSection = paper.sections.find(s => s.questions[0]?.type === 'mcq');
    const saSection = paper.sections.find(s => s.questions[0]?.type === 'short-answer');

    let mcqScore = 0;
    const mcqTotal = mcqSection?.totalMarks ?? 0;
    (mcqSection?.questions as MCQQuestion[] || []).forEach(q => {
      if (mcqAnswers[q.id] === q.correctIndex) mcqScore += q.marks;
    });

    let saScore = 0;
    const saTotal = saSection?.totalMarks ?? 0;
    Object.values(saGrades).forEach(g => { saScore += g.score; });

    const total = mcqScore + saScore;
    const max = mcqTotal + saTotal;
    const pct = max > 0 ? Math.round((total / max) * 100) : 0;

    return { mcqScore, mcqTotal, saScore: Math.round(saScore * 10) / 10, saTotal, total: Math.round(total * 10) / 10, max, pct };
  };

  const answeredCount = () => {
    if (!paper) return 0;
    return Object.keys(mcqAnswers).length + Object.values(saAnswers).filter(a => a.trim().length > 0).length;
  };

  const totalQuestions = paper?.meta.questionsGenerated ?? 0;

  /* ── Difficulty Badge ───────────────────────────────────────────────── */

  const DiffBadge = ({ d }: { d: string }) => (
    <span className={`text-xs px-2 py-0.5 rounded-full ${
      d === 'hard' ? 'bg-red-500/20 text-red-300' :
      d === 'easy' ? 'bg-green-500/20 text-green-300' :
      'bg-amber-500/20 text-amber-300'
    }`}>{d}</span>
  );

  /* ── SETUP PHASE ────────────────────────────────────────────────────── */

  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        {/* Nav */}
        <div className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-extrabold text-white">NTU<span className="text-blue-400">learn</span></h1>
              <span className="text-slate-500">|</span>
              <span className="text-sm text-slate-300">AI Practice Paper</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.location.href = '/dashboard'} className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition-all">Dashboard</button>
              <button onClick={() => window.location.href = '/course'} className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition-all">Course</button>
              <button onClick={() => window.location.href = '/insights'} className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition-all">Insights</button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-white mb-2">📝 AI Practice Paper Generator</h2>
            <p className="text-slate-400">Generate a full mock exam for <span className="text-blue-300 font-semibold">{COURSE.code} — {COURSE.title}</span></p>
            <p className="text-xs text-slate-500 mt-1">Instructor: {COURSE.instructor}</p>
          </div>

          {/* Segment Selection */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">1. Select Segments</h3>
              <button onClick={() => {
                if (selectedSegments.length === SEGMENTS.length) {
                  setSelectedSegments([]);
                  setSelectedSubTopics([]);
                } else {
                  setSelectedSegments(SEGMENTS.map((_, i) => i));
                  setSelectedSubTopics(ALL_TOPICS.flatMap(([, subs]) => subs));
                }
              }} className="text-xs text-blue-400 hover:text-blue-300">
                {selectedSegments.length === SEGMENTS.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="space-y-3">
              {SEGMENTS.map((seg, i) => (
                <button key={i} onClick={() => toggleSegment(i)}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    selectedSegments.includes(i)
                      ? 'bg-blue-500/20 border-blue-500/40 ring-1 ring-blue-500/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      selectedSegments.includes(i) ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-400'
                    }`}>{i + 1}</span>
                    <div>
                      <p className="text-sm font-bold text-white">{seg.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {ALL_TOPICS[i] ? `${ALL_TOPICS[i][1].length} sub-topics` : ''}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Sub-topic Selection */}
          {selectedSegments.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
              <h3 className="text-sm font-bold text-white mb-4">2. Fine-tune Topics</h3>
              {ALL_TOPICS.map(([group, subs], gi) => {
                if (!selectedSegments.includes(gi)) return null;
                return (
                  <div key={group} className="mb-4 last:mb-0">
                    <p className="text-xs text-slate-400 font-medium mb-2">Segment {gi + 1}: {group}</p>
                    <div className="flex flex-wrap gap-2">
                      {subs.map(topic => (
                        <button key={topic} onClick={() => toggleSubTopic(topic)}
                          className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                            selectedSubTopics.includes(topic)
                              ? 'bg-violet-500/20 border border-violet-500/40 text-violet-300'
                              : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                          }`}>
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Configuration */}
          {selectedSegments.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
              <h3 className="text-sm font-bold text-white mb-4">3. Configure Paper</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-2 block">MCQ Questions</label>
                  <div className="flex gap-2">
                    {[5, 10, 15, 20].map(n => (
                      <button key={n} onClick={() => setMcqCount(n)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                          mcqCount === n ? 'bg-blue-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}>{n}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-2 block">Short Answer Questions</label>
                  <div className="flex gap-2">
                    {[2, 3, 5].map(n => (
                      <button key={n} onClick={() => setShortAnswerCount(n)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                          shortAnswerCount === n ? 'bg-violet-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}>{n}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-2 block">Difficulty</label>
                  <div className="flex gap-2">
                    {(['mixed', 'easy', 'medium', 'hard'] as const).map(d => (
                      <button key={d} onClick={() => setDifficulty(d)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all capitalize ${
                          difficulty === d ? 'bg-amber-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}>{d}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6">
              <p className="text-sm text-red-300">⚠️ {error}</p>
            </div>
          )}

          <button onClick={generatePaper}
            disabled={selectedSegments.length === 0 || loading}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              selectedSegments.length === 0 || loading
                ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-violet-500 text-white hover:shadow-lg hover:shadow-blue-500/25 hover:scale-[1.01]'
            }`}>
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Generating {mcqCount} MCQs + {shortAnswerCount} Short Answers...
              </span>
            ) : `🚀 Generate Practice Paper (${mcqCount + shortAnswerCount} questions)`}
          </button>

          {selectedSegments.length > 0 && (
            <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>📋 {mcqCount} MCQs ({mcqCount * 2} marks) + {shortAnswerCount} Short Answer ({shortAnswerCount * 5} marks)</span>
                <span>⏱ ~{mcqCount * 2 + shortAnswerCount * 8} min</span>
                <span>📊 Total: {mcqCount * 2 + shortAnswerCount * 5} marks</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedSubTopics.slice(0, 8).map(t => (
                  <span key={t} className="text-xs bg-white/5 text-slate-500 px-2 py-0.5 rounded-full">{t}</span>
                ))}
                {selectedSubTopics.length > 8 && (
                  <span className="text-xs text-slate-500">+{selectedSubTopics.length - 8} more</span>
                )}
              </div>
            </div>
          )}

          {/* Paper History */}
          {history.length > 0 && (
            <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">📜 Past Papers</h3>
                <button onClick={() => { localStorage.removeItem('pp_history'); setHistory([]); }} className="text-xs text-slate-500 hover:text-red-400 transition-all">Clear All</button>
              </div>
              <div className="space-y-2">
                {history.map((h: any) => {
                  const c = h.score >= 80 ? 'text-green-400' : h.score >= 60 ? 'text-amber-400' : 'text-red-400';
                  return (
                    <div key={h.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                      <div>
                        <p className="text-sm text-white font-medium">{h.title}</p>
                        <p className="text-xs text-slate-500">{new Date(h.date).toLocaleDateString()} · {h.questions} questions · {(h.topics || []).slice(0, 3).join(', ')}</p>
                      </div>
                      <p className={`text-xl font-extrabold ${c}`}>{h.score}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── EXAM PHASE ─────────────────────────────────────────────────────── */

  if (phase === 'exam' && paper) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/90 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <h1 className="text-sm font-bold text-white">{paper.title}</h1>
              <p className="text-xs text-slate-400">{COURSE.code} · {paper.totalMarks} marks</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-slate-400">Progress</p>
                <p className="text-sm font-bold text-white">{answeredCount()}/{totalQuestions}</p>
              </div>
              <div className={`px-4 py-2 rounded-xl ${timeLeft < 300 ? 'bg-red-500/20 border border-red-500/30' : 'bg-blue-500/20 border border-blue-500/30'}`}>
                <p className="text-xs text-slate-400">Time</p>
                <p className={`text-lg font-extrabold font-mono ${timeLeft < 300 ? 'text-red-400' : 'text-blue-300'}`}>{formatTime(timeLeft)}</p>
              </div>
              <button onClick={handleSubmit} className="bg-green-500 hover:bg-green-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all">
                Submit Paper
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
          {paper.sections.map((section, si) => (
            <div key={si}>
              <div className="mb-4">
                <h2 className="text-lg font-bold text-white">{section.name}</h2>
                <p className="text-sm text-slate-400">{section.instructions}</p>
                <p className="text-xs text-blue-400 mt-1">[{section.totalMarks} marks]</p>
              </div>
              <div className="space-y-4">
                {section.questions.map((q, qi) => (
                  <div key={q.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-300">{qi + 1}</span>
                        <span className="text-xs text-slate-500">{q.topic}</span>
                        <DiffBadge d={q.difficulty} />
                      </div>
                      <span className="text-xs text-slate-500">[{q.marks} marks]</span>
                    </div>
                    <p className="text-sm text-white mb-4 leading-relaxed">{q.question}</p>
                    {q.type === 'mcq' && (
                      <div className="space-y-2">
                        {(q as MCQQuestion).options.map((opt, oi) => (
                          <button key={oi} onClick={() => setMcqAnswers(prev => ({ ...prev, [q.id]: oi }))}
                            className={`w-full text-left p-3 rounded-xl border transition-all text-sm ${
                              mcqAnswers[q.id] === oi
                                ? 'bg-blue-500/20 border-blue-500/50 text-blue-200'
                                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                            }`}>{opt}</button>
                        ))}
                      </div>
                    )}
                    {q.type === 'short-answer' && (
                      <textarea value={saAnswers[q.id] || ''}
                        onChange={(e) => setSaAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Type your answer here (2-5 sentences)..." rows={4}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 resize-none" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="pt-4 pb-8">
            <button onClick={handleSubmit}
              className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg hover:shadow-green-500/25 transition-all">
              ✅ Submit Paper ({answeredCount()}/{totalQuestions} answered)
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── RESULTS PHASE ──────────────────────────────────────────────────── */

  if (phase === 'results' && paper) {
    const scores = calculateScores();
    const gradeColor = scores.pct >= 80 ? 'text-green-400' : scores.pct >= 60 ? 'text-amber-400' : 'text-red-400';
    const gradeBg = scores.pct >= 80 ? 'from-green-500/20' : scores.pct >= 60 ? 'from-amber-500/20' : 'from-red-500/20';
    const grade = scores.pct >= 85 ? 'A' : scores.pct >= 75 ? 'A-' : scores.pct >= 70 ? 'B+' : scores.pct >= 65 ? 'B' : scores.pct >= 60 ? 'B-' : scores.pct >= 55 ? 'C+' : scores.pct >= 50 ? 'C' : 'F';

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-extrabold text-white">NTU<span className="text-blue-400">learn</span></h1>
              <span className="text-slate-500">|</span>
              <span className="text-sm text-slate-300">{COURSE.code} Paper Results</span>
            </div>
            <button onClick={() => { setPhase('setup'); setPaper(null); }}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold px-5 py-2 rounded-xl transition-all">
              📝 Generate New Paper
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className={`bg-gradient-to-br ${gradeBg} to-transparent border border-white/10 rounded-2xl p-8 mb-8`}>
            <div className="grid grid-cols-4 gap-6 text-center">
              <div>
                <p className="text-xs text-slate-400 mb-1">Grade</p>
                <p className={`text-5xl font-extrabold ${gradeColor}`}>{grade}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Score</p>
                <p className={`text-4xl font-extrabold ${gradeColor}`}>{scores.pct}%</p>
                <p className="text-xs text-slate-500">{scores.total}/{scores.max} marks</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">MCQ Score</p>
                <p className="text-3xl font-extrabold text-blue-300">{scores.mcqScore}/{scores.mcqTotal}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Short Answer</p>
                <p className="text-3xl font-extrabold text-violet-300">{scores.saScore}/{scores.saTotal}</p>
                {gradingInProgress && <p className="text-xs text-violet-400 animate-pulse">Grading...</p>}
              </div>
            </div>
          </div>

          {paper.sections.map((section, si) => (
            <div key={si} className="mb-8">
              <h2 className="text-lg font-bold text-white mb-4">{section.name}</h2>
              <div className="space-y-4">
                {section.questions.map((q, qi) => {
                  const isMcq = q.type === 'mcq';
                  const mcq = q as MCQQuestion;
                  const sa = q as ShortAnswerQuestion;
                  const userMcqAnswer = mcqAnswers[q.id];
                  const isCorrect = isMcq && userMcqAnswer === mcq.correctIndex;
                  const wasAttempted = isMcq ? userMcqAnswer !== undefined : (saAnswers[q.id] || '').trim().length > 0;
                  const saGrade = saGrades[q.id];

                  return (
                    <div key={q.id} className={`rounded-2xl border overflow-hidden ${
                      isMcq
                        ? isCorrect ? 'bg-green-500/5 border-green-500/20' : !wasAttempted ? 'bg-white/5 border-white/10' : 'bg-red-500/5 border-red-500/20'
                        : 'bg-white/5 border-white/10'
                    }`}>
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              isMcq
                                ? isCorrect ? 'bg-green-500/20 border border-green-500/30 text-green-300' : wasAttempted ? 'bg-red-500/20 border border-red-500/30 text-red-300' : 'bg-white/10 text-slate-400'
                                : 'bg-violet-500/20 border border-violet-500/30 text-violet-300'
                            }`}>
                              {isMcq ? (isCorrect ? '✓' : wasAttempted ? '✗' : qi + 1) : qi + 1}
                            </span>
                            <span className="text-xs text-slate-500">{q.topic}</span>
                            <DiffBadge d={q.difficulty} />
                          </div>
                          <span className={`text-sm font-bold ${
                            isMcq ? (isCorrect ? 'text-green-400' : 'text-red-400') : saGrade ? (saGrade.score >= q.marks * 0.7 ? 'text-green-400' : 'text-amber-400') : 'text-slate-400'
                          }`}>
                            {isMcq ? (isCorrect ? `+${q.marks}` : wasAttempted ? '0' : '—') : saGrade ? `${saGrade.score}/${q.marks}` : '—'}
                          </span>
                        </div>

                        <p className="text-sm text-white mb-4">{q.question}</p>

                        {isMcq && (
                          <div className="space-y-2 mb-3">
                            {mcq.options.map((opt, oi) => (
                              <div key={oi} className={`p-3 rounded-xl border text-sm ${
                                oi === mcq.correctIndex
                                  ? 'bg-green-500/15 border-green-500/30 text-green-200'
                                  : oi === userMcqAnswer && oi !== mcq.correctIndex
                                    ? 'bg-red-500/15 border-red-500/30 text-red-300 line-through'
                                    : 'bg-white/5 border-white/10 text-slate-400'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <span>{opt}</span>
                                  {oi === mcq.correctIndex && <span className="text-xs font-bold text-green-400">✓ Correct</span>}
                                  {oi === userMcqAnswer && oi !== mcq.correctIndex && <span className="text-xs font-bold text-red-400">✗ Your answer</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {!isMcq && (
                          <div className="space-y-3">
                            {wasAttempted && (
                              <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                                <p className="text-xs text-slate-400 mb-1">Your Answer:</p>
                                <p className="text-sm text-slate-300">{saAnswers[q.id]}</p>
                              </div>
                            )}
                            {saGrade && (
                              <div className={`p-3 rounded-xl border ${saGrade.score >= sa.marks * 0.7 ? 'bg-green-500/10 border-green-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                                <p className="text-xs text-slate-400 mb-1">AI Grading:</p>
                                <p className="text-sm text-slate-300">{saGrade.feedback}</p>
                              </div>
                            )}
                          </div>
                        )}

                        <button onClick={() => setShowExplanations(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                          className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-all">
                          {showExplanations[q.id] ? '▲ Hide explanation' : '▼ Show explanation'}
                        </button>

                        {showExplanations[q.id] && (
                          <div className="mt-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                            {isMcq && <p className="text-sm text-blue-200">{mcq.explanation}</p>}
                            {!isMcq && (
                              <div>
                                <p className="text-xs font-bold text-blue-400 mb-1">Model Answer:</p>
                                <p className="text-sm text-blue-200">{sa.modelAnswer}</p>
                                <p className="text-xs text-slate-400 mt-2">Key concepts: {sa.keywords.join(', ')}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-4 text-xs text-slate-500 mt-6">
            <span>🤖 {paper.meta.model}</span>
            <span>📊 {paper.meta.questionsGenerated} questions</span>
            <span>📚 {paper.meta.topicsCovered.length} topics</span>
            <span>🕐 Generated {new Date(paper.generatedAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
