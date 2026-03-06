/**
 * Firebase Admin SDK (server-only).
 * Export adminDb for Firestore. Null when firebase-admin is not installed or not configured.
 * To enable: npm install firebase-admin, then initialize and export adminDb here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any




import admin from 'firebase-admin';

function initAdmin(): FirebaseFirestore.Firestore | null {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      return null;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    }

    return admin.firestore();
  } catch {
    return null;
  }
}

// Export Firestore database — null when not configured
export const adminDb = initAdmin();


