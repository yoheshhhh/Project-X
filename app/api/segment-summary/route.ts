import { NextRequest, NextResponse } from 'next/server';
import { generateSegmentTakeaways } from '@/lib/openai-ai';
import { logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/api-auth';

const log = logger.child('API:SegmentSummary');

/**
 * POST /api/segment-summary
 * "What you learned" after passing a segment: 2–3 bullets + one thing to remember.
 * Body: { topic: string, segmentIndex: number, segmentSlides?: string }
 * Returns: { bullets: string[], oneThing: string }
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { topic, segmentIndex, segmentSlides, mistakes } = body;

    if (typeof topic !== 'string' || typeof segmentIndex !== 'number') {
      return NextResponse.json({ error: 'Missing topic or segmentIndex' }, { status: 400 });
    }

    const validMistakes =
      Array.isArray(mistakes) && mistakes.length > 0
        ? mistakes.filter(
            (m: unknown) =>
              m &&
              typeof (m as { question?: string }).question === 'string' &&
              typeof (m as { chosenOption?: string }).chosenOption === 'string' &&
              typeof (m as { correctOption?: string }).correctOption === 'string'
          )
        : undefined;

    log.info('Segment takeaways requested', { topic, segmentIndex, mistakeCount: validMistakes?.length ?? 0 });

    const result = await generateSegmentTakeaways(
      topic,
      segmentIndex,
      typeof segmentSlides === 'string' ? segmentSlides : undefined,
      validMistakes
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate takeaways';
    log.error('Segment summary failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
