'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useStudentData } from '@/lib/useStudentData';
import { authFetch } from '@/lib/api-client';

type Message = { role: 'user' | 'ai'; text: string; image?: string };
type ChatSize = 'compact' | 'expanded' | 'fullscreen';

const SIZE_STYLES: Record<ChatSize, string> = {
  compact: 'w-96 h-[500px] bottom-6 right-6',
  expanded: 'w-[560px] h-[700px] bottom-6 right-6',
  fullscreen: 'inset-4',
};

const QUICK_PROMPTS = [
  'What should I study next?',
  'My weak topics?',
  'Predict my score',
  'Exam in 1 hour — what to focus?',
  'Create a study plan',
  'Review schedule',
  'My cognitive load?',
  'Best time to study?',
];

/* ── Simple Markdown Renderer ─────────────────────────────────────────── */

function renderMarkdown(text: string) {
  // Split into lines and process
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Blank line → spacer
    if (!line.trim()) {
      elements.push(<div key={key++} className="h-2" />);
      continue;
    }

    // Numbered list: "1. Text" or "1) Text"
    const numMatch = line.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      elements.push(
        <div key={key++} className="flex gap-2 ml-1 my-0.5">
          <span className="text-blue-400 font-bold shrink-0">{numMatch[1]}.</span>
          <span>{inlineFormat(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Bullet list: "- Text" or "* Text" or "• Text"
    const bulletMatch = line.match(/^[-*•]\s+(.+)/);
    if (bulletMatch) {
      elements.push(
        <div key={key++} className="flex gap-2 ml-1 my-0.5">
          <span className="text-blue-400 shrink-0">•</span>
          <span>{inlineFormat(bulletMatch[1])}</span>
        </div>
      );
      continue;
    }

    // Regular line
    elements.push(<p key={key++} className="my-0.5">{inlineFormat(line)}</p>);
  }

  return <>{elements}</>;
}

/** Inline formatting: **bold**, *italic*, `code` */
function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^([\s\S]*?)\*\*([\s\S]+?)\*\*([\s\S]*)/);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
      parts.push(<strong key={key++} className="text-white font-bold">{boldMatch[2]}</strong>);
      remaining = boldMatch[3];
      continue;
    }

    // Italic: *text*
    const italicMatch = remaining.match(/^([\s\S]*?)\*([\s\S]+?)\*([\s\S]*)/);
    if (italicMatch) {
      if (italicMatch[1]) parts.push(<span key={key++}>{italicMatch[1]}</span>);
      parts.push(<em key={key++} className="text-blue-300">{italicMatch[2]}</em>);
      remaining = italicMatch[3];
      continue;
    }

    // Code: `text`
    const codeMatch = remaining.match(/^([\s\S]*?)`([\s\S]+?)`([\s\S]*)/);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>);
      parts.push(<code key={key++} className="bg-white/10 text-amber-300 px-1.5 py-0.5 rounded text-xs">{codeMatch[2]}</code>);
      remaining = codeMatch[3];
      continue;
    }

    // No match — push rest
    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }

  return <>{parts}</>;
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function AITutor() {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<ChatSize>('compact');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Hi! I\'m your Guardian AI Tutor 🛡️ I have full access to your learning analytics — memory retention, cognitive load, optimal study times, and predicted scores. Ask me anything about your studies!' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { studentData } = useStudentData();

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  const sendMessage = useCallback(async (messageText?: string) => {
    const text = (messageText || input).trim();
    if ((!text && !attachedImage) || loading) return;
    const questionToSend = text || 'What is the doubt or question in this image? Please explain or answer it.';
    const imageToSend = attachedImage ?? undefined;
    setInput('');
    setAttachedImage(null);

    const displayText = text ? text : '(Image: explain or answer the doubt shown)';
    const userMsg: Message = { role: 'user', text: displayText, image: imageToSend };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Build learning context from student data for the AI coach
      const learningContext = {
        overallRetention: studentData?.overallRetention,
        retentionRates: (studentData?.retentionRates || []).map((r: any) => ({
          topic: r.topic, retention: r.retention, urgency: r.urgency, daysSinceStudied: r.daysSinceStudied,
        })),
        learningVelocity: studentData?.learningVelocity,
        predictedScore: studentData?.predictedScore,
        cognitiveLoad: studentData?.currentCognitiveLoad,
        optimalStudyTime: (studentData?.optimalStudyTime || []).filter((t: any) => t.sessionCount > 0).map((t: any) => ({
          label: t.label, avgScore: t.avgScore, performance: t.performance,
        })),
        weakTopics: studentData?.weakTopics || [],
        strongTopics: studentData?.strongTopics || [],
        weeklyReport: studentData?.weeklyReport ? {
          avgScore: studentData.weeklyReport.avgScore,
          improvement: studentData.weeklyReport.improvement,
          quizzesCompleted: studentData.weeklyReport.quizzesCompleted,
          goalSuggestion: studentData.weeklyReport.goalSuggestion,
        } : null,
        knowledgeMap: (studentData?.knowledgeMap || []).map((n: any) => ({
          topic: n.topic, mastery: n.mastery, status: n.status,
        })),
      };

      const res = await authFetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: questionToSend, image: imageToSend, learningContext }),
      });
      const apiData = await res.json();
      setMessages(prev => [...prev, { role: 'ai', text: apiData.answer || 'Sorry, couldn\'t process that. Try again!' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Connection issue — please try again.' }]);
    }
    setLoading(false);
  }, [input, loading, attachedImage, studentData]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

  const cycleSize = () => {
    const order: ChatSize[] = ['compact', 'expanded', 'fullscreen'];
    setSize(order[(order.indexOf(size) + 1) % order.length]);
  };

  const clearChat = () => {
    setMessages([{ role: 'ai', text: 'Chat cleared! 🛡️ Ask me anything about your studies.' }]);
  };

  /* ── Floating Button ──────────────────────────────────────────────── */

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 hover:bg-blue-600 rounded-full shadow-xl shadow-blue-500/30 flex items-center justify-center text-2xl text-white transition-all hover:scale-110 z-50 group">
        🛡️
        <span className="absolute -top-10 right-0 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10">Guardian AI Tutor</span>
      </button>
    );
  }

  /* ── Chat Window ──────────────────────────────────────────────────── */

  const isFs = size === 'fullscreen';

  return (
    <div className={`fixed ${SIZE_STYLES[size]} bg-slate-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/50 flex flex-col z-50 overflow-hidden transition-all duration-300`}>
      {/* Header */}
      <div className="bg-blue-500/10 border-b border-white/10 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛡️</span>
          <div>
            <p className="text-sm font-bold text-white">Guardian AI Tutor</p>
            <p className="text-xs text-blue-300">SC3010 Computer Security · Powered by Gemini</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={cycleSize} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all" title="Resize">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {size === 'fullscreen'
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v4m0-4h4m7 11l5 5m0 0v-4m0 4h-4" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              }
            </svg>
          </button>
          <button onClick={clearChat} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all" title="Clear chat">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
          <button onClick={() => { setOpen(false); setSize('compact'); }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`${isFs ? 'max-w-[70%]' : 'max-w-[85%]'} px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-blue-500 text-white rounded-br-md'
                : 'bg-white/10 text-slate-200 rounded-bl-md'
            }`}>
              {m.role === 'ai' && <span className="text-xs text-blue-400 font-bold block mb-1">🛡️ Guardian AI</span>}
              {m.role === 'user' && m.image && (
                <img src={m.image} alt="Attached" className="mb-2 max-h-32 rounded-lg object-contain border border-white/20" />
              )}
              {m.role === 'ai' ? renderMarkdown(m.text) : m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/10 px-4 py-3 rounded-2xl rounded-bl-md">
              <span className="text-xs text-blue-400 font-bold block mb-1">🛡️ Guardian AI</span>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-2 shrink-0">
        <div className={`flex gap-2 overflow-x-auto pb-1 ${isFs ? 'flex-wrap' : ''}`}>
          {QUICK_PROMPTS.map(q => (
            <button key={q} onClick={() => sendMessage(q)} disabled={loading}
              className="text-xs bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white px-3 py-1.5 rounded-full whitespace-nowrap transition-all border border-white/10 disabled:opacity-50">
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" aria-hidden
          onChange={e => {
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
            <img src={attachedImage} alt="Attached" className="h-12 w-12 rounded-lg object-cover border border-white/20" />
            <span className="text-xs text-slate-400">Image attached — extract doubt / answer</span>
            <button type="button" onClick={() => setAttachedImage(null)} className="ml-auto text-slate-400 hover:text-white p-1 rounded" aria-label="Remove image">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-50 shrink-0" title="Attach image (screenshot, handwritten doubt)">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </button>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Ask anything... or attach an image of your doubt"
            className={`flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isFs ? 'text-base py-3' : ''}`}
            disabled={loading} />
          <button onClick={() => sendMessage()} disabled={(!input.trim() && !attachedImage) || loading}
            className={`bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/30 text-white px-4 py-2.5 rounded-xl transition-all text-sm font-semibold ${isFs ? 'px-6 text-base' : ''}`}>
            Send
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-1.5 text-center">
          {size === 'compact' ? '↗ Resize to expand' : size === 'expanded' ? '↗ Resize for fullscreen' : '↙ Resize to compact'}
        </p>
      </div>
    </div>
  );
}
