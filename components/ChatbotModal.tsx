'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '@/lib/api-client';

export type ChatMessage = { role: 'user' | 'model'; text: string; image?: string };

type ChatbotModalProps = {
  open: boolean;
  onClose: () => void;
  segmentIndex?: number;
  currentTimeSeconds?: number;
  segmentCount?: number;
  moduleTopic?: string;
  segmentTitle?: string;
};

export function ChatbotModal({
  open,
  onClose,
  segmentIndex = 0,
  currentTimeSeconds = 0,
  segmentCount = 1,
  moduleTopic = '',
  segmentTitle = '',
}: ChatbotModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const systemInstructionRef = useRef<string>('');

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Reset chat only when modal opens or segment/topic changes — not when currentTimeSeconds ticks (would clear attached image).
  useEffect(() => {
    if (!open) return;
    setMessages([]);
    setError(null);
    setInput('');
    setAttachedImage(null);

    const topicContext = [moduleTopic, segmentTitle].filter(Boolean).join('. ');
    const context = topicContext
      ? `You are a tutor helping a student with ONE specific video lecture. The subject of this video is ONLY: ${topicContext}. Current segment (${segmentIndex + 1} of ${segmentCount}): "${segmentTitle}". Video time: about ${Math.floor(currentTimeSeconds / 60)}:${String(currentTimeSeconds % 60).padStart(2, '0')}. They clicked "I'm lost". RULES: Answer ONLY about this video's topic (e.g. computer/software security, format strings, vulnerabilities). Do NOT mention or discuss any other subject (no biology, no mathematics/differentiation, no chemistry, no unrelated topics). If the student asks about something outside this video, politely redirect to the current topic. Be concise and helpful.`
      : `The student is watching a learning video. They are on segment ${segmentIndex + 1} of ${segmentCount} (about ${Math.floor(currentTimeSeconds / 60)}:${String(currentTimeSeconds % 60).padStart(2, '0')} in). They clicked "I'm lost". Be concise and helpful.`;
    systemInstructionRef.current = context;

    const greeting = segmentTitle
      ? `Hi! You're on Segment ${segmentIndex + 1}: ${segmentTitle}. ${moduleTopic ? `This module is about: ${moduleTopic}. ` : ''}Ask me anything about this video or the material—I'm here to help.`
      : `Hi! You're on segment ${segmentIndex + 1}. Ask me anything about the video or the material—I'm here to help.`;
    setMessages([{ role: 'model', text: greeting }]);
  }, [open, segmentIndex, segmentCount, moduleTopic, segmentTitle]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    const imageToSend = attachedImage ?? undefined;
    if ((!text && !imageToSend) || loading) return;

    const displayText = text || "What's the doubt or question in this image? Please explain.";
    setInput('');
    setAttachedImage(null);
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', text: displayText, image: imageToSend }]);
    setLoading(true);

    try {
      const chatMessages = [...messages, { role: 'user' as const, text: displayText, image: imageToSend }];
      const apiMessages = chatMessages.map((m) => ({
        role: m.role === 'model' ? ('assistant' as const) : ('user' as const),
        content: m.text,
      }));

      const res = await authFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          systemInstruction: systemInstructionRef.current,
          image: imageToSend,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }
      const reply = data.text ?? "I couldn't generate a response. Try rephrasing.";
      setMessages((prev) => [...prev, { role: 'model', text: reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
      setMessages((prev) => [...prev, { role: 'model', text: message }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, attachedImage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Ask for help</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-700 text-gray-200'
                }`}
              >
                {msg.role === 'user' && msg.image && (
                  <img src={msg.image} alt="Attached" className="mb-2 max-h-32 rounded object-contain border border-white/20" />
                )}
                {msg.text}
              </div>
            </div>
          ))}
          {error && (
            <p className="text-red-400 text-sm px-1">{error}</p>
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-700 rounded-lg px-3 py-2 text-sm text-gray-400">
                Thinking…
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 border-t border-gray-700">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setAttachedImage(reader.result as string);
              reader.readAsDataURL(file);
              e.target.value = '';
            }}
          />
          {attachedImage && (
            <div className="mb-2 flex items-center gap-2">
              <img src={attachedImage} alt="Attached" className="h-10 w-10 rounded object-cover border border-gray-500" />
              <span className="text-xs text-gray-400">Image attached</span>
              <button type="button" onClick={() => setAttachedImage(null)} className="ml-auto text-gray-400 hover:text-white p-1 rounded" aria-label="Remove image">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="p-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-400 hover:text-white hover:bg-gray-600 disabled:opacity-50 shrink-0"
              title="Attach image (screenshot, handwritten doubt)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question or attach an image..."
              className="flex-1 rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={loading}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || (!input.trim() && !attachedImage)}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
