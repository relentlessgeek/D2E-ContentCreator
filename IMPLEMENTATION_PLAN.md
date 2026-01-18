# D2E Content Creator - Phased Implementation Plan

## Overview

This document outlines the phased approach to building the D2E Content Creator application, with testing checkpoints at each phase.

---

## Phase 1: Foundation (COMPLETED)

### What's Implemented
- [x] Project structure with frontend/backend separation
- [x] Backend: Express + TypeScript + SQLite
- [x] Frontend: React + TypeScript + Vite + Tailwind
- [x] Database schema for prompts, topics, and lessons
- [x] Default prompt templates seeded on startup
- [x] API endpoints: health, prompts CRUD, topics CRUD, lessons (read)
- [x] Frontend pages: Home, Settings, TopicDetail (stub)
- [x] Prompt editor modal with variable documentation

### How to Test Phase 1

```bash
# 1. Install dependencies
npm run install:all

# 2. Create your .env file
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 3. Start both servers
npm run dev

# 4. Open browser to http://localhost:5173
```

**Test Checklist:**
- [ ] Backend health check shows "Connected" on home page
- [ ] Can create a new topic
- [ ] Topic appears in the list
- [ ] Can click into topic detail page
- [ ] Can delete a topic
- [ ] Settings page shows 3 prompts
- [ ] Can edit and save a prompt template

---

## Phase 2: OpenAI Integration & Topic Breakdown (COMPLETED)

### What's Implemented
- [x] OpenAI service with API client (`backend/src/services/openai.ts`)
- [x] Prompt template variable replacement ({{topic}}, {{lesson_number}}, etc.)
- [x] Topic breakdown endpoint (`POST /api/topics/:id/generate`)
- [x] JSON response parsing from GPT-4o
- [x] Lesson records created with titles and descriptions
- [x] Database migration for description column
- [x] Frontend generation trigger with loading states
- [x] Lesson list display with descriptions

### How to Test Phase 2

```bash
# Make sure your .env file has a valid OPENAI_API_KEY
npm run dev
```

**Test Checklist:**
- [ ] Create a topic "Lean Startup Methodology"
- [ ] Click "Generate Lesson Structure" on topic detail page
- [ ] Verify 3-12 lessons are created
- [ ] Each lesson has a title and description displayed
- [ ] Topic status shows "generating" with lesson list
- [ ] Topic description is populated from AI response

---

## Phase 3: Content Generation (COMPLETED)

### What's Implemented
- [x] Full lesson content generation (2700-3300 words target)
- [x] Podcast summary generation (1000-1200 words target)
- [x] Word count validation with up to 2 retries
- [x] Files saved to `generated-content/{topic-slug}/`
- [x] Filenames: `lesson-01.md`, `lesson-01-podcast.md`
- [x] Background generation with immediate API response
- [x] Frontend polling for progress updates (every 3 seconds)
- [x] Progress bar showing completed/total lessons
- [x] Current step display (content vs podcast)
- [x] Resume support for failed generations

### How to Test Phase 3

**Test Checklist:**
- [ ] Create a new topic and click "Generate All Content"
- [ ] Watch the progress bar update as lessons complete
- [ ] Verify files created in `generated-content/{topic-slug}/`
- [ ] Check lesson .md files are approximately 2700-3300 words
- [ ] Check podcast .md files are approximately 1000-1200 words
- [ ] Topic status becomes "completed" when done
- [ ] All lessons show "completed" status with word counts

---

## Phase 4: Content Viewer (COMPLETED)

### What's Implemented
- [x] Lesson content viewer modal (`frontend/src/components/LessonViewer.tsx`)
- [x] Markdown rendering with styled components (`frontend/src/components/MarkdownRenderer.tsx`)
- [x] Tabs for switching between lesson content and podcast summary
- [x] Previous/Next lesson navigation
- [x] Word count display in viewer footer
- [x] Click on completed lessons to open viewer
- [x] Loading and error states for content fetching

### How to Test Phase 4

**Test Checklist:**
- [ ] Click on a completed lesson in the list
- [ ] Lesson content renders with proper formatting (headings, lists, bold, etc.)
- [ ] Click "Podcast Summary" tab to see podcast content
- [ ] Use Previous/Next buttons to navigate between lessons
- [ ] Word count shown at bottom matches lesson metadata
- [ ] Close button (X) returns to topic detail view

---

## Phase 5: Progress & Error Handling (COMPLETED)

### What's Implemented
- [x] SSE (Server-Sent Events) for real-time progress updates
- [x] SSE manager service for connection management (`backend/src/services/sse-manager.ts`)
- [x] Real-time progress events: breakdown_start, lesson_start, lesson_complete, etc.
- [x] Enhanced error handling with exponential backoff and jitter
- [x] Custom error types: OpenAIConfigError, OpenAIRateLimitError, OpenAIAPIError, OpenAITimeoutError
- [x] Granular retry logic for failed lessons (max 3 retries per lesson)
- [x] Database migration for retry tracking (retry_count, last_error columns)
- [x] New retry endpoint (`POST /api/topics/:id/retry`)
- [x] New SSE stream endpoint (`GET /api/topics/:id/stream`)
- [x] useSSE hook for frontend SSE subscription with auto-reconnect
- [x] GenerationProgress component with detailed status display
- [x] Fallback to polling when SSE is unavailable
- [x] Error messages displayed per lesson and per topic
- [x] Retry button only shows when there are retryable lessons

### How to Test Phase 5

**Test Checklist:**
- [ ] Progress updates in real-time during generation (green dot shows "Live updates")
- [ ] Can see which lesson is currently being generated with title
- [ ] Lesson progress grid shows status of each lesson
- [ ] API errors are displayed to user (per-lesson and topic-level)
- [ ] Can retry failed generations with "Retry Failed Lessons" button
- [ ] Partial completions are preserved on failure
- [ ] SSE connection indicator shows connection status
- [ ] Falls back to polling if SSE fails (yellow dot shows "Polling")

---

## Phase 6: Polish & Enhancements

### Goals
- UI/UX improvements
- Export functionality
- Prompt reset to defaults
- Performance optimizations

### Tasks
1. **Export Features**
   - Download all lessons as ZIP
   - Download single lesson as .md
   - Copy content to clipboard

2. **Settings Enhancements**
   - Reset prompt to default
   - Prompt preview with sample values
   - API key validation

3. **UI Polish**
   - Loading skeletons
   - Empty states
   - Responsive design improvements
   - Keyboard shortcuts

### How to Test Phase 6

**Test Checklist:**
- [ ] Can download all content as ZIP
- [ ] Can reset a prompt to default
- [ ] UI is responsive on mobile
- [ ] Loading states are smooth
- [ ] All empty states have helpful messages

---

## File Structure (Final)

```
D2E-ContentCreator/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TopicForm.tsx
│   │   │   ├── GenerationProgress.tsx
│   │   │   ├── LessonViewer.tsx
│   │   │   ├── MarkdownRenderer.tsx
│   │   │   └── PromptEditor.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── TopicDetail.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   └── ...config files
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── prompts.ts
│   │   │   ├── topics.ts
│   │   │   └── lessons.ts
│   │   ├── services/
│   │   │   ├── openai.ts        # Phase 2
│   │   │   └── generator.ts     # Phase 3
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   └── index.ts
│   │   └── index.ts
│   └── ...config files
│
├── generated-content/           # Created at runtime
├── data/
│   └── content.db
├── .env
└── package.json
```

---

## Quick Reference: API Endpoints

| Endpoint | Method | Phase | Description |
|----------|--------|-------|-------------|
| `/api/health` | GET | 1 | Health check |
| `/api/prompts` | GET | 1 | List all prompts |
| `/api/prompts/:id` | GET | 1 | Get single prompt |
| `/api/prompts/:id` | PUT | 1 | Update prompt template |
| `/api/topics` | GET | 1 | List all topics |
| `/api/topics` | POST | 1 | Create new topic |
| `/api/topics/:id` | GET | 1 | Get topic with lessons |
| `/api/topics/:id` | DELETE | 1 | Delete topic |
| `/api/topics/:id/generate` | POST | 2-3 | Start content generation |
| `/api/topics/:id/status` | GET | 3 | Get generation status (polling) |
| `/api/topics/:id/stream` | GET | 5 | SSE for real-time progress |
| `/api/topics/:id/retry` | POST | 5 | Retry failed lessons |
| `/api/lessons/:id` | GET | 1 | Get lesson metadata |
| `/api/lessons/:id/content` | GET | 4 | Get lesson markdown |
| `/api/lessons/:id/podcast` | GET | 4 | Get podcast markdown |

---

## Getting Started

1. Complete Phase 1 testing
2. Move to Phase 2 when all Phase 1 tests pass
3. Each phase builds on the previous
4. Don't skip phases - dependencies exist between them
