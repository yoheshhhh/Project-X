/**
 * Firebase Configuration & Helpers
 * ================================
 * Handles authentication, Firestore database, and storage.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a new project called "ntulearn"
 * 3. Enable Authentication (Email/Password for demo)
 * 4. Enable Firestore Database
 * 5. Copy your config values to .env.local
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';

import { logger } from './logger';

// ---- Initialize Firebase ----
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export { onAuthStateChanged };
export const db = getFirestore(app);

// ---- Auth Helpers ----

/**
 * Simulated SSO Login
 * In production, this would integrate with NTU's SSO (Shibboleth/SAML).
 * For the hackathon demo, we simulate it with email/password + role selection.
 */
export async function loginUser(email: string, password: string) {
  logger.info('Attempting user login', { email });
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    logger.info('Login successful', { uid: userCredential.user.uid });
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    logger.error('Login failed', { email, error: error.message });
    return { success: false, error: error.message };
  }
}

export async function registerUser(email: string, password: string, role: string, displayName: string) {
  logger.info('Registering new user', { email, role });
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Create user profile in Firestore
    await setDoc(doc(db, 'users', uid), {
      email,
      displayName,
      role, // 'student' | 'professor' | 'admin'
      createdAt: serverTimestamp(),
      hasCompletedQuiz: false,
      persona: null,
      learnerTypes: [], // e.g. ['ease','scribble'] for progress tracking & personalization
      streakDays: 0,
      lastStudyDate: null,
    });

    logger.info('User registered successfully', { uid, role });
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    logger.error('Registration failed', { email, error: error.message });
    return { success: false, error: error.message };
  }
}

export async function logoutUser() {
  logger.info('User logging out');
  await signOut(auth);
  if (typeof document !== 'undefined') {
    window.sessionStorage.removeItem('ntulearn_signed_in');
    document.cookie = 'ntulearn_logged_in=; Path=/; SameSite=Lax; Max-Age=0';
  }
}

// ---- User Profile Helpers ----

export async function getUserProfile(uid: string) {
  logger.debug('Fetching user profile', { uid });
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

export async function updateUserProfile(uid: string, data: Record<string, any>) {
  logger.debug('Updating user profile', { uid, fields: Object.keys(data) });
  const docRef = doc(db, 'users', uid);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
}

/**
 * Save the Learner DNA persona (and learner types) after quiz completion.
 * Also sets root-level learnerTypes for progress tracking and queries.
 */
export async function savePersona(uid: string, persona: LearnerPersona) {
  logger.info('Saving learner persona', { uid, learningStyle: persona.learningStyle, learnerTypes: persona.learnerTypes });
  await updateUserProfile(uid, {
    persona,
    learnerTypes: persona.learnerTypes ?? [],
    hasCompletedQuiz: true,
  });
}

/**
 * Ensure a user document exists (e.g. on login). Creates one with defaults if missing.
 * Use for progress tracking so we always have learnerTypes and profile.
 */
export async function ensureUserDoc(uid: string, email: string, displayName?: string | null) {
  const docRef = doc(db, 'users', uid);
  const snap = await getDoc(docRef);
  if (snap.exists()) return snap.data();
  await setDoc(docRef, {
    email,
    displayName: displayName ?? email?.split('@')[0] ?? '',
    role: 'student',
    createdAt: serverTimestamp(),
    hasCompletedQuiz: false,
    persona: null,
    learnerTypes: [],
    streakDays: 0,
    lastStudyDate: null,
  });
  logger.info('Created user doc on login', { uid });
  return (await getDoc(docRef)).data();
}

// ---- Quiz & Progress Helpers ----

export async function saveQuizResult(uid: string, moduleId: string, segmentId: string, result: QuizResult) {
  logger.info('Saving quiz result', { uid, moduleId, segmentId, score: result.score });
  const docRef = doc(db, 'quizResults', `${uid}_${moduleId}_${segmentId}`);
  await setDoc(docRef, {
    uid,
    moduleId,
    segmentId,
    ...result,
    timestamp: serverTimestamp(),
  });
}

/** Full module progress (unlock, segment reached, attempts, mastery, quiz scores). Used for progress tracking with learner type. */
export async function getStoredModuleProgress(uid: string, moduleId: string): Promise<Record<string, unknown> | null> {
  const docRef = doc(db, 'moduleProgress', `${uid}_${moduleId}`);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const d = snap.data();
  return d as Record<string, unknown>;
}

export async function setStoredModuleProgress(uid: string, moduleId: string, progress: Record<string, unknown>) {
  const docRef = doc(db, 'moduleProgress', `${uid}_${moduleId}`);
  await setDoc(docRef, { ...progress, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Save a segment quiz score to Firestore (content engine segment quizzes).
 * Separate collection from users; used for progress tracking and dashboards.
 * Doc id: {uid}_{moduleId}_{segmentIndex} — one doc per user per module per segment (last score + attempt count).
 */
export async function saveSegmentQuizScore(
  uid: string,
  moduleId: string,
  segmentIndex: number,
  score: number,
  attemptNumber: number,
  topic?: string
) {
  const docId = `${uid}_${moduleId}_${segmentIndex}`;
  const docRef = doc(db, 'segmentQuizScores', docId);
  const data: Record<string, unknown> = {
    uid,
    moduleId,
    segmentIndex,
    score,
    attemptNumber,
    updatedAt: serverTimestamp(),
  };
  if (topic) data.topic = topic;
  await setDoc(docRef, data, { merge: true });
}

export async function getModuleProgress(uid: string, moduleId: string) {
  logger.debug('Fetching module progress', { uid, moduleId });
  const q = query(
    collection(db, 'quizResults'),
    where('uid', '==', uid),
    where('moduleId', '==', moduleId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data());
}

export async function getAllProgress(uid: string) {
  logger.debug('Fetching all progress', { uid });
  const q = query(collection(db, 'quizResults'), where('uid', '==', uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data());
}

// ---- Bulk Query Helpers (for insights/dashboard) ----

export async function getAllModuleProgress(uid: string) {
  const q = query(collection(db, 'moduleProgress'), where('userId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAllSegmentQuizScores(uid: string) {
  const q = query(collection(db, 'segmentQuizScores'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getStudySessions(uid: string) {
  const q = query(collection(db, 'studySessions'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---- Study Session Tracking ----

export async function logStudySession(uid: string, moduleId: string, durationMinutes: number) {
  logger.info('Logging study session', { uid, moduleId, durationMinutes });
  const sessionRef = doc(collection(db, 'studySessions'));
  await setDoc(sessionRef, {
    uid,
    moduleId,
    durationMinutes,
    timestamp: serverTimestamp(),
  });
}

// ---- Study Goals ----

export async function saveStudyGoal(uid: string, goal: {
  goalType: 'score' | 'hours' | 'streak' | 'topic-mastery';
  targetValue: number;
  targetDate?: string;
  topic?: string;
  description: string;
}) {
  const goalRef = doc(collection(db, 'goals'));
  await setDoc(goalRef, {
    uid,
    ...goal,
    progress: 0,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return goalRef.id;
}

export async function getStudyGoals(uid: string) {
  // Simple query without orderBy to avoid needing a composite index
  const q = query(collection(db, 'goals'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateStudyGoal(uid: string, goalId: string, data: Record<string, any>) {
  const docRef = doc(db, 'goals', goalId);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteStudyGoal(goalId: string) {
  const { deleteDoc } = await import('firebase/firestore');
  const docRef = doc(db, 'goals', goalId);
  await deleteDoc(docRef);
}

// ---- Study Profile (for collaborative matching) ----

export async function saveStudyProfile(uid: string, profile: {
  displayName: string;
  weakTopics: string[];
  strongTopics: string[];
  studyStyle: string;
  lookingForHelp: string[];
  canHelpWith: string[];
  optIn: boolean;
}) {
  const docRef = doc(db, 'studyProfiles', uid);
  await setDoc(docRef, {
    uid,
    ...profile,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getStudyProfile(uid: string) {
  const docRef = doc(db, 'studyProfiles', uid);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function findStudyMatches(uid: string, weakTopics: string[]) {
  // Find users who are strong in topics this user is weak in
  const q = query(
    collection(db, 'studyProfiles'),
    where('optIn', '==', true),
  );
  const snap = await getDocs(q);
  const matches = snap.docs
    .map(d => ({ id: d.id, ...d.data() }) as any)
    .filter((p: any) => p.uid !== uid)
    .map((p: any) => {
      // Compute match score: how many of your weak topics are their strong topics
      const helpScore = weakTopics.filter(t => (p.strongTopics || []).includes(t)).length;
      const complementScore = (p.weakTopics || []).filter((t: string) => weakTopics.includes(t)).length;
      return { ...p, matchScore: helpScore * 2 - complementScore, canHelpWith: weakTopics.filter(t => (p.strongTopics || []).includes(t)) };
    })
    .filter((p: any) => p.matchScore > 0)
    .sort((a: any, b: any) => b.matchScore - a.matchScore);

  return matches;
}

// ---- Adaptive Quiz Difficulty ----

export async function getAdaptiveDifficulty(uid: string, moduleId: string) {
  const docRef = doc(db, 'adaptiveDifficulty', `${uid}_${moduleId}`);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : null;
}

export async function saveAdaptiveDifficulty(uid: string, moduleId: string, data: {
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  consecutiveHighScores: number;
  consecutiveLowScores: number;
  lastScore: number;
  adjustmentHistory: { from: string; to: string; reason: string; timestamp: number }[];
}) {
  const docRef = doc(db, 'adaptiveDifficulty', `${uid}_${moduleId}`);
  await setDoc(docRef, {
    uid,
    moduleId,
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ---- Types ----

export interface LearnerPersona {
  learningStyle: 'short-term-intensive' | 'long-term-gradual';
  studyHoursPerDay: number;
  studyDaysPerWeek: number;
  examPrepWeek: number;
  preferredQuestionFormat: 'mcq' | 'short-answer' | 'essay';
  cognitiveScore: number; // 0-100 reasoning score
  readinessScore?: number; // 0-100 learning readiness
  personalityTraits: string[];
  learnerTypes: string[]; // e.g. ['ease', 'scribble']
}

export interface QuizResult {
  score: number;       // 0-100
  totalQuestions: number;
  correctAnswers: number;
  timeSpentSeconds: number;
  attemptNumber: number;
  missedQuestionIds: string[];
}
