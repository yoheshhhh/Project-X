import { NextRequest, NextResponse } from 'next/server';
import { generateFlashcards } from '@/lib/gemini-ai';
import { logger } from '@/lib/logger';

const log = logger.child('API:Flashcards');

/**
 * POST /api/flashcards
 * Generate AI flashcards when student fails a quiz twice.
 * 
 * Body: { topic: string, missedQuestions: string[], learningStyle: string }
 * Returns: { flashcards: Flashcard[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, missedQuestions, learningStyle } = body;

    log.info('Flashcard generation requested', { topic, missedCount: missedQuestions?.length });

    // Validate input
    if (!topic || !missedQuestions || !Array.isArray(missedQuestions)) {
      log.warn('Invalid request body', { body });
      return NextResponse.json(
        { error: 'Missing required fields: topic, missedQuestions' },
        { status: 400 }
      );
    }

    const flashcards = await generateFlashcards(
      topic,
      missedQuestions,
      learningStyle || 'balanced'
    );

    return NextResponse.json({ flashcards });
  } catch (error: any) {
    log.error('Flashcard generation failed', { error: error.message });
    return NextResponse.json(
      { error: 'Failed to generate flashcards' },
      { status: 500 }
    );
  }
}
