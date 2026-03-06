import { NextRequest, NextResponse } from 'next/server';
import { generatePersonaFromProfile } from '@/lib/openai-ai';
import { verifyAuth } from '@/lib/api-auth';

/**
 * POST /api/generate-persona-traits
 * Body: { learningStyle, studyHoursPerDay, studyDaysPerWeek, examPrepWeek, preferredQuestionFormat, cognitiveScore [, rawAnswers ] }
 * Returns: { personalityTraits: string[], learnerTypes: string[] }
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const {
      learningStyle,
      studyHoursPerDay,
      studyDaysPerWeek,
      examPrepWeek,
      preferredQuestionFormat,
      cognitiveScore,
      readinessScore,
      rawAnswers,
    } = body;
    const profile = {
      learningStyle: typeof learningStyle === 'string' ? learningStyle : 'long-term-gradual',
      studyHoursPerDay: typeof studyHoursPerDay === 'number' ? studyHoursPerDay : Number(studyHoursPerDay) || 2,
      studyDaysPerWeek: typeof studyDaysPerWeek === 'number' ? studyDaysPerWeek : Number(studyDaysPerWeek) || 4,
      examPrepWeek: typeof examPrepWeek === 'number' ? examPrepWeek : Number(examPrepWeek) || 2,
      preferredQuestionFormat: typeof preferredQuestionFormat === 'string' ? preferredQuestionFormat : 'mcq',
      cognitiveScore: typeof cognitiveScore === 'number' ? cognitiveScore : Number(cognitiveScore) || 0,
      readinessScore: typeof readinessScore === 'number' ? readinessScore : undefined,
      rawAnswers: typeof rawAnswers === 'object' && rawAnswers !== null ? rawAnswers : undefined,
    };
    const { personalityTraits, learnerTypes } = await generatePersonaFromProfile(profile);
    return NextResponse.json({ personalityTraits, learnerTypes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate personality traits';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
