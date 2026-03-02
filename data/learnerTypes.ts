/**
 * The 9 types of learners (from F01 Funders and Founders / learner type frameworks).
 * Used in Learner DNA to show "what type of user the user is."
 */
export const LEARNER_TYPES = [
  { id: 'visual', label: 'Visual learner', description: 'learn what they see', icon: '👓' },
  { id: 'kinesthetic', label: 'Kinesthetic learner', description: 'learn what they do', icon: '✋' },
  { id: 'auditory', label: 'Auditory learner', description: 'learn what they hear', icon: '🎧' },
  { id: 'stress', label: 'Stress learner', description: 'learn what stresses them', icon: '😤' },
  { id: 'ease', label: 'Ease learner', description: 'learn what relaxes them', icon: '😌' },
  { id: 'scribble', label: 'Scribble learner', description: 'learn what they write out', icon: '✏️' },
  { id: 'trust', label: 'Trust learner', description: 'learn from authority', icon: '🎤' },
  { id: 'teach', label: 'Teach learner', description: 'learn by teaching', icon: '👨‍🏫' },
  { id: 'copy', label: 'Copy learner', description: 'learn what they can copy', icon: '🗿' },
] as const;

export const LEARNER_TYPE_IDS = LEARNER_TYPES.map((t) => t.id);
export type LearnerTypeId = (typeof LEARNER_TYPES)[number]['id'];

export function getLearnerType(id: string): { id: string; label: string; description: string; icon: string } | undefined {
  return LEARNER_TYPES.find((t) => t.id === id);
}
