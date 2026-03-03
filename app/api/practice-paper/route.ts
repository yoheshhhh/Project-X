import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Practice Paper Generator API
// POST /api/practice-paper
// Generates full mock exam papers (MCQ + short answer) using Gemini AI
// ─────────────────────────────────────────────────────────────────────────────

const log = logger.child('API:PracticePaper');

/* ── Types ────────────────────────────────────────────────────────────────── */

interface MCQQuestion {
  id: string;
  type: 'mcq';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  marks: number;
}

interface ShortAnswerQuestion {
  id: string;
  type: 'short-answer';
  question: string;
  modelAnswer: string;
  keywords: string[];
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  marks: number;
}

type PaperQuestion = MCQQuestion | ShortAnswerQuestion;

interface PracticePaper {
  title: string;
  course: string;
  module: string;
  duration: number;       // minutes
  totalMarks: number;
  sections: PaperSection[];
  generatedAt: string;
  meta: { model: string; questionsGenerated: number; topicsCovered: string[] };
}

interface PaperSection {
  name: string;
  instructions: string;
  questions: PaperQuestion[];
  totalMarks: number;
}

interface GenerateRequest {
  module: string;
  topics: string[];
  segmentSlides?: string;
  pastPaperContext?: string;
  difficulty?: 'mixed' | 'easy' | 'medium' | 'hard';
  mcqCount?: number;
  shortAnswerCount?: number;
}

/* ── Gemini Client (OOP) ─────────────────────────────────────────────────── */

class GeminiClient {
  private keys: string[];
  private model = 'gemini-2.0-flash';

  constructor() {
    this.keys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
    ].filter(Boolean) as string[];

    if (this.keys.length === 0) {
      log.error('No Gemini API keys configured');
      throw new Error('GEMINI_API_KEY not configured');
    }
    log.debug('GeminiClient initialized', { keyCount: this.keys.length });
  }

  async generate(prompt: string, maxTokens = 4096): Promise<string | null> {
    for (let attempt = 0; attempt < this.keys.length * 2; attempt++) {
      const apiKey = this.keys[attempt % this.keys.length];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${apiKey}`;

      try {
        log.debug('Gemini request attempt', { attempt: attempt + 1, model: this.model });

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 },
          }),
        });

        if (res.status === 429) {
          log.warn('Gemini rate limited, retrying', { attempt: attempt + 1 });
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        if (!res.ok) {
          log.warn('Gemini non-OK response', { status: res.status, attempt: attempt + 1 });
          continue;
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        log.debug('Gemini response received', { length: text.length });
        return text;
      } catch (err: any) {
        log.warn('Gemini request failed', { error: err.message, attempt: attempt + 1 });
        continue;
      }
    }
    log.error('All Gemini attempts exhausted');
    return null;
  }
}

/* ── Paper Generator (OOP) ───────────────────────────────────────────────── */

class PaperGenerator {
  private gemini: GeminiClient;

  constructor() {
    this.gemini = new GeminiClient();
  }

  async generatePaper(req: GenerateRequest): Promise<PracticePaper> {
    const mcqCount = req.mcqCount ?? 10;
    const shortAnswerCount = req.shortAnswerCount ?? 3;
    const difficulty = req.difficulty ?? 'mixed';
    const startTime = Date.now();

    log.info('Generating practice paper', {
      module: req.module,
      topics: req.topics,
      mcqCount,
      shortAnswerCount,
      difficulty,
    });

    // Generate MCQs and short answers in parallel
    const [mcqs, shortAnswers] = await Promise.all([
      this.generateMCQs(req, mcqCount, difficulty),
      this.generateShortAnswers(req, shortAnswerCount, difficulty),
    ]);

    const mcqMarks = mcqs.reduce((sum, q) => sum + q.marks, 0);
    const saMarks = shortAnswers.reduce((sum, q) => sum + q.marks, 0);

    const paper: PracticePaper = {
      title: `Practice Paper — ${req.module}`,
      course: 'SC3010 Computer Security',
      module: req.module,
      duration: mcqCount * 2 + shortAnswerCount * 8, // rough estimate
      totalMarks: mcqMarks + saMarks,
      sections: [
        {
          name: 'Section A: Multiple Choice Questions',
          instructions: `Answer ALL ${mcqCount} questions. Each question carries ${mcqs[0]?.marks ?? 2} mark(s). Select the BEST answer.`,
          questions: mcqs,
          totalMarks: mcqMarks,
        },
        {
          name: 'Section B: Short Answer Questions',
          instructions: `Answer ALL ${shortAnswerCount} questions. Write concise answers (2-5 sentences). Show your understanding of the concept.`,
          questions: shortAnswers,
          totalMarks: saMarks,
        },
      ],
      generatedAt: new Date().toISOString(),
      meta: {
        model: 'gemini-2.0-flash',
        questionsGenerated: mcqs.length + shortAnswers.length,
        topicsCovered: [...new Set([...mcqs.map(q => q.topic), ...shortAnswers.map(q => q.topic)])],
      },
    };

    log.info('Practice paper generated', {
      totalQuestions: paper.meta.questionsGenerated,
      totalMarks: paper.totalMarks,
      durationMs: Date.now() - startTime,
    });

    return paper;
  }

  private buildContextBlock(req: GenerateRequest): string {
    let context = `MODULE: ${req.module}\nTOPICS: ${req.topics.join(', ')}`;
    if (req.segmentSlides) {
      context += `\n\nCOURSE MATERIAL (slides):\n${req.segmentSlides.slice(0, 6000)}`;
    }
    if (req.pastPaperContext) {
      context += `\n\nPAST YEAR PAPER REFERENCE (match this style and difficulty):\n${req.pastPaperContext.slice(0, 4000)}`;
    }
    return context;
  }

  private async generateMCQs(req: GenerateRequest, count: number, difficulty: string): Promise<MCQQuestion[]> {
    const context = this.buildContextBlock(req);
    const difficultyInstruction = difficulty === 'mixed'
      ? 'Mix easy (30%), medium (50%), and hard (20%) questions.'
      : `All questions should be ${difficulty} difficulty.`;

    const prompt = `You are an NTU Singapore exam paper setter for Computer Security (SC3010), taught by CCDS LI YI.

${context}

Generate exactly ${count} multiple-choice questions for a practice exam.
${difficultyInstruction}

Requirements:
- Questions must test understanding, NOT just recall — include scenario-based and application questions
- Each question must have exactly 4 options labeled A, B, C, D
- Only ONE correct answer per question
- Distractors should be plausible but clearly wrong to someone who understands the concept
- Cover all listed topics roughly evenly
- Match university exam level (not too easy, not PhD-level)

Respond ONLY with valid JSON array (no markdown, no backticks, no preamble):
[
  {
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correctIndex": 0,
    "explanation": "Brief explanation why the answer is correct",
    "topic": "Topic name",
    "difficulty": "easy|medium|hard"
  }
]`;

    log.debug('Generating MCQs', { count, difficulty });
    const raw = await this.gemini.generate(prompt, 4096);

    if (!raw) {
      log.warn('MCQ generation returned null, using fallback');
      return this.fallbackMCQs(req.topics, count);
    }

    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Invalid MCQ array');
      }

      return parsed.slice(0, count).map((q: any, i: number) => ({
        id: `mcq-${i + 1}`,
        type: 'mcq' as const,
        question: String(q.question || ''),
        options: Array.isArray(q.options) ? q.options.slice(0, 4).map(String) : ['A', 'B', 'C', 'D'],
        correctIndex: typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < 4 ? q.correctIndex : 0,
        explanation: String(q.explanation || ''),
        topic: String(q.topic || req.topics[i % req.topics.length] || 'General'),
        difficulty: (['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium') as MCQQuestion['difficulty'],
        marks: 2,
      }));
    } catch (err: any) {
      log.error('MCQ parse failed', { error: err.message });
      return this.fallbackMCQs(req.topics, count);
    }
  }

  private async generateShortAnswers(req: GenerateRequest, count: number, difficulty: string): Promise<ShortAnswerQuestion[]> {
    const context = this.buildContextBlock(req);
    const difficultyInstruction = difficulty === 'mixed'
      ? 'Mix medium (60%) and hard (40%) questions.'
      : `All questions should be ${difficulty} difficulty.`;

    const prompt = `You are an NTU Singapore exam paper setter for Computer Security (SC3010), taught by CCDS LI YI.

${context}

Generate exactly ${count} short-answer questions for a practice exam.
${difficultyInstruction}

Requirements:
- Questions should require 2-5 sentence answers
- Test deeper understanding: compare/contrast, explain why, give examples, analyze scenarios
- Include the model answer and key marking keywords
- Cover the listed topics

Respond ONLY with valid JSON array (no markdown, no backticks, no preamble):
[
  {
    "question": "...",
    "modelAnswer": "2-5 sentence ideal answer",
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "topic": "Topic name",
    "difficulty": "medium|hard"
  }
]`;

    log.debug('Generating short answers', { count, difficulty });
    const raw = await this.gemini.generate(prompt, 3000);

    if (!raw) {
      log.warn('Short answer generation returned null, using fallback');
      return this.fallbackShortAnswers(req.topics, count);
    }

    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Invalid short answer array');
      }

      return parsed.slice(0, count).map((q: any, i: number) => ({
        id: `sa-${i + 1}`,
        type: 'short-answer' as const,
        question: String(q.question || ''),
        modelAnswer: String(q.modelAnswer || ''),
        keywords: Array.isArray(q.keywords) ? q.keywords.map(String) : [],
        topic: String(q.topic || req.topics[i % req.topics.length] || 'General'),
        difficulty: (['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium') as ShortAnswerQuestion['difficulty'],
        marks: 5,
      }));
    } catch (err: any) {
      log.error('Short answer parse failed', { error: err.message });
      return this.fallbackShortAnswers(req.topics, count);
    }
  }

  /* ── Fallback generators (when Gemini fails/rate-limited) ────────────── */

  private fallbackMCQs(topics: string[], count: number): MCQQuestion[] {
    log.info('Using fallback MCQs', { count });
    const templates = [
      { q: 'Which of the following BEST describes {topic}?', opts: ['A core security principle', 'A network protocol', 'A programming language', 'A hardware component'], ci: 0 },
      { q: 'What is the PRIMARY purpose of {topic} in computer security?', opts: ['To encrypt data', 'To authenticate users', 'To protect system integrity', 'To monitor network traffic'], ci: 2 },
      { q: 'In the context of {topic}, which vulnerability is MOST critical?', opts: ['Buffer overflow', 'SQL injection', 'Cross-site scripting', 'All of the above'], ci: 3 },
    ];
    return Array.from({ length: count }, (_, i) => {
      const topic = topics[i % topics.length] || 'Security';
      const tmpl = templates[i % templates.length];
      return {
        id: `mcq-${i + 1}`,
        type: 'mcq' as const,
        question: tmpl.q.replace('{topic}', topic),
        options: tmpl.opts,
        correctIndex: tmpl.ci,
        explanation: `This relates to the core concept of ${topic}.`,
        topic,
        difficulty: 'medium' as const,
        marks: 2,
      };
    });
  }

  private fallbackShortAnswers(topics: string[], count: number): ShortAnswerQuestion[] {
    log.info('Using fallback short answers', { count });
    return Array.from({ length: count }, (_, i) => {
      const topic = topics[i % topics.length] || 'Security';
      return {
        id: `sa-${i + 1}`,
        type: 'short-answer' as const,
        question: `Explain the concept of ${topic} and provide one real-world example of its application in computer security.`,
        modelAnswer: `${topic} is a fundamental concept in computer security that involves protecting systems and data. A real-world example includes its application in modern enterprise security architectures.`,
        keywords: [topic.toLowerCase(), 'security', 'protection'],
        topic,
        difficulty: 'medium' as const,
        marks: 5,
      };
    });
  }
}

/* ── Request Handler ─────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { module, topics, segmentSlides, pastPaperContext, difficulty, mcqCount, shortAnswerCount } = body;

    if (!module || !Array.isArray(topics) || topics.length === 0) {
      log.warn('Invalid request body', { module, topicsProvided: Array.isArray(topics) });
      return NextResponse.json(
        { error: 'Missing required fields: module (string) and topics (string[])' },
        { status: 400 },
      );
    }

    log.info('Practice paper requested', { module, topicCount: topics.length });

    const generator = new PaperGenerator();
    const paper = await generator.generatePaper({
      module,
      topics,
      segmentSlides,
      pastPaperContext,
      difficulty,
      mcqCount,
      shortAnswerCount,
    });

    log.info('Practice paper served', {
      module,
      totalQuestions: paper.meta.questionsGenerated,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(paper);
  } catch (error: any) {
    const message = error?.message ?? 'Failed to generate practice paper';
    log.error('Practice paper generation failed', { error: message, durationMs: Date.now() - startTime });

    const isConfig = typeof message === 'string' && (
      message.includes('not configured') ||
      message.includes('GEMINI') ||
      message.includes('API_KEY')
    );

    return NextResponse.json(
      { error: message },
      { status: isConfig ? 503 : 500 },
    );
  }
}
