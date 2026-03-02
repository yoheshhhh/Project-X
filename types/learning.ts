/**
 * Shared types for Content Engine.
 */
export type MasteryLevel = 'Mastered' | 'Partial' | 'Weak';

export type Segment = { start: number; end: number };

export type ModuleProgress = {
  userId: string;
  moduleId: string;
  /** Human-readable course/module title (e.g. "COMPUTER SECURITY") for display */
  moduleName?: string;
  /** Topic from first slide of PDF (e.g. "Software Security(II)") — stored in segmentQuizScores as topic */
  moduleTopic?: string;
  unlockedSegmentIndex: number;
  /** Highest segment index whose end the user has reached by watching (time-based unlock). */
  reachedSegmentEndIndex: number;
  segmentAttempts: Record<number, number>;
  segmentMastery: Record<number, MasteryLevel>;
  quizScores: Record<number, number>;
  /** How many times the user opened/used flashcards for each segment (segmentIndex -> count). */
  segmentFlashcardOpens?: Record<number, number>;
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
  /** Optional: used by AI to generate quiz questions and flashcards per segment */
  moduleTopic?: string;
  segmentTitles?: string[];
  /** Slide/document text per segment. AI reads this to generate questions. One string per segment. */
  segmentSlides?: string[];
  quizzes: SegmentQuiz[];
};
