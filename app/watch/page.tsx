'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { VideoPlayer } from '@/components/VideoPlayer';
import { QuizModal } from '@/components/QuizModal';
import { ChatbotModal } from '@/components/ChatbotModal';
import { FlashcardModal } from '@/components/FlashcardModal';
import { demoModule } from '@/data/demoModule';
import { getSegmentFlashcards } from '@/data/segmentFlashcards';
import { progressService } from '@/lib/progress';
import { aiHelpService } from '@/lib/ai-help';
import { auth, onAuthStateChanged } from '@/lib/firebase';
import type { Segment, ModuleProgress, QuizQuestion } from '@/types/learning';
import type { Flashcard } from '@/lib/ai-help';

const DEMO_USER = 'user-1';
const DEFAULT_MODULE_ID = 'demo-1';
const COOLDOWN_MS = 60_000; // 1 min after 429 before allowing retry

function buildSegments(duration: number, count: number): Segment[] {
  const segLen = duration / count;
  return Array.from({ length: count }, (_, i) => ({
    start: i * segLen,
    end: i === count - 1 ? duration : (i + 1) * segLen,
  }));
}

export default function WatchPage() {
  const searchParams = useSearchParams();
  const moduleId = searchParams.get('moduleId') || DEFAULT_MODULE_ID;
  /** Topic for this video — from the link that opened this page. Used for heading and Firebase (moduleProgress, segmentQuizScores). */
  const pageTopic = searchParams.get('topic')?.trim() || 'Software Security II';
  const [userId, setUserId] = useState<string>(DEMO_USER);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [progress, setProgressState] = useState<ModuleProgress | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizSegmentIndex, setQuizSegmentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [flashcardOpen, setFlashcardOpen] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState(false);
  const [questionsErrorMessage, setQuestionsErrorMessage] = useState<string | null>(null);
  /** Segment slides from PDF (content/slides.pdf) or fallback to demoModule.segmentSlides */
  const [segmentSlidesFromApi, setSegmentSlidesFromApi] = useState<string[] | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const inFlightRef = useRef<Record<string, Promise<QuizQuestion[]> | null>>({});
  const lastFailRef = useRef<Record<string, number>>({});

  const fetchQuizOnce = useCallback(async (segmentIndex: number, segmentSlides: string): Promise<QuizQuestion[]> => {
    const key = String(segmentIndex);
    const now = Date.now();
    const lastFail = lastFailRef.current[key] ?? 0;
    if (now - lastFail < COOLDOWN_MS) {
      throw new Error('Rate limit exceeded. Please wait a minute and try again.');
    }
    if (inFlightRef.current[key]) {
      return inFlightRef.current[key]!;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    const promise = (async () => {
      try {
        const res = await fetch('/api/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segmentIndex, segmentSlides }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 429) lastFailRef.current[key] = Date.now();
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to generate quiz');
        }
        if (!Array.isArray(data.questions) || data.questions.length === 0) {
          throw new Error('No questions returned.');
        }
        return data.questions as QuizQuestion[];
      } finally {
        clearTimeout(timeoutId);
        inFlightRef.current[key] = null;
      }
    })();
    inFlightRef.current[key] = promise;
    return promise;
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserId(u?.uid ?? DEMO_USER);
    });
    return () => unsub();
  }, []);

  const loadProgress = useCallback(async () => {
    const p = await progressService.getProgress(userId, moduleId);
    if (p) {
      if (p.reachedSegmentEndIndex === undefined) {
        const scores = p.quizScores ?? {};
        const maxScored = Object.keys(scores).length ? Math.max(...Object.keys(scores).map(Number)) : -1;
        p.reachedSegmentEndIndex = maxScored;
        await progressService.setProgress(p);
      }
      setProgressState(p);
    } else {
      const initial = { userId, moduleId, moduleName: pageTopic, moduleTopic: pageTopic, unlockedSegmentIndex: 0, reachedSegmentEndIndex: -1, segmentAttempts: {}, segmentMastery: {}, quizScores: {} };
      setProgressState(initial);
      progressService.setProgress(initial);
    }
  }, [userId, moduleId, pageTopic]);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  useEffect(() => {
    if (demoModule.segments?.length) setSegments(demoModule.segments);
  }, []);

  useEffect(() => {
    fetch(`/api/segment-slides?moduleId=${encodeURIComponent(moduleId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.segmentSlides) && data.segmentSlides.length > 0) {
          setSegmentSlidesFromApi(data.segmentSlides);
        }
      })
      .catch(() => { /* keep null, use demo fallback */ });
  }, [moduleId]);

  useEffect(() => {
    if (progress && progress.moduleTopic !== pageTopic) {
      const updated = { ...progress, moduleTopic: pageTopic };
      setProgressState(updated);
      progressService.setProgress(updated);
    }
  }, [progress, pageTopic]);

  const effectiveSegmentSlides = segmentSlidesFromApi ?? demoModule.segmentSlides ?? [];

  const numberOfSegments = demoModule.segments?.length ?? demoModule.numberOfSegments ?? 3;
  const durationReady = useCallback(
    (duration: number) => {
      if (segments.length === 0 && !demoModule.segments?.length) {
        const d = duration > 0 ? duration : (demoModule.defaultDurationSeconds ?? 600);
        setSegments(buildSegments(d, numberOfSegments));
      }
    },
    [numberOfSegments, segments.length]
  );

  const unlocked = progress?.unlockedSegmentIndex ?? 0;
  const reached = (progress?.reachedSegmentEndIndex ?? -1) as number;
  const lastSegmentIndex = Math.max(0, segments.length - 1);
  const allowedEndTime =
    segments.length > 0
      ? segments[Math.min(unlocked, lastSegmentIndex)]?.end ?? segments[lastSegmentIndex]?.end ?? 999999
      : 999999;
  const currentSegmentIndex = segments.findIndex((s) => currentTime >= s.start && currentTime < s.end);
  const segmentForLost = currentSegmentIndex >= 0 ? currentSegmentIndex : 0;

  const handleSegmentEnd = useCallback((segmentIndex: number) => {
    if (!effectiveSegmentSlides[segmentIndex]) return;
    setQuizSegmentIndex(segmentIndex);
    setQuizOpen(true);
    progressService.recordSegmentReached(userId, moduleId, segmentIndex).then(loadProgress);
  }, [loadProgress, effectiveSegmentSlides]);

  const handleQuizPass = useCallback(
    async (score: number) => {
      await progressService.recordQuizResult(userId, moduleId, quizSegmentIndex, score);
      await loadProgress();
      setQuizOpen(false);
      setPaused(false);
    },
    [quizSegmentIndex, loadProgress]
  );

  const handleQuizFail = useCallback(async () => {
    await progressService.recordQuizAttempt(userId, moduleId, quizSegmentIndex);
    await loadProgress();
  }, [quizSegmentIndex, loadProgress]);

  const handleShowFlashcards = useCallback(async () => {
    const segmentSlides = effectiveSegmentSlides[quizSegmentIndex];
    if (segmentSlides) {
      try {
        const res = await fetch('/api/generate-segment-flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segmentIndex: quizSegmentIndex, segmentSlides, count: 6 }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.flashcards) && data.flashcards.length > 0) {
            setFlashcards(data.flashcards);
            setQuizOpen(false);
            await progressService.recordFlashcardUsed(userId, moduleId, quizSegmentIndex);
            setFlashcardOpen(true);
            return;
          }
        }
      } catch {
        // fallback below
      }
    }
    const cards = getSegmentFlashcards(quizSegmentIndex);
    setFlashcards(cards.length > 0 ? cards : await aiHelpService.getFlashcards(quizSegmentIndex));
    setQuizOpen(false);
    await progressService.recordFlashcardUsed(userId, moduleId, quizSegmentIndex);
    setFlashcardOpen(true);
  }, [quizSegmentIndex, effectiveSegmentSlides, userId, moduleId]);

  const handleLostClick = useCallback(() => {
    setChatbotOpen(true);
  }, []);

  const openQuizForSegment = useCallback((segmentIndex: number) => {
    const hasSlides = !!effectiveSegmentSlides[segmentIndex];
    if (reached >= segmentIndex && hasSlides) {
      setQuizSegmentIndex(segmentIndex);
      setQuizOpen(true);
    }
  }, [reached, effectiveSegmentSlides]);

  const [quizRetryKey, setQuizRetryKey] = useState(0);

  // Load quiz: one request per segment (deduped with prefetch), cooldown after 429
  useEffect(() => {
    if (!quizOpen) return;
    const segmentIndex = quizSegmentIndex;
    const segmentSlides = effectiveSegmentSlides[segmentIndex];
    if (!segmentSlides) {
      setQuestions([]);
      setQuestionsLoading(false);
      setQuestionsError(false);
      return;
    }
    setQuestions([]);
    setQuestionsError(false);
    setQuestionsErrorMessage(null);
    setQuestionsLoading(true);

    fetchQuizOnce(segmentIndex, segmentSlides)
      .then((q) => {
        setQuestions(q);
      })
      .catch((err: Error) => {
        setQuestionsError(true);
        const msg = err?.name === 'AbortError'
          ? 'Request took too long. Try again or use a shorter segment.'
          : (err?.message ?? 'Failed to generate quiz.');
        setQuestionsErrorMessage(msg);
        if (typeof msg === 'string' && msg.toLowerCase().includes('rate limit')) {
          setCooldownUntil(Date.now() + COOLDOWN_MS);
        }
      })
      .finally(() => {
        setQuestionsLoading(false);
      });
  }, [quizOpen, quizSegmentIndex, quizRetryKey, effectiveSegmentSlides, fetchQuizOnce]);

  // Clear cooldown when timer expires so Retry button re-enables
  useEffect(() => {
    if (cooldownUntil <= 0) return;
    const t = setTimeout(() => setCooldownUntil(0), cooldownUntil - Date.now());
    return () => clearTimeout(t);
  }, [cooldownUntil]);

  const questionsToShow = questions;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen w-full text-white" style={{ background: 'linear-gradient(180deg, var(--watch-bg) 0%, #1e293b 50%, var(--watch-bg) 100%)' }}>
      {/* Back to courses - top left corner */}
      <Link
        href="/course"
        className="fixed left-4 top-4 z-10 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors md:left-6 md:top-6"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to courses
      </Link>

      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">
        {/* Header */}
        <header className="mb-8">
          <p className="font-medium text-indigo-300/90 text-sm uppercase tracking-widest mb-1">Content Engine</p>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl md:text-3xl font-bold tracking-tight text-white">
            {pageTopic}
          </h1>
          <p className="mt-1 text-slate-500 font-mono text-sm">{moduleId}</p>
          <p className="mt-2 text-slate-400 text-sm max-w-xl">
            {reached < 0
              ? 'Watch the video to the end of each segment to unlock its quiz.'
              : `Segment ${reached + 1} of ${numberOfSegments} reached — Pass the quiz at each segment end to continue.`}
          </p>
        </header>

        {/* Segment stepper */}
        <div className="mb-8 flex items-center gap-0">
          {segments.map((seg, i) => {
            const hasSlides = !!effectiveSegmentSlides[i];
            const passed = (progress?.quizScores?.[i] ?? 0) >= 70;
            const prevPassed = i === 0 || (progress?.quizScores?.[i - 1] ?? 0) >= 70;
            const canOpen = hasSlides && reached >= i && prevPassed;
            const isLast = i === segments.length - 1;
            return (
              <div key={i} className="flex items-center">
                <button
                  type="button"
                  onClick={() => canOpen && openQuizForSegment(i)}
                  disabled={!canOpen}
                  title={canOpen ? `Take quiz: Segment ${i + 1}` : prevPassed ? `Watch to ${formatTime(seg.end)} to unlock` : `Pass Segment ${i} first`}
                  className={`
                    relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200
                    ${passed
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30 hover:bg-emerald-500/30 hover:ring-emerald-400/50'
                      : canOpen
                        ? 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/40 hover:bg-indigo-500/30 hover:ring-indigo-400/60 hover:shadow-[0_0_20px_var(--watch-glow)]'
                        : 'bg-slate-700/50 text-slate-500 cursor-not-allowed ring-1 ring-slate-600/50'}
                  `}
                >
                  <span>Segment {i + 1}</span>
                  {passed && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/30 text-emerald-300" aria-hidden>
                      ✓
                    </span>
                  )}
                </button>
                {!isLast && (
                  <div
                    className={`mx-0.5 h-px w-4 md:w-6 flex-shrink-0 ${i < reached ? 'bg-emerald-500/40' : 'bg-slate-600/60'}`}
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Video card */}
        <div
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-800/40 shadow-2xl ring-1 ring-black/20"
          style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)' }}
        >
          <div className="border-b border-white/5 bg-slate-800/60 px-4 py-3 md:px-5 md:py-3.5">
            <p className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-semibold text-slate-200">Lecture</p>
            <p className="text-xs text-slate-500 mt-0.5">Complete each segment and pass the quiz to continue</p>
          </div>
          <div className="p-3 md:p-4">
            <div className="relative overflow-hidden rounded-xl bg-black shadow-inner">
              <VideoPlayer
                videoId={demoModule.youtubeVideoId}
                segments={segments}
                allowedEndTime={allowedEndTime}
                currentSegmentIndex={currentSegmentIndex >= 0 ? currentSegmentIndex : 0}
                onSegmentEnd={handleSegmentEnd}
                onDurationReady={durationReady}
                onTimeUpdate={setCurrentTime}
                paused={paused}
                setPaused={setPaused}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleLostClick}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-200 transition-all hover:bg-amber-500/20 hover:border-amber-500/60 hover:text-amber-100"
              >
                <span className="text-amber-400" aria-hidden>?</span>
                I&apos;m Lost
              </button>
            </div>
          </div>
        </div>
      </div>

      <QuizModal
        open={quizOpen}
        segmentIndex={quizSegmentIndex}
        questions={questionsToShow}
        loading={questionsLoading}
        error={questionsError}
        errorMessage={questionsErrorMessage}
        cooldownUntil={cooldownUntil}
        onRetry={() => setQuizRetryKey((k) => k + 1)}
        onPass={handleQuizPass}
        onFail={handleQuizFail}
        onShowFlashcards={handleShowFlashcards}
      />
      <ChatbotModal
        open={chatbotOpen}
        onClose={() => setChatbotOpen(false)}
        segmentIndex={segmentForLost}
        currentTimeSeconds={currentTime}
        segmentCount={numberOfSegments}
        moduleTopic={pageTopic}
        segmentTitle={demoModule.segmentTitles?.[segmentForLost] ?? ''}
      />
      <FlashcardModal
        key={`flashcard-${quizSegmentIndex}`}
        open={flashcardOpen}
        cards={flashcards}
        onClose={() => { setFlashcardOpen(false); setQuizOpen(true); }}
      />
    </div>
  );
}
