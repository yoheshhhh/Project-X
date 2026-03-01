'use client';

import { useCallback, useEffect, useState } from 'react';
import { VideoPlayer } from '@/components/VideoPlayer';
import { QuizModal } from '@/components/QuizModal';
import { ChatbotModal } from '@/components/ChatbotModal';
import { FlashcardModal } from '@/components/FlashcardModal';
import { demoModule } from '@/data/demoModule';
import { getSegmentFlashcards } from '@/data/segmentFlashcards';
import { progressService } from '@/lib/progress';
import { aiHelpService } from '@/lib/ai-help';
import type { Segment, ModuleProgress } from '@/types/learning';
import type { Flashcard } from '@/lib/ai-help';

const DEMO_USER = 'user-1';
const MODULE_ID = 'demo-1';

function buildSegments(duration: number, count: number): Segment[] {
  const segLen = duration / count;
  return Array.from({ length: count }, (_, i) => ({
    start: i * segLen,
    end: i === count - 1 ? duration : (i + 1) * segLen,
  }));
}

export default function WatchPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [progress, setProgressState] = useState<ModuleProgress | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizSegmentIndex, setQuizSegmentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [flashcardOpen, setFlashcardOpen] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);

  const loadProgress = useCallback(async () => {
    const p = await progressService.getProgress(DEMO_USER, MODULE_ID);
    if (p) {
      if (p.reachedSegmentEndIndex === undefined) {
        const scores = p.quizScores ?? {};
        const maxScored = Object.keys(scores).length ? Math.max(...Object.keys(scores).map(Number)) : -1;
        p.reachedSegmentEndIndex = maxScored;
        await progressService.setProgress(p);
      }
      setProgressState(p);
    } else {
      setProgressState({ userId: DEMO_USER, moduleId: MODULE_ID, unlockedSegmentIndex: 0, reachedSegmentEndIndex: -1, segmentAttempts: {}, segmentMastery: {}, quizScores: {} });
    }
  }, []);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  useEffect(() => {
    if (demoModule.segments?.length) setSegments(demoModule.segments);
  }, []);

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
    const quiz = demoModule.quizzes?.find((q) => q.segmentIndex === segmentIndex);
    if (quiz?.questions?.length) {
      setQuizSegmentIndex(segmentIndex);
      setQuizOpen(true);
    }
    progressService.recordSegmentReached(DEMO_USER, MODULE_ID, segmentIndex).then(loadProgress);
  }, [loadProgress]);

  const handleQuizPass = useCallback(
    async (score: number) => {
      await progressService.recordQuizResult(DEMO_USER, MODULE_ID, quizSegmentIndex, score);
      await loadProgress();
      setQuizOpen(false);
      setPaused(false);
    },
    [quizSegmentIndex, loadProgress]
  );

  const handleQuizFail = useCallback(async () => {
    const prevAttempts = progress?.segmentAttempts[quizSegmentIndex] ?? 0;
    await progressService.recordQuizAttempt(DEMO_USER, MODULE_ID, quizSegmentIndex);
    await loadProgress();
    const newAttempts = prevAttempts + 1;
    if (newAttempts >= 2) {
      const cards = getSegmentFlashcards(quizSegmentIndex);
      setFlashcards(cards.length > 0 ? cards : await aiHelpService.getFlashcards(quizSegmentIndex));
      setQuizOpen(false);
      setFlashcardOpen(true);
    }
  }, [progress?.segmentAttempts, quizSegmentIndex, loadProgress]);

  const handleLostClick = useCallback(() => {
    setChatbotOpen(true);
  }, []);

  const openQuizForSegment = useCallback((segmentIndex: number) => {
    const quiz = demoModule.quizzes?.find((q) => q.segmentIndex === segmentIndex);
    if (reached >= segmentIndex && quiz?.questions?.length) {
      setQuizSegmentIndex(segmentIndex);
      setQuizOpen(true);
    }
  }, [reached]);

  const quizForSegment = demoModule.quizzes.find((q) => q.segmentIndex === quizSegmentIndex);
  const questions = quizForSegment?.questions ?? [];

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 text-white p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-2">Content Engine — Watch</h1>
      <p className="text-slate-400 text-sm mb-4">
        {reached < 0
          ? `Watch the video to the end of each segment to unlock its quiz.`
          : `Segment ${reached + 1} of ${numberOfSegments} reached • Pass the quiz at each segment end to continue.`}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {segments.map((seg, i) => {
          const hasQuiz = demoModule.quizzes?.find((q) => q.segmentIndex === i)?.questions?.length;
          const passed = (progress?.quizScores?.[i] ?? 0) >= 70;
          const prevPassed = i === 0 || (progress?.quizScores?.[i - 1] ?? 0) >= 70;
          const canOpen = hasQuiz && reached >= i && prevPassed;
          return (
            <button
              key={i}
              type="button"
              onClick={() => canOpen && openQuizForSegment(i)}
              disabled={!canOpen}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                canOpen ? 'bg-slate-600 hover:bg-slate-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
              title={canOpen ? `Take quiz: Segment ${i + 1}` : prevPassed ? `Watch to ${formatTime(seg.end)} to unlock` : `Pass Segment ${i} first`}
            >
              Segment {i + 1}
              {passed && <span className="text-green-400" aria-hidden>✓</span>}
            </button>
          );
        })}
      </div>

      <div className="relative">
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
        <button type="button" onClick={handleLostClick} className="mt-3 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-sm font-medium">
          I&apos;m Lost
        </button>
      </div>

      <QuizModal open={quizOpen} segmentIndex={quizSegmentIndex} questions={questions} onPass={handleQuizPass} onFail={handleQuizFail} />
      <ChatbotModal
        open={chatbotOpen}
        onClose={() => setChatbotOpen(false)}
        segmentIndex={segmentForLost}
        currentTimeSeconds={currentTime}
        segmentCount={numberOfSegments}
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
