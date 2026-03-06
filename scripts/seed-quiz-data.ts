import { config } from 'dotenv';
config({ path: '.env.local' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app);

const quizDetails = {
  quiz1: {
    topic: "Introduction to Software Security",
    score: 7,
    totalQuestions: 10,
    date: "2026-02-25",
    timeTakenMinutes: 12,
    wrongQuestions: [
      {
        question: "What is a buffer overflow?",
        studentAnswer: "A memory error caused by too much data",
        correctAnswer: "Writing data beyond the bounds of allocated memory",
        concept: "memory safety",
        mistakeType: "conceptual"
      },
      {
        question: "Which CIA property does data leakage violate?",
        studentAnswer: "Integrity",
        correctAnswer: "Confidentiality",
        concept: "CIA framework",
        mistakeType: "conceptual"
      },
      {
        question: "What does the %n format specifier do?",
        studentAnswer: "Prints a newline",
        correctAnswer: "Writes the number of characters printed so far to a memory address",
        concept: "format string vulnerability",
        mistakeType: "memory"
      }
    ]
  },
  quiz2: {
    topic: "Threat Modeling",
    score: 8,
    totalQuestions: 10,
    date: "2026-02-26",
    timeTakenMinutes: 15,
    wrongQuestions: [
      {
        question: "What does DREAD stand for?",
        studentAnswer: "Damage, Reproducibility, Exploitability, Affected users, Discoverability",
        correctAnswer: "Damage, Reproducibility, Exploitability, Affected users, Discoverability",
        concept: "DREAD framework",
        mistakeType: "careless"
      },
      {
        question: "Which STRIDE category does SQL injection fall under?",
        studentAnswer: "Spoofing",
        correctAnswer: "Tampering",
        concept: "STRIDE framework",
        mistakeType: "conceptual"
      }
    ]
  },
  quiz3: {
    topic: "Secure Coding Practices",
    score: 6,
    totalQuestions: 10,
    date: "2026-02-27",
    timeTakenMinutes: 18,
    wrongQuestions: [
      {
        question: "Which function is safer than printf for user input?",
        studentAnswer: "scanf",
        correctAnswer: "printf with a hardcoded format string like printf(\"%s\", input)",
        concept: "format string safety",
        mistakeType: "conceptual"
      },
      {
        question: "What type of overflow occurs when converting unsigned long to unsigned int?",
        studentAnswer: "Arithmetic overflow",
        correctAnswer: "Widthness overflow / truncation error",
        concept: "integer overflow types",
        mistakeType: "memory"
      },
      {
        question: "What is the fix for integer overflow in length checking?",
        studentAnswer: "Check len1 + len2 <= buffer size",
        correctAnswer: "Check each value individually: len1 <= buf && len2 <= buf && len1+len2+1 <= buf",
        concept: "integer overflow prevention",
        mistakeType: "conceptual"
      },
      {
        question: "Which API should replace system() to prevent command injection?",
        studentAnswer: "exec()",
        correctAnswer: "execve() in C or subprocess.run() in Python",
        concept: "command injection prevention",
        mistakeType: "memory"
      }
    ]
  }
};

async function main() {
  await db.collection('students').doc('student_1').update({
    quizDetails
  });
  console.log('✅ Quiz details added to Firestore successfully!');
  process.exit(0);
}

main().catch(console.error);