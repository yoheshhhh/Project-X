'use client';

import { useState, useEffect } from 'react';
import type { QuizQuestion } from '@/types/learning';

const PASS_THRESHOLD = 70;

export function QuizModal({
  open,
  segmentIndex,
  questions,
  loading = false,
  error = false,
  errorMessage,
  cooldownUntil = 0,
  onRetry,
  onPass,
  onFail,
  onShowFlashcards,
  flashcardLoading = false,
  flashcardError = null,
}: {
  open: boolean;
  segmentIndex: number;
  questions: QuizQuestion[];
  loading?: boolean;
  error?: boolean;
  errorMessage?: string | null;
  cooldownUntil?: number;
  onRetry?: () => void;
  onPass: (score: number, mistakes?: { question: string; chosenOption: string; correctOption: string }[]) => void;
  onFail: (mistakes?: { question: string; chosenOption: string; correctOption: string }[]) => void;
  onShowFlashcards?: () => void;
  flashcardLoading?: boolean;
  flashcardError?: string | null;
}) {
  const retryDisabled = cooldownUntil > 0 && Date.now() < cooldownUntil;
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setAnswers({});
      setSubmitted(false);
      setScore(null);
    }
  }, [open, segmentIndex]);

  const handleSelect = (questionId: string, optionIndex: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const getMistakes = () =>
    questions
      .filter((q) => answers[q.id] !== undefined && answers[q.id] !== q.correctIndex)
      .map((q) => ({
        question: q.question,
        chosenOption: q.options[answers[q.id]] ?? '—',
        correctOption: q.options[q.correctIndex] ?? '—',
      }));

  const handleSubmit = () => {
    if (questions.length === 0) return;
    let correct = 0;
    questions.forEach((q) => { if (answers[q.id] === q.correctIndex) correct++; });
    const pct = Math.round((correct / questions.length) * 100);
    setScore(pct);
    setSubmitted(true);
    if (pct >= PASS_THRESHOLD) {
      // Don't call onPass yet; show Proceed button
    } else {
      onFail(getMistakes());
    }
  };

  const handleProceed = () => {
    if (score === null || score < PASS_THRESHOLD) return;
    onPass(score, getMistakes());
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
    setScore(null);
  };

  if (!open) return null;

  if (questions.length === 0 && loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-slate-800/95 border border-white/10 rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-semibold text-white mb-1">Segment {segmentIndex + 1}</h2>
          <p className="text-slate-400 text-sm">Reading this segment&apos;s slides and generating questions…</p>
          <p className="text-slate-500 text-xs mt-1">Usually 15–30 seconds</p>
          <div className="mt-4 h-8 w-8 mx-auto border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" aria-hidden />
        </div>
      </div>
    );
  }

  if (questions.length === 0 && error && onRetry) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-slate-800/95 border border-white/10 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-semibold text-white mb-1">Segment {segmentIndex + 1}</h2>
          <p className="text-slate-400 text-sm mb-4">
            {errorMessage ?? 'Couldn\'t generate questions. Check your connection and API settings.'}
          </p>
          {(errorMessage ?? '').toLowerCase().includes('rate limit') && (
            <p className="text-slate-500 text-xs mb-3">
              Quiz uses OpenAI; 429 means your API key’s quota is exceeded. Wait 1–2 minutes or check your quota.
            </p>
          )}
          <button
            type="button"
            onClick={onRetry}
            disabled={retryDisabled}
            className="w-full py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
          >
            {retryDisabled ? 'Wait 1 min...' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-slate-800/95 border border-white/10 rounded-2xl shadow-2xl max-w-sm w-full p-5 text-center">
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-semibold text-white mb-1">Segment {segmentIndex + 1}</h2>
          <p className="text-slate-400 text-sm mb-4">No quiz for this segment.</p>
          <button type="button" onClick={() => onPass(100)} className="w-full py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white transition-colors">
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="bg-slate-800/95 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[70vh] overflow-hidden flex flex-col"
        style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)' }}
      >
        {/* Compact header */}
        <div className="flex-shrink-0 border-b border-white/5 px-4 py-2">
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-xs font-semibold text-indigo-300">Segment {segmentIndex + 1}</p>
          <h2 className="text-sm font-semibold text-white mt-0.5">Check your understanding</h2>
        </div>

        {!submitted ? (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-3">
              {questions.map((q, qIdx) => (
                <div key={q.id} className="space-y-1">
                  <p className="text-xs font-medium text-slate-400">Question {qIdx + 1}</p>
                  <p className="text-sm font-medium text-slate-200 leading-snug">{q.question}</p>
                  <div className="space-y-0.5">
                    {q.options.map((opt, i) => {
                      const selected = answers[q.id] === i;
                      return (
                        <label
                          key={i}
                          className={`flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1 text-sm transition-colors ${
                            selected
                              ? 'bg-indigo-500/25 text-indigo-100 ring-1 ring-indigo-400/50'
                              : 'text-slate-300 hover:bg-slate-700/60'
                          }`}
                        >
                          <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-indigo-400 bg-indigo-500' : 'border-slate-500 bg-transparent'}`}>
                            {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                          </span>
                          <input
                            type="radio"
                            name={q.id}
                            checked={selected}
                            onChange={() => handleSelect(q.id, i)}
                            className="sr-only"
                          />
                          <span className="flex-1 min-w-0">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex-shrink-0 border-t border-white/5 px-4 py-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={Object.keys(answers).length !== questions.length}
                className="w-full py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white transition-all"
              >
                Submit
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-4 text-center">
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-base font-bold ${score !== null && score >= PASS_THRESHOLD ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {score}%
            </div>
            <p className="mt-2 text-sm font-semibold text-white">You scored {score}%</p>
            {score !== null && score >= PASS_THRESHOLD ? (
              <>
                <p className="mt-0.5 text-xs text-emerald-400/90">You passed! Next segment unlocked.</p>
                <button type="button" onClick={handleProceed} className="mt-3 w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white transition-colors">
                  Proceed
                </button>
              </>
            ) : (
              <>
                <p className="mt-0.5 text-xs text-amber-400/90">Not quite. Retry the quiz or review with flashcards.</p>
                {flashcardError && (
                  <p className="mt-2 text-xs text-red-400">{flashcardError}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={handleRetry} className="flex-1 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-sm font-semibold text-white transition-colors">
                    Retry quiz
                  </button>
                  {onShowFlashcards && (
                    <button
                      type="button"
                      onClick={onShowFlashcards}
                      disabled={flashcardLoading}
                      className="flex-1 py-1.5 rounded-xl bg-slate-600 hover:bg-slate-500 text-sm font-semibold text-white transition-colors border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {flashcardLoading ? 'Generating…' : 'Show flashcards'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
