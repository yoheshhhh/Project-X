import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/api-auth';

export interface GradeEntry {
  course: string;
  code: string;
  item: string;
  score: string;
  max: string;
  grade: string;
  released?: boolean;
  order?: number;
}

/** GET /api/grades — returns grades for the authenticated user. Uses Admin SDK so no Firestore rules change needed. */
export async function GET(req: Request) {
  const authResult = await verifyAuth(req);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!adminDb) {
    return NextResponse.json({ error: 'Grades service unavailable' }, { status: 503 });
  }

  try {
    const uid = authResult.uid;

    const snapshot = await adminDb.collection('users').doc(uid).collection('grades').get();
    const entries = snapshot.docs.map((d: { id: string; data: () => Record<string, unknown> }) => ({
      id: d.id,
      ...d.data(),
    })) as (GradeEntry & { id: string })[];

    entries.sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.course + a.item).localeCompare(b.course + b.item);
    });

    const grades = entries.map(({ id: _id, ...e }) => e as GradeEntry);
    return NextResponse.json({ grades });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
