'use client';

import type { LostHelpResponse } from '@/lib/ai-help';

type LostHelpModalProps = {
  open: boolean;
  content: LostHelpResponse | null;
  onClose: () => void;
};

export function LostHelpModal({ open, content, onClose }: LostHelpModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-xl font-semibold mb-4">Quick help</h2>
        {content ? (
          <div className="space-y-4 text-gray-200">
            <p><strong>Summary:</strong> {content.summary}</p>
            <p><strong>Example:</strong> {content.example}</p>
            <p><strong>Check:</strong> {content.question}</p>
          </div>
        ) : (
          <p>Loading...</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-2 rounded-lg bg-gray-600 hover:bg-gray-500"
        >
          Close
        </button>
      </div>
    </div>
  );
}
