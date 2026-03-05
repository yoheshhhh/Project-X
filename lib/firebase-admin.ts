/**
 * Firebase Admin SDK (server-only).
 * Export adminDb for Firestore. Null when firebase-admin is not installed or not configured.
 * To enable: npm install firebase-admin, then initialize and export adminDb here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any




import admin from 'firebase-admin';

// Only initialize once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Convert \n sequences to actual newlines
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

// Export Firestore database
export const adminDb = admin.firestore();


