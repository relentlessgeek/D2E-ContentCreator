# Content Magic by Desk2Educate

A powerful AI-powered educational content generation platform that creates comprehensive learning modules and standalone lessons using OpenAI's GPT-4o model.

## Features

- **Module Generation**: Create complete learning modules with multiple lessons from a single topic
- **Standalone Lessons**: Generate individual lessons with title and description
- **Podcast Scripts**: Automatically generates podcast/audio scripts for each lesson
- **Customizable Prompts**: Edit AI prompts to customize content generation style
- **Real-time Progress**: Server-Sent Events (SSE) for live generation updates
- **Word Count Targets**: Ensures lessons meet minimum word count requirements (2700-3300 words for lessons, 1000-1200 for podcasts)
- **Automatic Retry**: Smart retry logic for failed generations
- **Content Expansion**: Automatically expands content that falls short of targets

## Tech Stack

### Backend
- **Node.js** with **Express.js**
- **TypeScript** for type safety
- **SQLite** with **better-sqlite3** for data persistence
- **OpenAI API** (GPT-4o) for content generation
- **Server-Sent Events** for real-time updates

### Frontend
- **React 18** with **TypeScript**
- **Vite** for fast development and building
- **TailwindCSS** for styling
- **React Query** for server state management
- **React Router** for navigation
- **React Markdown** for content rendering

## Project Structure

```
D2E-ContentCreator/
├── backend/
│   ├── src/
│   │   ├── db/              # Database setup and schema
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic (generator, openai, sse)
│   │   ├── types/           # TypeScript interfaces
│   │   └── index.ts         # Express server entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── pages/           # Page components
│   │   ├── services/        # API client
│   │   └── App.tsx          # Main app component
│   └── package.json
├── generated-content/       # Output directory for generated lessons
└── package.json             # Root package with dev scripts
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/relentlessgeek/D2E-ContentCreator.git
   cd D2E-ContentCreator
   ```

2. Install all dependencies:
   ```bash
   npm run install:all
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Add your OpenAI API key to `.env`:
   ```
   OPENAI_API_KEY=your-api-key-here
   ```

### Running the Application

Start both backend and frontend in development mode:
```bash
npm run dev
```

Or run them separately:
```bash
# Terminal 1 - Backend (runs on port 3001)
npm run dev:backend

# Terminal 2 - Frontend (runs on port 5173)
npm run dev:frontend
```

Access the application at: http://localhost:5173

## Usage

### Creating a Module with Lessons

1. Navigate to the home page
2. Enter a topic title in the "Create New Module and Lessons" section
3. Click "Create & Generate"
4. The AI will:
   - Break down the topic into 3-12 lessons
   - Generate comprehensive content for each lesson (2700-3300 words)
   - Create podcast scripts for each lesson (1000-1200 words)
5. Monitor real-time progress on the topic detail page

### Creating a Standalone Lesson

1. On the home page, find the "Create Single Lesson" section
2. Enter a lesson title and description
3. Click "Create & Generate"
4. View the generated lesson content and podcast script

### Customizing Prompts

1. Navigate to Settings
2. Edit the prompt templates:
   - **topic_breakdown**: How topics are split into lessons
   - **lesson_content**: Style and structure of lesson content
   - **podcast_summary**: Format for podcast scripts
3. Changes apply to future generations

## API Endpoints

### Health Check
- `GET /api/health` - Returns API status and version

### Topics (Modules)
- `GET /api/topics` - List all topics
- `POST /api/topics` - Create a new topic
- `GET /api/topics/:id` - Get topic details with lessons
- `DELETE /api/topics/:id` - Delete a topic
- `POST /api/topics/:id/generate` - Start content generation
- `GET /api/topics/:id/status` - Get generation status
- `GET /api/topics/:id/events` - SSE endpoint for real-time updates

### Standalone Lessons
- `GET /api/standalone-lessons` - List all standalone lessons
- `POST /api/standalone-lessons` - Create a new lesson
- `GET /api/standalone-lessons/:id` - Get lesson details
- `DELETE /api/standalone-lessons/:id` - Delete a lesson
- `POST /api/standalone-lessons/:id/generate` - Start generation
- `GET /api/standalone-lessons/:id/content` - Get lesson content
- `GET /api/standalone-lessons/:id/podcast` - Get podcast script

### Prompts
- `GET /api/prompts` - List all prompts
- `GET /api/prompts/:id` - Get a prompt
- `PUT /api/prompts/:id` - Update a prompt

### Lessons
- `GET /api/lessons/:id/content` - Get lesson content
- `GET /api/lessons/:id/podcast` - Get podcast script
- `POST /api/lessons/:id/retry` - Retry failed lesson generation

## Generated Content

Content is saved to the `generated-content/` directory:

```
generated-content/
├── topic-slug/
│   ├── 01-lesson-title.md          # Lesson content
│   ├── 01-lesson-title-podcast.md  # Podcast script
│   ├── 02-lesson-title.md
│   └── 02-lesson-title-podcast.md
└── standalone/
    ├── lesson-slug.md
    └── lesson-slug-podcast.md
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | Required |
| `PORT` | Backend server port | 3001 |
| `NODE_ENV` | Environment mode | development |

## Building for Production

```bash
npm run build
```

This builds both backend and frontend for production deployment.

## Brand Colors

- **Teal**: #017576
- **Purple**: #60489d

## License

Private - Desk2Educate

## Contributing

This is a private project for Desk2Educate. For internal contribution guidelines, contact the development team.
