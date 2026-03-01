'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const questions = [
  { id: 'pq1', question: 'When preparing for an exam, I typically...', options: [{ value: 'short-term-intensive', label: 'Cram intensively in the last few days' }, { value: 'long-term-gradual', label: 'Study a little bit every day over weeks' }], key: 'learningStyle' },
  { id: 'pq2', question: 'On average, how many hours do you study per day?', options: [{ value: '1', label: 'Less than 1 hour' }, { value: '2', label: '1-2 hours' }, { value: '3', label: '2-4 hours' }, { value: '5', label: 'More than 4 hours' }], key: 'studyHoursPerDay' },
  { id: 'pq3', question: 'How many days per week do you study?', options: [{ value: '2', label: '1-2 days' }, { value: '4', label: '3-4 days' }, { value: '6', label: '5-6 days' }, { value: '7', label: 'Every day' }], key: 'studyDaysPerWeek' },
  { id: 'pq4', question: 'How many weeks before exams do you start studying?', options: [{ value: '1', label: 'The week of the exam' }, { value: '2', label: '1-2 weeks before' }, { value: '4', label: '3-4 weeks before' }, { value: '6', label: 'From the start of semester' }], key: 'examPrepWeek' },
  { id: 'pq5', question: 'Which question format do you prefer?', options: [{ value: 'mcq', label: 'Multiple Choice (MCQ)' }, { value: 'short-answer', label: 'Short Answer (1-3 sentences)' }, { value: 'essay', label: 'Long-form / Essay' }], key: 'preferredQuestionFormat' },
  { id: 'pq6', question: 'A farmer has 17 sheep. All but 9 die. How many sheep are left?', options: [{ value: '8', label: '8 sheep' }, { value: '9', label: '9 sheep', correct: true }, { value: '17', label: '17 sheep' }, { value: '0', label: '0 sheep' }], key: 'cognitive1', type: 'iq' },
  { id: 'pq7', question: 'If you rearrange the letters "CIFAIPC", you get the name of a(n):', options: [{ value: 'ocean', label: 'Ocean', correct: true }, { value: 'city', label: 'City' }, { value: 'animal', label: 'Animal' }, { value: 'country', label: 'Country' }], key: 'cognitive2', type: 'iq' },
];

export default function QuizPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [persona, setPersona] = useState(null);

  const progress = ((current) / questions.length) * 100;
  const q = questions[current];

  const handleNext = () => {
    if (!selected) return;
    const newAnswers = { ...answers, [q.key]: selected };
    setAnswers(newAnswers);
    setSelected(null);

    if (current < questions.length - 1) {
      setCurrent(current + 1);
    } else {
      // Build persona
      const cognitiveScore = (newAnswers.cognitive1 === '9' ? 5 : 0) + (newAnswers.cognitive2 === 'ocean' ? 5 : 0);
      const p = {
        learningStyle: newAnswers.learningStyle || 'long-term-gradual',
        studyHoursPerDay: parseInt(newAnswers.studyHoursPerDay) || 2,
        studyDaysPerWeek: parseInt(newAnswers.studyDaysPerWeek) || 4,
        examPrepWeek: parseInt(newAnswers.examPrepWeek) || 2,
        preferredQuestionFormat: newAnswers.preferredQuestionFormat || 'mcq',
        cognitiveScore: cognitiveScore,
        personalityTraits: [],
      };
      if (p.learningStyle === 'short-term-intensive') p.personalityTraits.push('focused-learner', 'deadline-driven');
      else p.personalityTraits.push('consistent-learner', 'self-paced');
      if (p.studyHoursPerDay >= 3) p.personalityTraits.push('dedicated');
      if (cognitiveScore >= 8) p.personalityTraits.push('analytical-thinker');
      setPersona(p);
      setShowResults(true);
    }
  };

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
            <div className="flex items-center justify-between p-4 bg-teal-500/10 border border-teal-500/20 rounded-xl">
              <span className="text-sm text-slate-300">Cognitive Score</span>
              <span className="text-sm font-bold text-teal-300">{persona.cognitiveScore}/10</span>
            </div>
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
              <button key={opt.value} onClick={() => setSelected(opt.value)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${selected === opt.value ? 'bg-blue-500/20 border-blue-500/50 ring-1 ring-blue-500/30' : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'}`}>
                <span className={`text-sm ${selected === opt.value ? 'text-blue-200 font-medium' : 'text-slate-300'}`}>{opt.label}</span>
              </button>
            ))}
          </div>
          <button onClick={handleNext} disabled={!selected}
            className={`w-full mt-6 py-3.5 rounded-xl font-semibold transition-all ${selected ? 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg hover:shadow-blue-500/25' : 'bg-white/5 text-slate-500 cursor-not-allowed'}`}>
            {current === questions.length - 1 ? 'View My Learner DNA →' : 'Next Question →'}
          </button>
        </div>
      </div>
    </div>
  );
}
