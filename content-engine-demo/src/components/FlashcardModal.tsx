'use client';

import { useEffect, useState } from 'react';
import type { Flashcard } from '@/lib/ai-help';

export type FlashcardModalProps = {
  open: boolean;
  cards: Flashcard[];
  onClose: () => void;
};

export function FlashcardModal({ open, cards, onClose }: FlashcardModalProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Reset state when modal opens or cards change
  useEffect(() => {
    if (open) {
      setIndex(0);
      setFlipped(false);
    }
  }, [open, cards]);

  if (!open) return null;

  const card = cards[index];
  const isLast = cards.length === 0 || index >= cards.length - 1;

  const next = () => {
    setFlipped(false);
    if (isLast) onClose();
    else setIndex((i) => i + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6">
        <p className="text-amber-400 font-medium mb-1">You didn’t pass the quiz</p>
        <h2 className="text-xl font-semibold mb-4 text-gray-200">Quick review — then try again</h2>
        {cards.length === 0 && <p className="text-gray-400">Loading cards...</p>}
        {card && (
          <div
            className={`min-h-[120px] p-4 rounded-lg cursor-pointer ${flipped ? 'bg-emerald-900/60 border border-emerald-500/50' : 'bg-gray-700'}`}
            onClick={() => setFlipped((f) => !f)}
          >
            <p className={flipped ? 'text-emerald-100 font-bold' : 'text-gray-100'}>
              {flipped ? card.back : card.front}
            </p>
            <p className="text-sm text-gray-400 mt-2">Tap to flip</p>
          </div>
        )}
        <div className="mt-4 flex justify-between">
          <span className="text-sm text-gray-400">
            {cards.length > 0 ? `Card ${index + 1} of ${cards.length}` : 'No cards'}
          </span>
          <button
            type="button"
            onClick={next}
            className="py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700"
          >
            {isLast ? 'Continue to retry quiz' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
