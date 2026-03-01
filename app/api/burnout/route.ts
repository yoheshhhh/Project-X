import { NextRequest, NextResponse } from 'next/server';
import { analyzeBurnoutRisk } from '@/lib/gemini-ai';
import { logger } from '@/lib/logger';

const log = logger.child('API:Burnout');

/**
 * POST /api/burnout
 * Analyze study patterns for burnout risk.
 * 
 * Body: { sessionsThisWeek, avgDurationMinutes, avgSessionHour, scoresTrend, streakDays, totalHoursThisWeek }
 * Returns: BurnoutAnalysis
 */
export async function POST(request: NextRequest) {
  try {
    const studyData = await request.json();

    log.info('Burnout analysis requested', { hours: studyData.totalHoursThisWeek });

    const analysis = await analyzeBurnoutRisk(studyData);
    return NextResponse.json(analysis);
  } catch (error: any) {
    log.error('Burnout analysis failed', { error: error.message });
    return NextResponse.json({ error: 'Failed to analyze burnout risk' }, { status: 500 });
  }
}
