import { NextRequest, NextResponse } from 'next/server';
import { generateSummary } from '@/lib/openai-ai';
import { logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/api-auth';

const log = logger.child('API:Summary');

/**
 * POST /api/summary
 * Generate simplified 3-sentence summary when student clicks "I'm Lost"
 * 
 * Body: { topic, segmentTitle, segmentContent, timestamp }
 * Returns: { summary: string }
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { topic, segmentTitle, segmentContent, timestamp } = await request.json();

    log.info('Summary requested', { topic, segmentTitle, timestamp });

    if (!topic || !segmentTitle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const summary = await generateSummary(
      topic,
      segmentTitle,
      segmentContent || ''
    );

    return NextResponse.json({ summary });
  } catch (error: any) {
    log.error('Summary generation failed', { error: error.message });
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
