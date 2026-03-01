import type { ModuleProgress, MasteryLevel } from '../types/learning';

const STORAGE_KEY = 'lams_progress';

function getScoreMastery(score: number): MasteryLevel {
  if (score >= 80) return 'Mastered';
  if (score >= 50) return 'Partial';
  return 'Weak';
}

export type ProgressService = {
  getProgress(userId: string, moduleId: string): Promise<ModuleProgress | null>;
  setProgress(progress: ModuleProgress): Promise<void>;
  recordQuizResult(userId: string, moduleId: string, segmentIndex: number, score: number): Promise<void>;
  recordQuizAttempt(userId: string, moduleId: string, segmentIndex: number): Promise<void>;
  /** Mark that the user has watched to the end of this segment (time-based unlock). */
  recordSegmentReached(userId: string, moduleId: string, segmentIndex: number): Promise<void>;
};

function loadAll(): Record<string, ModuleProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, ModuleProgress>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export const progressService: ProgressService = {
  async getProgress(userId: string, moduleId: string) {
    const key = `${userId}_${moduleId}`;
    return loadAll()[key] ?? null;
  },
  async setProgress(progress: ModuleProgress) {
    const key = `${progress.userId}_${progress.moduleId}`;
    const all = loadAll();
    all[key] = progress;
    saveAll(all);
  },
  async recordQuizResult(userId: string, moduleId: string, segmentIndex: number, score: number) {
    const key = `${userId}_${moduleId}`;
    const all = loadAll();
    const current = all[key] ?? { userId, moduleId, unlockedSegmentIndex: 0, reachedSegmentEndIndex: -1, segmentAttempts: {}, segmentMastery: {}, quizScores: {} };
    if (current.reachedSegmentEndIndex === undefined) {
      const scores = current.quizScores ?? {};
      const maxScored = Object.keys(scores).length ? Math.max(...Object.keys(scores).map(Number), segmentIndex) : segmentIndex;
      current.reachedSegmentEndIndex = maxScored;
    }
    current.segmentAttempts[segmentIndex] = (current.segmentAttempts[segmentIndex] ?? 0) + 1;
    current.quizScores[segmentIndex] = score;
    current.segmentMastery[segmentIndex] = getScoreMastery(score);
    if (score >= 70) current.unlockedSegmentIndex = Math.max(current.unlockedSegmentIndex, segmentIndex + 1);
    all[key] = current;
    saveAll(all);
  },
  async recordQuizAttempt(userId: string, moduleId: string, segmentIndex: number) {
    const key = `${userId}_${moduleId}`;
    const all = loadAll();
    const current = all[key] ?? { userId, moduleId, unlockedSegmentIndex: 0, reachedSegmentEndIndex: -1, segmentAttempts: {}, segmentMastery: {}, quizScores: {} };
    if (current.reachedSegmentEndIndex === undefined) {
      const scores = current.quizScores ?? {};
      const maxScored = Object.keys(scores).length ? Math.max(...Object.keys(scores).map(Number), segmentIndex) : segmentIndex;
      current.reachedSegmentEndIndex = maxScored;
    }
    current.segmentAttempts[segmentIndex] = (current.segmentAttempts[segmentIndex] ?? 0) + 1;
    all[key] = current;
    saveAll(all);
  },
  async recordSegmentReached(userId: string, moduleId: string, segmentIndex: number) {
    const key = `${userId}_${moduleId}`;
    const all = loadAll();
    const current = all[key] ?? { userId, moduleId, unlockedSegmentIndex: 0, reachedSegmentEndIndex: -1, segmentAttempts: {}, segmentMastery: {}, quizScores: {} };
    if (current.reachedSegmentEndIndex === undefined) current.reachedSegmentEndIndex = -1;
    current.reachedSegmentEndIndex = Math.max(current.reachedSegmentEndIndex, segmentIndex);
    all[key] = current;
    saveAll(all);
  },
};
