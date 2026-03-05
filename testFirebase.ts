import { adminDb } from './lib/firebase-admin';


async function testFirestore() {
  try {
    const snapshot = await adminDb.collection('students').get();
    console.log('Number of student docs:', snapshot.size);
    snapshot.forEach(doc => {
      console.log(doc.id, doc.data());
    });
  } catch (err) {
    console.error('Firestore error:', err);
  }
}

testFirestore();