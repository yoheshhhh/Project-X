import { NextResponse } from 'next/server';
import { LinearRegression } from '@/lib/insights-data';
import { logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/api-auth';

const log = logger.child('PredictionEngine');

export async function POST(request: Request) {
  const authResult = await verifyAuth(request);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { scores, topics } = await request.json();
    log.info('Prediction requested', { scoreCount: scores.length });

    if (!scores || scores.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 scores' }, { status: 400 });
    }

    const model = new LinearRegression().fit(scores);
    const nextScore = model.predict(scores.length);
    const slope = model.getSlope();
    const r2 = model.getR2();
    const trend = model.getTrend();
    const status = model.getStatus();

    const topicPredictions: any[] = [];
    if (topics && Object.keys(topics).length > 0) {
      for (const [topic, topicScores] of Object.entries(topics)) {
        const ts = topicScores as number[];
        if (ts.length >= 2) {
          const tModel = new LinearRegression().fit(ts);
          topicPredictions.push({ topic, currentAvg: Math.round(ts.reduce((a, b) => a + b, 0) / ts.length), predictedNext: tModel.predict(ts.length), slope: tModel.getSlope(), trend: tModel.getTrend(), status: tModel.getStatus(), r2: tModel.getR2(), dataPoints: ts.length });
        }
      }
    }

    const confidence = r2 > 0.8 ? 'high' : r2 > 0.5 ? 'medium' : 'low';
    const margin = r2 > 0.8 ? 5 : r2 > 0.5 ? 10 : 15;

    return NextResponse.json({
      overall: { currentScore: scores[scores.length - 1], predictedNext: Math.min(100, Math.max(0, nextScore)), predictedRange: { low: Math.max(0, nextScore - margin), high: Math.min(100, nextScore + margin) }, delta: Math.round((nextScore - scores[scores.length - 1]) * 10) / 10, slope, r2, trend, status, confidence, model: 'Linear Regression', dataPoints: scores.length },
      topicPredictions: topicPredictions.sort((a, b) => a.slope - b.slope),
      riskTopics: topicPredictions.filter(t => t.slope < -1).map(t => t.topic),
      growthTopics: topicPredictions.filter(t => t.slope > 1).map(t => t.topic),
      meta: { algorithm: 'Ordinary Least Squares Linear Regression', implementation: 'Pure JavaScript (equivalent to scikit-learn LinearRegression)', timestamp: new Date().toISOString() },
    });
  } catch (error: any) {
    log.error('Prediction error', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
