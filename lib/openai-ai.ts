/**
 * OpenAI-backed AI helpers (quiz, summary, flashcards, etc.).
 * Uses OPENAI_API_KEY (and optional OPENAI_API_KEY_2 for rotation).
 */

import OpenAI from 'openai';
import { logger } from './logger';

const log = logger.child('OpenAI');

function getKeys(): string[] {
  const keys = [
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_API_KEY_2,
  ].filter((k): k is string => Boolean(k));
  return Array.from(new Set(keys));
}

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

async function callOpenAI(prompt: string, options?: { maxTokens?: number; systemPrompt?: string }): Promise<string> {
  const keys = getKeys();
  if (keys.length === 0) {
    throw new Error(
      'OpenAI is not configured: set OPENAI_API_KEY in .env.local (and in Cloud Run for production).'
    );
  }
  const maxTokens = options?.maxTokens ?? 1500;
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (options?.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  for (let attempt = 0; attempt < keys.length * 2; attempt++) {
    const apiKey = keys[attempt % keys.length];
    try {
      const openai = new OpenAI({ apiKey });
      log.debug('Calling OpenAI', { attempt: attempt + 1, model: DEFAULT_MODEL, maxTokens });
      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      });
      const text = completion.choices[0]?.message?.content?.trim() ?? '';
      if (text) return text;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('rate limit') || (err as { status?: number })?.status === 429) {
        log.info('Rate limited, retrying with next key', { attempt: attempt + 1 });
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }
      log.warn('OpenAI API error', { error: msg });
      throw err;
    }
  }
  throw new Error('OpenAI rate limited or unavailable');
}

// ─── AI helper exports ───────────────────────────────────────────────────

export async function generateFlashcards(topic: string, weakAreas: string[]) {
  const prompt = `Generate 5 flashcards for a university student studying ${topic}. Focus on: ${weakAreas.join(', ')}. Return ONLY valid JSON array: [{"front":"question","back":"answer","difficulty":"easy|medium|hard"}]`;
  const response = await callOpenAI(prompt);
  return JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
}

export async function generateSummary(topic: string, segmentTitle: string, segmentContent: string) {
  const prompt = `A student is confused about "${segmentTitle}" in ${topic}. Content: ${segmentContent}. Explain this concept simply in 3-4 sentences like you're talking to a friend. Use analogies. Be encouraging.`;
  return callOpenAI(prompt);
}

export interface QuizMistake {
  question: string;
  chosenOption: string;
  correctOption: string;
}

export interface SegmentTakeaways {
  bullets: string[];
  oneThing: string;
  /** Short "mistakes to note" points when the student got some quiz questions wrong. */
  mistakesToNote?: string[];
}

/** 2–3 bullet points + one thing to remember after completing a segment (for "What you learned" modal). Optional mistakes → add "take note" points. */
export async function generateSegmentTakeaways(
  topic: string,
  segmentIndex: number,
  segmentSlidesSnippet?: string,
  mistakes?: QuizMistake[]
): Promise<SegmentTakeaways> {
  const context = segmentSlidesSnippet
    ? `Relevant content:\n${segmentSlidesSnippet.slice(0, 2500)}`
    : `Topic: ${topic}, Segment ${segmentIndex + 1}.`;
  const mistakesBlock =
    mistakes && mistakes.length > 0
      ? `\nThe student got these questions wrong — include a "mistakes to note" section so they remember what to fix:\n${mistakes.map((m) => `- Q: ${m.question} | They chose: ${m.chosenOption} | Correct: ${m.correctOption}`).join('\n')}`
      : '';

  const prompt = `A student just completed segment ${segmentIndex + 1} of a course on "${topic}". ${context}.${mistakesBlock}

Give a short "What you learned" recap. Return ONLY valid JSON with exactly this shape (no markdown, no extra text):
{"bullets":["bullet 1","bullet 2","bullet 3"],"oneThing":"One key takeaway to remember.","mistakesToNote":["point 1","point 2"]}
- bullets: 2 or 3 short bullet points (one line each) summarizing what was covered.
- oneThing: One sentence that captures the single most important thing to remember from this segment.
${mistakes && mistakes.length > 0 ? '- mistakesToNote: 2 or 3 short points (one line each) about what they got wrong and what to remember. E.g. "You mixed up X with Y — the correct idea is Z."' : '- mistakesToNote: omit or empty array if no mistakes were provided.'}`;

  const response = await callOpenAI(prompt, { maxTokens: 550 });
  const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as { bullets?: string[]; oneThing?: string; mistakesToNote?: string[] };
  const bullets = Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 3) : [];
  const oneThing = typeof parsed.oneThing === 'string' ? parsed.oneThing : 'Keep reviewing to lock it in.';
  const mistakesToNote = Array.isArray(parsed.mistakesToNote) ? parsed.mistakesToNote.slice(0, 4) : undefined;
  return { bullets, oneThing, mistakesToNote };
}

export async function generatePracticeQuestions(
  moduleName: string,
  weakTopics: string[],
  format: string,
  count: number
) {
  const prompt = `Generate ${count} ${format} practice questions for ${moduleName}. Focus on weak topics: ${weakTopics.join(', ')}. Return ONLY valid JSON array: [{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","topic":"...","difficulty":"easy|medium|hard"}]`;
  const response = await callOpenAI(prompt);
  return JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
}

export async function generatePracticePaper(
  moduleName: string,
  weakTopics: string[],
  preferredFormat: string,
  questionCount: number
) {
  return generatePracticeQuestions(moduleName, weakTopics, preferredFormat, questionCount);
}

export async function detectBurnout(studyData: unknown) {
  const prompt = `Analyze student burnout risk. Data: ${JSON.stringify(studyData)}. Return ONLY JSON: {"riskLevel":"low|moderate|high","riskScore":0-100,"signals":["..."],"recommendation":"..."}`;
  const response = await callOpenAI(prompt);
  return JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
}

export type PersonaProfile = {
  learningStyle?: string;
  studyHoursPerDay?: number;
  studyDaysPerWeek?: number;
  examPrepWeek?: number;
  preferredQuestionFormat?: string;
  cognitiveScore?: number;
  readinessScore?: number;
  rawAnswers?: Record<string, unknown>;
};

export async function generatePersonaFromProfile(profile: PersonaProfile): Promise<{
  personalityTraits: string[];
  learnerTypes: string[];
}> {
  const prompt = `You are a learning profile analyst. Based on this student profile, generate personality traits and learner types.

PROFILE:
${JSON.stringify(profile, null, 2)}

Return ONLY valid JSON with exactly this shape, no other text:
{"personalityTraits":["trait1","trait2",...],"learnerTypes":["type1","type2",...]}

Rules:
- personalityTraits: 3-6 short labels (e.g. "visual learner", "night owl", "goal-oriented")
- learnerTypes: 1-3 broader types (e.g. "deep learner", "strategic", "surface")`;

  const response = await callOpenAI(prompt);
  const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as { personalityTraits?: unknown; learnerTypes?: unknown };
  return {
    personalityTraits: Array.isArray(parsed.personalityTraits)
      ? parsed.personalityTraits.filter((t): t is string => typeof t === 'string')
      : [],
    learnerTypes: Array.isArray(parsed.learnerTypes)
      ? parsed.learnerTypes.filter((t): t is string => typeof t === 'string')
      : [],
  };
}

export async function generateSegmentQuizQuestions(segmentIndex: number, slides: string) {
  const prompt = `You are a university quiz generator. Based on the following lecture slides for Segment ${segmentIndex + 1}, generate 5 multiple-choice questions that test understanding of the key concepts.

LECTURE SLIDES:
${slides}

Return ONLY a valid JSON array with exactly this format, no other text:
[
  {
    "id": "s${segmentIndex}-q1",
    "question": "The question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0
  }
]

Rules:
- Generate exactly 5 questions
- Each question must have exactly 4 options
- correctIndex is 0-3 indicating the correct option
- Questions must reference specific concepts from the slides
- Mix difficulty: 2 easy, 2 medium, 1 hard
- IDs must follow pattern s${segmentIndex}-q1 through s${segmentIndex}-q5`;

  const response = await callOpenAI(prompt, { maxTokens: 2500 });
  const parsed = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Invalid quiz response from OpenAI');
  }

  return parsed.map((q: { id?: string; question?: string; options?: string[]; correctIndex?: number }, i: number) => ({
    id: q.id ?? `s${segmentIndex}-q${i + 1}`,
    question: q.question ?? '',
    options: Array.isArray(q.options) ? q.options.slice(0, 4) : ['A', 'B', 'C', 'D'],
    correctIndex:
      typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < 4 ? q.correctIndex : 0,
  }));
}

const MAX_SLIDES_CHARS = 4000;

export async function generateSegmentFlashcards(
  segmentIndex: number,
  segmentSlides: string,
  count = 6,
  feedback?: string
): Promise<Array<{ front: string; back: string }>> {
  const truncated =
    segmentSlides.length > MAX_SLIDES_CHARS
      ? segmentSlides.slice(0, MAX_SLIDES_CHARS) + '\n\n[... content truncated ...]'
      : segmentSlides;
  log.info('Generating segment flashcards from slides', { segmentIndex, count });
  const prompt = `You are generating study flashcards. Read the segment slides below and create flashcards based ONLY on that content.
Rules:
- Use ONLY information from the segment slides. Each flashcard: "front" (question or key term), "back" (short answer from the slides).
- Return ONLY a valid JSON array. No markdown, no prose before or after.
${feedback ? `\nNote: Previous attempt was rejected because: ${feedback}. Improve accordingly.\n` : ''}

--- SEGMENT SLIDES ---
${truncated}
--- END SLIDES ---

Generate ${count} flashcards. Return only the JSON array.`;

  const response = await callOpenAI(prompt);
  const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array found in OpenAI response');
  const parsed = JSON.parse(match[0]) as unknown[];
  if (!Array.isArray(parsed)) throw new Error('OpenAI did not return an array');

  return parsed.slice(0, count).map((c: unknown) => {
    const o =
      c && typeof c === 'object' && 'front' in c && 'back' in c ? (c as { front?: unknown; back?: unknown }) : {};
    return {
      front: typeof o.front === 'string' ? o.front : '',
      back: typeof o.back === 'string' ? o.back : '',
    };
  });
}

/** Generate flashcards for a segment when slide content is not available; uses topic only (AI-generated). */
export async function generateFlashcardsForSegmentByTopic(
  segmentIndex: number,
  topic: string,
  count = 6,
  feedback?: string
): Promise<Array<{ front: string; back: string }>> {
  log.info('Generating segment flashcards from topic (no slides)', { segmentIndex, topic, count });
  const prompt = `You are generating study flashcards for a university student. This is for segment ${segmentIndex + 1} of a course. The course/module topic is: ${topic}.
${feedback ? `\nNote: Previous attempt was rejected because: ${feedback}. Improve accordingly.\n` : ''}

Generate ${count} review flashcards that would help a student prepare for a quiz on this topic. Each flashcard should have "front" (question or key term) and "back" (concise answer). Base content on typical university-level material for this subject.

Return ONLY a valid JSON array. No markdown, no prose. Example format: [{"front":"...","back":"..."}]`;

  const response = await callOpenAI(prompt);
  const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array found in OpenAI response');
  const parsed = JSON.parse(match[0]) as unknown[];
  if (!Array.isArray(parsed)) throw new Error('OpenAI did not return an array');

  return parsed.slice(0, count).map((c: unknown) => {
    const o =
      c && typeof c === 'object' && 'front' in c && 'back' in c ? (c as { front?: unknown; back?: unknown }) : {};
    return {
      front: typeof o.front === 'string' ? o.front : '',
      back: typeof o.back === 'string' ? o.back : '',
    };
  });
}

/** Low-level: single prompt → text. Use from API routes that need a custom prompt. */
export async function complete(
  prompt: string,
  options?: { systemPrompt?: string; maxTokens?: number }
): Promise<string> {
  return callOpenAI(prompt, {
    maxTokens: options?.maxTokens ?? 1500,
    systemPrompt: options?.systemPrompt,
  });
}
