/**
 * Shared server-side auth helper.
 * Verifies Firebase ID tokens from the Authorization header.
 * Falls back to a demo UID when the Admin SDK is not configured.
 */
import admin from 'firebase-admin';

const DEMO_UID = 'demo-user';

function isAdminReady(): boolean {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    return !!(projectId && clientEmail && privateKey);
  } catch {
    return false;
  }
}

/**
 * Verify the Bearer token from the Authorization header.
 * Returns { uid } on success, null on failure.
 * When the Admin SDK is not configured (no env vars), allows requests
 * through with a fallback UID so the app works in demo/development mode.
 */
export async function verifyAuth(req: Request): Promise<{ uid: string } | null> {
  const authHeader = req.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // If Admin SDK is not configured, allow through with demo UID
  if (!isAdminReady()) {
    return { uid: idToken ? 'unknown' : DEMO_UID };
  }

  if (!idToken) return null;

  try {
    // Ensure app is initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
          privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        }),
      });
    }
    const decoded = await admin.auth().verifyIdToken(idToken);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}
