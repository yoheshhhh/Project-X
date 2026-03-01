# Content Engine Demo

Standalone LAMS-style gated video + quiz. Use until the main repo (Narhen's) is ready, then copy into `src/` and wire Firebase + auth.

## Run

```bash
cd content-engine-demo
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Go to Watch**.

## What’s included

- **Types** `src/types/learning.ts` – shared with main repo
- **Demo config** `src/data/demoModule.ts` – set your YouTube video ID and edit quizzes
- **Progress** `src/lib/progress.ts` – localStorage for now; swap to Firestore later
- **AI help** `src/lib/ai-help.ts` – mock; Nanda replaces with Azure OpenAI
- **VideoPlayer** – YouTube embed, segment boundaries from duration, pause at segment end, no seek past unlock
- **QuizModal** – MCQs, pass (≥70%) unlocks next segment; 2 fails → flashcards
- **LostHelpModal** – “I’m Lost” shows mock summary/example/question
- **FlashcardModal** – after 2 quiz failures, then retry

## Your video

Edit `src/data/demoModule.ts`:

- `youtubeVideoId`: replace with your lecture video ID (from the YouTube URL).
- `quizzes`: adjust questions/options/correctIndex per segment.

## Integration

When the main repo is ready:

1. Copy `src/types`, `src/data`, `src/lib`, `src/components` into the main app.
2. Add the watch route (e.g. `/watch/[moduleId]`) and use `userId` from auth.
3. Replace `progressService` with Firestore implementation.
4. Replace `aiHelpService` with Nanda’s API.
