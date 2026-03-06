import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/api-auth';

// 5-minute in-memory cache
let cache: { cohortAvg: number; top10: number; notEnoughData: boolean; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request: Request) {
  const authResult = await verifyAuth(request);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Return cached if fresh
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json({ cohortAvg: cache.cohortAvg, top10: cache.top10, notEnoughData: cache.notEnoughData });
  }

  if (!adminDb) {
    return NextResponse.json({ cohortAvg: null, top10: null, notEnoughData: true });
  }

  try {
    const snap = await adminDb.collection('segmentQuizScores').get();

    // Group scores by UID, compute per-student average
    const byUser: Record<string, number[]> = {};
    snap.docs.forEach((doc) => {
      const d = doc.data();
      if (d.uid && typeof d.score === 'number') {
        if (!byUser[d.uid]) byUser[d.uid] = [];
        byUser[d.uid].push(d.score);
      }
    });

    const studentAvgs = Object.values(byUser).map(
      (scores) => Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    );

    if (studentAvgs.length < 3) {
      const result = { cohortAvg: null, top10: null, notEnoughData: true };
      cache = { ...result, cohortAvg: 0, top10: 0, timestamp: Date.now() };
      return NextResponse.json(result);
    }

    const cohortAvg = Math.round(studentAvgs.reduce((a, b) => a + b, 0) / studentAvgs.length);
    const sorted = [...studentAvgs].sort((a, b) => a - b);
    const p90Index = Math.floor(sorted.length * 0.9);
    const top10 = sorted[Math.min(p90Index, sorted.length - 1)];

    cache = { cohortAvg, top10, notEnoughData: false, timestamp: Date.now() };
    return NextResponse.json({ cohortAvg, top10, notEnoughData: false });
  } catch (err: any) {
    console.error('cohort-stats error:', err.message);
    return NextResponse.json({ cohortAvg: null, top10: null, notEnoughData: true });
  }
}
