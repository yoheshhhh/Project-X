/**
 * Shared types for Content Engine.
 */
export type MasteryLevel = 'Mastered' | 'Partial' | 'Weak';

export type Segment = { start: number; end: number };

export type ModuleProgress = {
  userId: string;
  moduleId: string;
  unlockedSegmentIndex: number;
  /** Highest segment index whose end the user has reached by watching (time-based unlock). */
  reachedSegmentEndIndex: number;
  segmentAttempts: Record<number, number>;
  segmentMastery: Record<number, MasteryLevel>;
  quizScores: Record<number, number>;
  lastWatchedTimestamp?: number;
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
};

export type SegmentQuiz = { segmentIndex: number; questions: QuizQuestion[] };

export type ModuleConfig = {
  moduleId: string;
  youtubeVideoId: string;
  segments?: Segment[];
  numberOfSegments?: number;
  defaultDurationSeconds?: number;
  quizzes: SegmentQuiz[];
};
