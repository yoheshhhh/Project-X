import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const log = logger.child('BurnoutAPI');

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1500, temperature: 0.7 },
    }),
  });
  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export async function POST(request) {
  try {
    const studyData = await request.json();
    log.info('Burnout analysis requested', { hours: studyData.totalHoursThisWeek });

    const signals = [];
    let riskScore = 0;

    // Detailed signal analysis
    const breakdown = [];

    if (studyData.totalHoursThisWeek > 35) {
      signals.push('Studying more than 35 hours this week');
      riskScore += 30;
      breakdown.push({ signal: 'Weekly study hours', value: `${studyData.totalHoursThisWeek}h`, threshold: '35h', points: 30, status: 'danger' });
    } else if (studyData.totalHoursThisWeek > 25) {
      breakdown.push({ signal: 'Weekly study hours', value: `${studyData.totalHoursThisWeek}h`, threshold: '35h', points: 0, status: 'warning' });
    } else {
      breakdown.push({ signal: 'Weekly study hours', value: `${studyData.totalHoursThisWeek}h`, threshold: '35h', points: 0, status: 'healthy' });
    }

    if (studyData.avgSessionHour >= 23 || studyData.avgSessionHour <= 4) {
      signals.push('Frequently studying late at night (11pm-4am)');
      riskScore += 20;
      breakdown.push({ signal: 'Study time of day', value: `${studyData.avgSessionHour}:00`, threshold: '5am-10pm', points: 20, status: 'danger' });
    } else {
      breakdown.push({ signal: 'Study time of day', value: `${studyData.avgSessionHour}:00`, threshold: '5am-10pm', points: 0, status: 'healthy' });
    }

    if (studyData.avgDurationMinutes > 180) {
      signals.push('Average session exceeds 3 hours without breaks');
      riskScore += 15;
      breakdown.push({ signal: 'Avg session length', value: `${studyData.avgDurationMinutes}min`, threshold: '180min', points: 15, status: 'danger' });
    } else if (studyData.avgDurationMinutes > 120) {
      breakdown.push({ signal: 'Avg session length', value: `${studyData.avgDurationMinutes}min`, threshold: '180min', points: 0, status: 'warning' });
    } else {
      breakdown.push({ signal: 'Avg session length', value: `${studyData.avgDurationMinutes}min`, threshold: '180min', points: 0, status: 'healthy' });
    }

    if (studyData.scoresTrend?.length >= 3) {
      const recent = studyData.scoresTrend.slice(-3);
      if (recent[2] < recent[0] && recent[1] < recent[0]) {
        signals.push('Quiz scores declining despite continued studying');
        riskScore += 25;
        breakdown.push({ signal: 'Score trend', value: recent.join(' → '), threshold: 'Improving', points: 25, status: 'danger' });
      } else {
        breakdown.push({ signal: 'Score trend', value: recent.join(' → '), threshold: 'Improving', points: 0, status: 'healthy' });
      }
    }

    if (studyData.streakDays > 14) {
      signals.push('No rest days in over 2 weeks');
      riskScore += 10;
      breakdown.push({ signal: 'Rest days', value: `${studyData.streakDays} day streak`, threshold: 'Rest every 7 days', points: 10, status: 'danger' });
    } else {
      breakdown.push({ signal: 'Rest days', value: `${studyData.streakDays} day streak`, threshold: 'Rest every 7 days', points: 0, status: 'healthy' });
    }

    const riskLevel = riskScore >= 50 ? 'high' : riskScore >= 25 ? 'moderate' : 'low';

    // Always call AI for personalized recommendation + schedule
    const prompt = `You are a caring university student wellbeing advisor at NTU Singapore. Be warm, non-judgmental, specific, and practical.

A student has these study patterns this week:
- Total hours: ${studyData.totalHoursThisWeek}
- Average session: ${studyData.avgDurationMinutes} minutes
- Usually studies at: ${studyData.avgSessionHour}:00
- Recent quiz scores: ${studyData.scoresTrend?.join(', ') || 'N/A'}
- Study streak: ${studyData.streakDays} consecutive days
- Sessions this week: ${studyData.sessionsThisWeek}

Burnout risk level: ${riskLevel} (score: ${riskScore}/100)
Signals: ${signals.length > 0 ? signals.join(', ') : 'None detected'}

Respond ONLY with valid JSON, no markdown backticks:
{
  "recommendation": "2-3 sentence caring personalized recommendation",
  "schedule": {
    "morning": "what to do in the morning (e.g. light review, exercise)",
    "afternoon": "what to do in the afternoon (e.g. focused study blocks)",
    "evening": "what to do in the evening (e.g. practice problems, rest)",
    "night": "what to do at night (e.g. wind down, no screens)"
  },
  "weeklyTip": "one specific actionable tip for this week"
}`;

    let recommendation = 'Your study patterns look healthy! Keep up the good work and remember to take regular breaks.';
    let schedule = null;
    let weeklyTip = 'Try the Pomodoro technique: 25 minutes focused study, 5 minutes break.';

    try {
      const aiResponse = await callGemini(prompt);
      const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      recommendation = parsed.recommendation || recommendation;
      schedule = parsed.schedule || null;
      weeklyTip = parsed.weeklyTip || weeklyTip;
    } catch (e) {
      log.error('Failed to parse AI burnout response', { error: e.message });
    }

    const mentalHealthResources = [
      { name: 'NTU University Counselling Centre', contact: '6790 4462', type: 'Counselling', url: 'https://www.ntu.edu.sg/life-at-ntu/student-life/student-wellbeing/counselling' },
      { name: 'NTU 24hr Mental Health Hotline', contact: '1800-274-4788', type: 'Crisis', url: '' },
      { name: 'Singapore Association for Mental Health', contact: '1800-283-7019', type: 'Helpline', url: 'https://www.samhealth.org.sg' },
      { name: 'Campus Care Network', contact: 'campuscare@ntu.edu.sg', type: 'Peer Support', url: '' },
    ];

    return NextResponse.json({
      riskLevel,
      riskScore: Math.min(100, riskScore),
      signals,
      breakdown,
      recommendation,
      schedule,
      weeklyTip,
      mentalHealthResources,
    });
  } catch (error) {
    log.error('Burnout API error', { error: error.message });
    return NextResponse.json({ riskLevel: 'low', riskScore: 0, signals: [], breakdown: [], recommendation: 'Unable to analyze. Please try again.', schedule: null, weeklyTip: '', mentalHealthResources: [] }, { status: 500 });
  }
}
