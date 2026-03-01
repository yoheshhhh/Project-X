import { NextRequest, NextResponse } from 'next/server';
import { generateVideoSummary } from '@/lib/gemini-ai';
import { logger } from '@/lib/logger';

const log = logger.child('API:Summary');

/**
 * POST /api/summary
 * Generate simplified 3-sentence summary when student clicks "I'm Lost"
 * 
 * Body: { topic, segmentTitle, segmentContent, timestamp }
 * Returns: { summary: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { topic, segmentTitle, segmentContent, timestamp } = await request.json();

    log.info('Summary requested', { topic, segmentTitle, timestamp });

    if (!topic || !segmentTitle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const summary = await generateVideoSummary(
      topic,
      segmentTitle,
      segmentContent || '',
      timestamp || '0:00'
    );

    return NextResponse.json({ summary });
  } catch (error: any) {
    log.error('Summary generation failed', { error: error.message });
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
