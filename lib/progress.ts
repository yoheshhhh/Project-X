import type { ModuleProgress, MasteryLevel } from '../types/learning';
import { auth, getStoredModuleProgress, setStoredModuleProgress, saveSegmentQuizScore } from './firebase';

const STORAGE_KEY = 'lams_progress';

function getScoreMastery(score: number): MasteryLevel {
  if (score >= 80) return 'Mastered';
  if (score >= 50) return 'Partial';
  return 'Weak';
}

/** True when we should persist progress to Firestore (logged-in user). Progress is then tied to user's learner type. */
function useFirestore(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  return !!(auth.currentUser && auth.currentUser.uid === userId);
}

function toModuleProgress(raw: Record<string, unknown> | null): ModuleProgress | null {
  if (!raw || typeof raw.userId !== 'string' || typeof raw.moduleId !== 'string') return null;
  return {
    userId: raw.userId,
    moduleId: raw.moduleId,
    moduleName: typeof raw.moduleName === 'string' ? raw.moduleName : undefined,
    moduleTopic: typeof raw.moduleTopic === 'string' ? raw.moduleTopic : undefined,
    unlockedSegmentIndex: typeof raw.unlockedSegmentIndex === 'number' ? raw.unlockedSegmentIndex : 0,
    reachedSegmentEndIndex: typeof raw.reachedSegmentEndIndex === 'number' ? raw.reachedSegmentEndIndex : -1,
    segmentAttempts: (raw.segmentAttempts as Record<number, number>) ?? {},
    segmentMastery: (raw.segmentMastery as Record<number, MasteryLevel>) ?? {},
    quizScores: (raw.quizScores as Record<number, number>) ?? {},
    segmentFlashcardOpens: (raw.segmentFlashcardOpens as Record<number, number>) ?? undefined,
    lastWatchedTimestamp: typeof raw.lastWatchedTimestamp === 'number' ? raw.lastWatchedTimestamp : undefined,
  };
}

export type ProgressService = {
  getProgress(userId: string, moduleId: string): Promise<ModuleProgress | null>;
  setProgress(progress: ModuleProgress): Promise<void>;
  recordQuizResult(userId: string, moduleId: string, segmentIndex: number, score: number): Promise<void>;
  recordQuizAttempt(userId: string, moduleId: string, segmentIndex: number): Promise<void>;
  /** Mark that the user has watched to the end of this segment (time-based unlock). */
  recordSegmentReached(userId: string, moduleId: string, segmentIndex: number): Promise<void>;
  /** Record that the user opened/used flashcards for this segment (increments per-segment count). */
  recordFlashcardUsed(userId: string, moduleId: string, segmentIndex: number): Promise<void>;
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
    if (useFirestore(userId)) {
      try {
        const raw = await getStoredModuleProgress(userId, moduleId);
        return toModuleProgress(raw);
      } catch {
        return loadAll()[`${userId}_${moduleId}`] ?? null;
      }
    }
    return loadAll()[`${userId}_${moduleId}`] ?? null;
  },
  async setProgress(progress: ModuleProgress) {
    const key = `${progress.userId}_${progress.moduleId}`;
    if (useFirestore(progress.userId)) {
      try {
        await setStoredModuleProgress(progress.userId, progress.moduleId, progress);
      } catch (_) {}
    }
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
    if (useFirestore(userId)) {
      try {
        await setStoredModuleProgress(userId, moduleId, current);
        await saveSegmentQuizScore(userId, moduleId, segmentIndex, score, current.segmentAttempts[segmentIndex], current.moduleTopic);
      } catch (_) {}
    }
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
    if (useFirestore(userId)) {
      try {
        await setStoredModuleProgress(userId, moduleId, current);
      } catch (_) {}
    }
  },
  async recordSegmentReached(userId: string, moduleId: string, segmentIndex: number) {
    const key = `${userId}_${moduleId}`;
    const all = loadAll();
    const current = all[key] ?? { userId, moduleId, unlockedSegmentIndex: 0, reachedSegmentEndIndex: -1, segmentAttempts: {}, segmentMastery: {}, quizScores: {} };
    if (current.reachedSegmentEndIndex === undefined) current.reachedSegmentEndIndex = -1;
    current.reachedSegmentEndIndex = Math.max(current.reachedSegmentEndIndex, segmentIndex);
    all[key] = current;
    saveAll(all);
    if (useFirestore(userId)) {
      try {
        await setStoredModuleProgress(userId, moduleId, current);
      } catch (_) {}
    }
  },
  async recordFlashcardUsed(userId: string, moduleId: string, segmentIndex: number) {
    const key = `${userId}_${moduleId}`;
    const all = loadAll();
    const current = all[key] ?? { userId, moduleId, unlockedSegmentIndex: 0, reachedSegmentEndIndex: -1, segmentAttempts: {}, segmentMastery: {}, quizScores: {} };
    const opens = current.segmentFlashcardOpens ?? {};
    opens[segmentIndex] = (opens[segmentIndex] ?? 0) + 1;
    current.segmentFlashcardOpens = opens;
    all[key] = current;
    saveAll(all);
    if (useFirestore(userId)) {
      try {
        await setStoredModuleProgress(userId, moduleId, current);
      } catch (_) {}
    }
  },
};
