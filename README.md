# 🎓 NTUlearn

> An AI-powered adaptive learning platform that understands who you are as a learner, breaks content into digestible pieces, and evolves with you.

**DLWeek 2026 · Microsoft Track**

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Setup & Installation](#setup--installation)
- [Running the Project](#running-the-project)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Demo Walkthrough](#demo-walkthrough)
- [Team](#team)
- [Citations](#citations)

---

## Overview

NTUlearn addresses a critical gap in modern education: despite the abundance of learning data, most students lack clear, actionable insight into their learning journey. Our platform models each student's evolving learning state through a **Learner DNA Profile**, delivers content through an adaptive **Micro-Learning Engine**, and provides personalized AI-powered guidance via **Azure OpenAI**.

### Problem We Solve

- Students don't know **why** they keep getting things wrong
- Learning platforms treat all students the same
- No system detects **burnout** before it's too late
- Students study in isolation without intelligent peer matching

### Our Solution

A 6-pillar adaptive learning system:

1. **Smart Identity** — University SSO + role-based access
2. **Learner DNA Profile** — Personality quiz → AI persona object
3. **Micro-Learning Engine** — Segmented videos + quiz gates + AI flashcards
4. **Progress Tracking** — Mastery dashboard + streaks + inactivity recovery
5. **Wellbeing** — AI burnout detector + mental health check-ins
6. **Community** — Study groups + anonymous peer comparison

---

## Features

### 🔐 Authentication & Roles
- Simulated NTU SSO (university-gated login)
- Role-based access: Student / Professor / Admin

### 🧠 Learner DNA Quiz
- 7-question personality + cognitive assessment
- Generates a `UserPersona` object the AI references for all recommendations
- Classifies learning style: short-term intensive vs long-term gradual
- Detects preferred question format (MCQ / short answer / essay)

### 📚 Micro-Learning Engine
- Lectures broken into short video segments
- Quiz after each segment — must pass to unlock next (LAMS-style gating)
- **AI Flashcards**: When a student fails twice, Azure OpenAI generates personalized flashcards
- **"I'm Lost" Button**: One-click simplified 3-sentence summary of any video moment
- **Peer-Tutoring Trigger**: After 3 failed attempts, connects student with top performer
- **Practice Paper Generator**: End-of-module AI-generated exam in preferred format

### 📊 Progress Dashboard
- Per-topic mastery: Good / Average / Weak
- Study streak tracking (Duolingo-style)
- Inactivity welcome-back with memory refresh
- Anonymous peer comparison ("You're in the top 30%")

### 🧘 Wellbeing
- AI burnout detector (monitors study patterns, late nights, declining scores)
- Mental health check-in prompts with university resource connections

### 👥 Community
- Form/join study groups with time + location
- Anonymous class-wide knowledge gap visibility

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │  Login   │ │  Quiz    │ │  Course  │ │Dashboard││
│  │  Page    │ │  Page    │ │  Player  │ │  Page   ││
│  └──────────┘ └──────────┘ └──────────┘ └────────┘│
└────────────────────┬────────────────────────────────┘
                     │ API Routes
┌────────────────────┼────────────────────────────────┐
│              BACKEND (Next.js API)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │/api/     │ │/api/     │ │/api/     │ │/api/   ││
│  │flashcards│ │summary   │ │practice  │ │burnout ││
│  └─────┬────┘ └─────┬────┘ └─────┬────┘ └───┬────┘│
└────────┼────────────┼────────────┼───────────┼──────┘
         │            │            │           │
    ┌────┴────────────┴────────────┴───────────┴──┐
    │              AZURE OPENAI (GPT-4o)          │
    └─────────────────────────────────────────────┘
                     │
    ┌────────────────┴────────────────────────────┐
    │            FIREBASE (Firestore + Auth)       │
    │  Users · Personas · QuizResults · Sessions   │
    └──────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14 + React 18 | Server-side rendered UI |
| Styling | Tailwind CSS | Rapid, consistent styling |
| Animation | Framer Motion | Smooth page transitions |
| Charts | Recharts | Dashboard visualizations |
| Auth & DB | Firebase Auth + Firestore | User management + data |
| AI | Azure OpenAI (GPT-4o) | Flashcards, summaries, papers, burnout |
| Deployment | Vercel | One-click deployment |

---

## Setup & Installation

### Prerequisites
- Node.js 18+ installed
- Firebase project created
- Azure OpenAI resource provisioned

### Step 1: Clone & Install

```bash
git clone https://github.com/YOUR_TEAM/ntulearn.git
cd ntulearn
npm install
```

### Step 2: Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
- Firebase config (from Firebase Console → Project Settings)
- Azure OpenAI key + endpoint (from Azure Portal)

### Step 3: Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create project → Enable Authentication (Email/Password)
3. Enable Firestore Database
4. Copy config values to `.env.local`

### Step 4: Azure OpenAI Setup

1. Go to [Azure AI Foundry](https://ai.azure.com)
2. Deploy a GPT-4o model
3. Copy API key + endpoint to `.env.local`

---

## Running the Project

```bash
# Development (with DEBUG logging)
npm run dev

# Production build
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
ntulearn/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   ├── login/              # Login page (Person 2)
│   ├── quiz/               # Learner DNA quiz (Person 2)
│   ├── course/             # Video player + quizzes (Person 3)
│   ├── dashboard/          # Progress dashboard (Person 5)
│   └── api/                # Backend API routes (Person 4)
│       ├── flashcards/     # AI flashcard generation
│       ├── summary/        # "I'm Lost" video summary
│       ├── practice/       # Practice paper generation
│       └── burnout/        # Burnout risk analysis
├── components/             # Reusable React components
│   ├── ui/                 # Generic UI (buttons, cards, modals)
│   ├── course/             # Course-specific components
│   ├── dashboard/          # Dashboard components
│   └── quiz/               # Quiz components
├── lib/                    # Core logic & services
│   ├── firebase.ts         # Firebase config + helpers
│   ├── azure-ai.ts         # Azure OpenAI service
│   ├── logger.ts           # Structured logging utility
│   └── demo-data.ts        # Demo module content
├── testbench/              # Testing documentation
│   └── TESTBENCH.md        # Instructions for judges
├── docs/                   # Additional documentation
└── public/                 # Static assets
```

---

## API Documentation

### POST `/api/flashcards`
Generate personalized flashcards on quiz failure.

```json
// Request
{ "topic": "For Loops", "missedQuestions": ["What does range(5) generate?"], "learningStyle": "short-term-intensive" }

// Response
{ "flashcards": [{ "front": "...", "back": "...", "difficulty": "medium" }] }
```

### POST `/api/summary`
Generate "I'm Lost" 3-sentence summary.

```json
// Request
{ "topic": "Control Structures", "segmentTitle": "If-Else Statements", "segmentContent": "...", "timestamp": "3:42" }

// Response
{ "summary": "Don't worry! Here's the key idea: ..." }
```

### POST `/api/practice`
Generate end-of-module practice paper.

```json
// Request
{ "moduleName": "Control Structures", "weakTopics": ["For Loops", "While Loops"], "preferredFormat": "mcq", "questionCount": 10 }

// Response
{ "questions": [{ "id": "q1", "question": "...", "options": [...], "correctAnswer": "B", ... }] }
```

### POST `/api/burnout`
Analyze study patterns for burnout risk.

```json
// Request
{ "sessionsThisWeek": 14, "avgDurationMinutes": 200, "avgSessionHour": 23, "scoresTrend": [80, 70, 55], "streakDays": 18, "totalHoursThisWeek": 42 }

// Response
{ "riskLevel": "high", "riskScore": 75, "signals": ["..."], "recommendation": "..." }
```

---

## Demo Walkthrough

1. **Landing Page** → Click "Get Started"
2. **Login** → Select role (Student), enter demo credentials
3. **Learner DNA Quiz** → Answer 7 questions → View generated persona
4. **Course Page** → Watch Segment 1 → Take quiz → Unlock Segment 2
5. **Fail a quiz** → See AI-generated flashcards appear
6. **Click "I'm Lost"** → See instant 3-sentence summary
7. **Dashboard** → View mastery status, streaks, peer comparison
8. **Burnout Warning** → See AI wellbeing alert (demo data shows high study hours)

---

## Team

| Member | Role | Responsibilities |
|--------|------|-----------------|
| Person 1 Narhen | Architect | Project setup, integration, dashboard, docs |
| Person 2 | Gatekeeper | Login, SSO simulation, Learner DNA quiz |
| Person 3 | Content Engine | Video player, quiz gates, "I'm Lost" button |
| Person 4 | AI Brain | All Azure OpenAI integrations, API routes |
| Person 5 | Dashboard Designer | Progress tracking, charts, peer comparison |

---

## Citations

[1] Microsoft Azure OpenAI Service Documentation. Microsoft Learn. https://learn.microsoft.com/azure/ai-foundry/openai/overview

[2] Firebase Documentation. Google. https://firebase.google.com/docs

[3] Next.js Documentation. Vercel. https://nextjs.org/docs

[4] Tailwind CSS Documentation. https://tailwindcss.com/docs

[5] Ebbinghaus, H. (1885). "Memory: A Contribution to Experimental Psychology." — Foundational work on the forgetting curve, informing our spaced repetition features.

[6] Recharts Documentation. https://recharts.org

[7] Framer Motion Documentation. https://www.framer.com/motion

---

*Built with ❤️ for DLWeek 2026 — Microsoft Track*
