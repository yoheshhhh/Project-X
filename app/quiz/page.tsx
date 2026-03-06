'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LEARNER_TYPES, getLearnerType } from '@/data/learnerTypes';
import { auth, savePersona } from '@/lib/firebase';
import type { LearnerPersona } from '@/lib/firebase';
import { authFetch } from '@/lib/api-client';

const questions = [
  { id: 'pq1', question: 'When preparing for an exam, I typically...', options: [{ value: 'short-term-intensive', label: 'Cram intensively in the last few days' }, { value: 'long-term-gradual', label: 'Study a little bit every day over weeks' }], key: 'learningStyle' },
  { id: 'pq2', question: 'On average, how many hours do you study per day?', options: [{ value: '1', label: 'Less than 1 hour' }, { value: '2', label: '1-2 hours' }, { value: '3', label: '2-4 hours' }, { value: '5', label: 'More than 4 hours' }], key: 'studyHoursPerDay' },
  { id: 'pq3', question: 'How many days per week do you study?', options: [{ value: '2', label: '1-2 days' }, { value: '4', label: '3-4 days' }, { value: '6', label: '5-6 days' }, { value: '7', label: 'Every day' }], key: 'studyDaysPerWeek' },
  { id: 'pq4', question: 'How many weeks before exams do you start studying?', options: [{ value: '1', label: 'The week of the exam' }, { value: '2', label: '1-2 weeks before' }, { value: '4', label: '3-4 weeks before' }, { value: '6', label: 'From the start of semester' }], key: 'examPrepWeek' },
  { id: 'pq5', question: 'Which question format do you prefer?', options: [{ value: 'mcq', label: 'Multiple Choice (MCQ)' }, { value: 'short-answer', label: 'Short Answer (1-3 sentences)' }, { value: 'essay', label: 'Long-form / Essay' }], key: 'preferredQuestionFormat' },
  { id: 'pq6', question: 'A farmer has 17 sheep. All but 9 die. How many sheep are left?', options: [{ value: '8', label: '8 sheep' }, { value: '9', label: '9 sheep', correct: true }, { value: '17', label: '17 sheep' }, { value: '0', label: '0 sheep' }], key: 'cognitive1', type: 'iq' },
  { id: 'pq7', question: 'If you rearrange the letters "CIFAIPC", you get the name of a(n):', options: [{ value: 'ocean', label: 'Ocean', correct: true }, { value: 'city', label: 'City' }, { value: 'animal', label: 'Animal' }, { value: 'country', label: 'Country' }], key: 'cognitive2', type: 'iq' },
  { id: 'pq8', question: 'What number comes next: 2, 4, 6, 8, ?', options: [{ value: '9', label: '9' }, { value: '10', label: '10', correct: true }, { value: '12', label: '12' }, { value: '14', label: '14' }], key: 'cognitive3', type: 'iq' },
  { id: 'pq9', question: 'If all A are B, and all B are C, then all A are C. True or false?', options: [{ value: 'true', label: 'True', correct: true }, { value: 'false', label: 'False' }], key: 'cognitive4', type: 'iq' },
  { id: 'pq10', question: 'An item is $50. With 20% off, the sale price is:', options: [{ value: '45', label: '$45' }, { value: '40', label: '$40', correct: true }, { value: '30', label: '$30' }, { value: '10', label: '$10' }], key: 'cognitive5', type: 'iq' },
];

const COGNITIVE_QUESTIONS = [
  { key: 'cognitive1', correct: '9' },
  { key: 'cognitive2', correct: 'ocean' },
  { key: 'cognitive3', correct: '10' },
  { key: 'cognitive4', correct: 'true' },
  { key: 'cognitive5', correct: '40' },
];
const COGNITIVE_MAX = 100;
const PTS_PER_COGNITIVE = COGNITIVE_MAX / COGNITIVE_QUESTIONS.length;

function computeCognitiveScore(answers: Record<string, string>): number {
  let raw = 0;
  COGNITIVE_QUESTIONS.forEach(({ key, correct }) => {
    if (answers[key] === correct) raw += PTS_PER_COGNITIVE;
  });
  return Math.round(Math.min(COGNITIVE_MAX, raw));
}

function computeReadinessScore(profile: {
  studyDaysPerWeek: number;
  studyHoursPerDay: number;
  examPrepWeek: number;
  cognitiveScore: number;
}): number {
  const consistency = Math.min(100, (profile.studyDaysPerWeek / 7) * 100);
  const timeInvestment = profile.studyHoursPerDay >= 5 ? 100 : profile.studyHoursPerDay >= 3 ? 75 : profile.studyHoursPerDay >= 2 ? 50 : 25;
  const planning = profile.examPrepWeek >= 6 ? 100 : profile.examPrepWeek >= 4 ? 70 : profile.examPrepWeek >= 2 ? 40 : 20;
  const cognitive = profile.cognitiveScore;
  const readiness = 0.35 * consistency + 0.3 * timeInvestment + 0.2 * planning + 0.15 * cognitive;
  return Math.round(Math.min(100, Math.max(0, readiness)));
}

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export default function QuizPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [persona, setPersona] = useState(null);
  const [personaLoading, setPersonaLoading] = useState(false);

  // AI Quiz Explainer state
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanation, setExplanation] = useState(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [wasWrong, setWasWrong] = useState(false);

  const progress = ((current) / questions.length) * 100;
  const q = questions[current];

  const getFallbackLearnerTypes = (p: {
    learningStyle: string;
    preferredQuestionFormat: string;
    studyDaysPerWeek: number;
    studyHoursPerDay: number;
  }): string[] => {
    const types: string[] = [];
    if (p.learningStyle === 'short-term-intensive') types.push('stress');
    else types.push('ease');
    if (p.preferredQuestionFormat === 'short-answer' || p.preferredQuestionFormat === 'essay') types.push('scribble');
    if (p.studyDaysPerWeek >= 6 && p.studyHoursPerDay >= 3) types.push('teach');
    if (p.preferredQuestionFormat === 'mcq') types.push('visual');
    return types.slice(0, 3);
  };

  const getFallbackTraits = (p: {
    learningStyle: string;
    studyHoursPerDay: number;
    readinessScore: number;
  }) => {
    const traits: string[] = [];
    if (p.readinessScore >= 80) traits.push('high-discipline', 'self-directed');
    if (p.readinessScore >= 60) traits.push('consistent-learner');
    if (p.learningStyle === 'short-term-intensive') traits.push('focused-learner', 'deadline-driven');
    else traits.push('self-paced');
    if (p.studyHoursPerDay >= 3) traits.push('dedicated');
    return traits.length > 0 ? traits : ['reflective-learner'];
  };

  const fetchExplanation = async (question: string, userAnswer: string, correctAnswer: string, topic: string, allOptions: string[]) => {
    setExplanationLoading(true);
    try {
      const res = await authFetch('/api/quiz-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, userAnswer, correctAnswer, topic, allOptions }),
      });
      setExplanation(await res.json());
    } catch {
      setExplanation({
        whyWrong: 'Could not load explanation.',
        whyCorrect: `The correct answer is "${correctAnswer}".`,
        concept: topic,
        quickTip: 'Read the question carefully and consider all options.',
        confidenceBoost: 'Keep going — every mistake is a learning opportunity!',
      });
    }
    setExplanationLoading(false);
    setShowExplanation(true);
  };

  const handleNext = async () => {
    if (!selected) return;

    // If showing explanation, dismiss it and move to next
    if (showExplanation) {
      setShowExplanation(false);
      setExplanation(null);
      setWasWrong(false);
      // Move to next question
      if (current < questions.length - 1) {
        setCurrent(current + 1);
        setSelected(null);
      }
      return;
    }

    const newAnswers: Record<string, string> = { ...answers, [q.key]: selected };
    setAnswers(newAnswers);

    // Check if cognitive question was answered wrong
    if (q.type === 'iq') {
      const correctOption = q.options.find((o: { value: string; label: string; correct?: boolean }) => o.correct);
      if (correctOption && selected !== correctOption.value) {
        setWasWrong(true);
        const userLabel = q.options.find(o => o.value === selected)?.label || selected;
        const correctLabel = correctOption.label;
        await fetchExplanation(
          q.question,
          userLabel,
          correctLabel,
          'Cognitive Reasoning',
          q.options.map(o => o.label),
        );
        return; // Don't advance yet — wait for user to dismiss explanation
      }
    }

    setSelected(null);

    if (current < questions.length - 1) {
      setCurrent(current + 1);
    } else {
      await finishQuiz(newAnswers);
    }
  };

  const handleSkipExplanation = () => {
    setShowExplanation(false);
    setExplanation(null);
    setWasWrong(false);
    setSelected(null);
    if (current < questions.length - 1) {
      setCurrent(current + 1);
    } else {
      finishQuiz({ ...answers, [q.key]: selected });
    }
  };

  const finishQuiz = async (newAnswers: Record<string, string>) => {
    let cognitiveScore = computeCognitiveScore(newAnswers);
    const learningStyle = newAnswers.learningStyle || 'long-term-gradual';
    const studyHoursPerDay = parseInt(newAnswers.studyHoursPerDay) || 2;
    const studyDaysPerWeek = parseInt(newAnswers.studyDaysPerWeek) || 4;
    const examPrepWeek = parseInt(newAnswers.examPrepWeek) || 2;
    const preferredQuestionFormat = newAnswers.preferredQuestionFormat || 'mcq';
    const p: any = {
      learningStyle, studyHoursPerDay, studyDaysPerWeek, examPrepWeek, preferredQuestionFormat,
      cognitiveScore, readinessScore: 0, personalityTraits: [], learnerTypes: [],
    };
    p.readinessScore = computeReadinessScore({
      studyDaysPerWeek: p.studyDaysPerWeek, studyHoursPerDay: p.studyHoursPerDay,
      examPrepWeek: p.examPrepWeek, cognitiveScore: p.cognitiveScore,
    });
    if (DEMO_MODE) {
      p.cognitiveScore = Math.max(p.cognitiveScore, 70);
      p.readinessScore = Math.max(p.readinessScore, 72);
    }
    setPersonaLoading(true);
    try {
      const res = await authFetch('/api/generate-persona-traits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learningStyle: p.learningStyle, studyHoursPerDay: p.studyHoursPerDay,
          studyDaysPerWeek: p.studyDaysPerWeek, examPrepWeek: p.examPrepWeek,
          preferredQuestionFormat: p.preferredQuestionFormat, cognitiveScore: p.cognitiveScore,
          readinessScore: p.readinessScore, rawAnswers: newAnswers,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.personalityTraits) && data.personalityTraits.length > 0) {
        p.personalityTraits = data.personalityTraits;
      } else { p.personalityTraits = getFallbackTraits(p); }
      if (Array.isArray(data.learnerTypes) && data.learnerTypes.length > 0) {
        p.learnerTypes = data.learnerTypes.filter((id: string) => getLearnerType(id));
      } else { p.learnerTypes = getFallbackLearnerTypes(p); }
    } catch {
      p.personalityTraits = getFallbackTraits(p);
      p.learnerTypes = getFallbackLearnerTypes(p);
    } finally { setPersonaLoading(false); }
    setPersona(p);
    setShowResults(true);
    if (auth.currentUser && p) {
      const toSave: LearnerPersona = {
        learningStyle: p.learningStyle as LearnerPersona['learningStyle'],
        studyHoursPerDay: p.studyHoursPerDay, studyDaysPerWeek: p.studyDaysPerWeek,
        examPrepWeek: p.examPrepWeek,
        preferredQuestionFormat: p.preferredQuestionFormat as LearnerPersona['preferredQuestionFormat'],
        cognitiveScore: p.cognitiveScore, readinessScore: p.readinessScore,
        personalityTraits: p.personalityTraits, learnerTypes: p.learnerTypes,
      };
      savePersona(auth.currentUser.uid, toSave).catch((e) => console.error('Failed to save persona', e));
    }
  };

  if (personaLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-lg text-center">
          <div className="text-5xl mb-4">🧬</div>
          <h1 className="text-xl font-bold text-white mb-2">Generating your Learner DNA</h1>
          <p className="text-slate-400 text-sm mb-6">AI is reading your answers and inferring your learning personality...</p>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden max-w-xs mx-auto">
            <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  if (showResults && persona) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🧬</div>
            <h1 className="text-3xl font-extrabold text-white">Your Learner DNA</h1>
            <p className="text-slate-400 mt-2">Your personalized learning profile has been created</p>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
              <span className="text-sm text-slate-300">Learning Style</span>
              <span className="text-sm font-bold text-violet-300">{persona.learningStyle === 'short-term-intensive' ? '⚡ Short-term Intensive' : '📅 Long-term Gradual'}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <span className="text-sm text-slate-300">Study Hours/Day</span>
              <span className="text-sm font-bold text-blue-300">{persona.studyHoursPerDay} hours</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <span className="text-sm text-slate-300">Study Days/Week</span>
              <span className="text-sm font-bold text-green-300">{persona.studyDaysPerWeek} days</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <span className="text-sm text-slate-300">Exam Prep Starts</span>
              <span className="text-sm font-bold text-amber-300">{persona.examPrepWeek} weeks before</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <span className="text-sm text-slate-300">Preferred Format</span>
              <span className="text-sm font-bold text-rose-300">{persona.preferredQuestionFormat.toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <span className="text-sm text-slate-300">Learning Readiness</span>
              <span className="text-sm font-bold text-emerald-300">{persona.readinessScore ?? 0}/100</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-teal-500/10 border border-teal-500/20 rounded-xl">
              <span className="text-sm text-slate-300">Reasoning (cognitive)</span>
              <span className="text-sm font-bold text-teal-300">{persona.cognitiveScore}/100</span>
            </div>
            {(persona.learnerTypes?.length ?? 0) > 0 && (
              <div className="pt-2">
                <p className="text-xs text-slate-400 mb-2">Your learner type(s)</p>
                <div className="space-y-2">
                  {(persona.learnerTypes || []).map((id) => {
                    const t = getLearnerType(id);
                    if (!t) return null;
                    return (
                      <div key={t.id} className="flex items-center gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                        <span className="text-lg">{t.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-white">{t.label}</p>
                          <p className="text-xs text-slate-400">{t.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="pt-2">
              <p className="text-xs text-slate-400 mb-2">Personality Traits</p>
              <div className="flex flex-wrap gap-2">
                {persona.personalityTraits.map((t) => (
                  <span key={t} className="bg-white/10 text-slate-300 text-xs px-3 py-1 rounded-full">{t}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-sm text-blue-300">
              {persona.learningStyle === 'short-term-intensive'
                ? '⚡ Your content will be delivered in focused, intensive bursts with rapid checkpoints.'
                : '📅 Your content will be spaced over time with daily nudges and gradual progression.'}
            </p>
          </div>
          <button onClick={() => router.push('/course')} className="w-full mt-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/25 text-lg">
            Start Learning →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-white">NTU<span className="text-blue-400">learn</span></h1>
          <p className="text-slate-400 mt-1 text-sm">Learner DNA Assessment</p>
        </div>
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Question {current + 1} of {questions.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {/* Question card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
          {q.type === 'iq' && (
            <div className="inline-block bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1 rounded-full mb-4">🧠 Cognitive Challenge</div>
          )}
          <h2 className="text-xl font-bold text-white mb-6">{q.question}</h2>
          <div className="space-y-3">
            {q.options.map((opt) => (
              <button key={opt.value} onClick={() => { if (!showExplanation) setSelected(opt.value); }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  showExplanation && wasWrong
                    ? opt.correct
                      ? 'bg-green-500/20 border-green-500/50 ring-1 ring-green-500/30'
                      : selected === opt.value
                        ? 'bg-red-500/20 border-red-500/50 ring-1 ring-red-500/30'
                        : 'bg-white/5 border-white/10 opacity-50'
                    : selected === opt.value
                      ? 'bg-blue-500/20 border-blue-500/50 ring-1 ring-blue-500/30'
                      : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${
                    showExplanation && wasWrong
                      ? opt.correct ? 'text-green-300 font-bold' : selected === opt.value ? 'text-red-300 line-through' : 'text-slate-500'
                      : selected === opt.value ? 'text-blue-200 font-medium' : 'text-slate-300'
                  }`}>{opt.label}</span>
                  {showExplanation && wasWrong && opt.correct && <span className="text-green-400 text-xs font-bold">✓ Correct</span>}
                  {showExplanation && wasWrong && selected === opt.value && !opt.correct && <span className="text-red-400 text-xs font-bold">✗ Your answer</span>}
                </div>
              </button>
            ))}
          </div>

          {/* AI Explanation Panel */}
          {showExplanation && explanation && (
            <div className="mt-6 space-y-3 animate-in fade-in">
              <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🤖</span>
                  <p className="text-xs font-bold text-violet-300">Guardian AI Explains</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold text-red-400 mb-1">❌ Why your answer was wrong:</p>
                    <p className="text-sm text-slate-300">{explanation.whyWrong}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-green-400 mb-1">✅ Why the correct answer is right:</p>
                    <p className="text-sm text-slate-300">{explanation.whyCorrect}</p>
                  </div>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-xs text-blue-300">💡 <span className="font-bold">Quick Tip:</span> {explanation.quickTip}</p>
                  </div>
                  {explanation.similarMistake && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-xs text-amber-300">⚠️ <span className="font-bold">Watch out:</span> {explanation.similarMistake}</p>
                    </div>
                  )}
                  <p className="text-xs text-green-400 italic">{explanation.confidenceBoost}</p>
                </div>
              </div>
            </div>
          )}

          {explanationLoading && (
            <div className="mt-6 p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
              <div className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-violet-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                <p className="text-sm text-violet-300">Guardian AI is analyzing your answer...</p>
              </div>
            </div>
          )}

          {showExplanation ? (
            <button onClick={handleSkipExplanation}
              className="w-full mt-6 py-3.5 rounded-xl font-semibold transition-all bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg hover:shadow-blue-500/25">
              {current === questions.length - 1 ? 'View My Learner DNA →' : 'Got it! Next Question →'}
            </button>
          ) : (
            <button onClick={handleNext} disabled={!selected}
              className={`w-full mt-6 py-3.5 rounded-xl font-semibold transition-all ${selected ? 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg hover:shadow-blue-500/25' : 'bg-white/5 text-slate-500 cursor-not-allowed'}`}>
              {current === questions.length - 1 ? 'View My Learner DNA →' : 'Next Question →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
