'use client';

import { useState, useEffect } from 'react';
import type { QuizQuestion } from '@/types/learning';

const PASS_THRESHOLD = 70;

export function QuizModal({
  open,
  segmentIndex,
  questions,
  onPass,
  onFail,
}: {
  open: boolean;
  segmentIndex: number;
  questions: QuizQuestion[];
  onPass: (score: number) => void;
  onFail: () => void;
}) {
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
      onFail();
    }
  };

  const handleProceed = () => {
    if (score !== null && score >= PASS_THRESHOLD) onPass(score);
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
    setScore(null);
  };

  if (!open) return null;

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">Segment {segmentIndex + 1}</h2>
          <p className="text-gray-400 mb-4">No quiz for this segment.</p>
          <button type="button" onClick={() => onPass(100)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700">
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-xl font-semibold mb-4">Segment {segmentIndex + 1} – Check your understanding</h2>
        {!submitted ? (
          <>
            <div className="space-y-6">
              {questions.map((q) => (
                <div key={q.id}>
                  <p className="font-medium text-gray-200 mb-2">{q.question}</p>
                  <div className="space-y-2">
                    {q.options.map((opt, i) => (
                      <label key={i} className="flex items-center gap-2 cursor-pointer p-2 rounded bg-gray-700 hover:bg-gray-600">
                        <input type="radio" name={q.id} checked={answers[q.id] === i} onChange={() => handleSelect(q.id, i)} className="rounded" />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={handleSubmit} disabled={Object.keys(answers).length !== questions.length} className="mt-6 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
              Submit
            </button>
          </>
        ) : (
          <div className="text-center">
            <p className="text-2xl font-bold mb-2">You scored {score}%</p>
            {score !== null && score >= PASS_THRESHOLD ? (
              <>
                <p className="text-green-400 mb-4">You passed! Next segment unlocked.</p>
                <button type="button" onClick={handleProceed} className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 font-medium">
                  Proceed
                </button>
              </>
            ) : (
              <>
                <p className="text-amber-400 mb-4">Not quite. Try again or review the flashcards.</p>
                <button type="button" onClick={handleRetry} className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-medium">
                  Retry
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
