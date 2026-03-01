import { NextRequest, NextResponse } from 'next/server';
import { generatePracticePaper } from '@/lib/gemini-ai';
import { logger } from '@/lib/logger';

const log = logger.child('API:Practice');

/**
 * POST /api/practice
 * Generate personalized practice paper at end of module.
 * 
 * Body: { moduleName, weakTopics, preferredFormat, questionCount }
 * Returns: { questions: PracticeQuestion[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { moduleName, weakTopics, preferredFormat, questionCount } = await request.json();

    log.info('Practice paper requested', { moduleName, weakTopics, preferredFormat });

    if (!moduleName || !weakTopics) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const questions = await generatePracticePaper(
      moduleName,
      weakTopics,
      preferredFormat || 'mcq',
      questionCount || 10
    );

    return NextResponse.json({ questions });
  } catch (error: any) {
    log.error('Practice paper generation failed', { error: error.message });
    return NextResponse.json({ error: 'Failed to generate practice paper' }, { status: 500 });
  }
}
