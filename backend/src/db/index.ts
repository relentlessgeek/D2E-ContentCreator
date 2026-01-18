import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '../../../data');
const DB_PATH = path.join(DATA_DIR, 'content.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db: DatabaseType = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;

// Initialize database with schema
export function initializeDatabase(): void {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  // Run migrations for existing databases
  runMigrations();

  console.log('Database initialized successfully');
}

// Run any necessary migrations
function runMigrations(): void {
  // Check if lessons table has description column (added in Phase 2)
  const tableInfo = db.prepare("PRAGMA table_info(lessons)").all() as { name: string }[];
  const hasDescription = tableInfo.some(col => col.name === 'description');

  if (!hasDescription) {
    console.log('Running migration: adding description column to lessons table');
    db.exec('ALTER TABLE lessons ADD COLUMN description TEXT');
  }

  // Check if lessons table has retry tracking columns (added in Phase 5)
  const hasRetryCount = tableInfo.some(col => col.name === 'retry_count');
  const hasLastError = tableInfo.some(col => col.name === 'last_error');

  if (!hasRetryCount) {
    console.log('Running migration: adding retry_count column to lessons table');
    db.exec('ALTER TABLE lessons ADD COLUMN retry_count INTEGER DEFAULT 0');
  }

  if (!hasLastError) {
    console.log('Running migration: adding last_error column to lessons table');
    db.exec('ALTER TABLE lessons ADD COLUMN last_error TEXT');
  }

  // Check if topics table has last_error column (added in Phase 5)
  const topicsTableInfo = db.prepare("PRAGMA table_info(topics)").all() as { name: string }[];
  const topicHasLastError = topicsTableInfo.some(col => col.name === 'last_error');

  if (!topicHasLastError) {
    console.log('Running migration: adding last_error column to topics table');
    db.exec('ALTER TABLE topics ADD COLUMN last_error TEXT');
  }
}

// Seed default prompts if they don't exist
export function seedDefaultPrompts(): void {
  const existingPrompts = db.prepare('SELECT COUNT(*) as count FROM prompts').get() as { count: number };

  if (existingPrompts.count === 0) {
    const insertPrompt = db.prepare(`
      INSERT INTO prompts (name, description, template) VALUES (?, ?, ?)
    `);

    const defaultPrompts = [
      {
        name: 'topic_breakdown',
        description: 'Analyzes a topic and breaks it down into 3-12 lessons',
        template: `You are an expert curriculum designer for business and entrepreneurship education.

Given the topic "{{topic}}", analyze its scope and complexity, then break it down into a series of lessons.

Requirements:
- Create between 3 and 12 lessons depending on the topic's complexity
- Each lesson should cover a distinct, focused subtopic
- Lessons should build on each other in a logical progression
- Focus on practical, actionable content for entrepreneurs

Return your response as a JSON object with this exact structure:
{
  "topic_description": "A brief 1-2 sentence description of the overall topic",
  "lessons": [
    {
      "number": 1,
      "title": "Lesson title here",
      "description": "Brief description of what this lesson covers"
    }
  ]
}

Only return the JSON object, no additional text.`
      },
      {
        name: 'lesson_content',
        description: 'Generates the main educational content for a lesson (2700-3300 words)',
        template: `Act as an inclusive learning designer and educator experienced in creating content for neurodiverse learners (including ADHD, autistic, dyslexic, and anxiety-prone audiences).

Topic: {{topic}}
Lesson {{lesson_number}} of {{total_lessons}}: {{lesson_title}}
Lesson Description: {{lesson_description}}

Create a piece of learning material that is compelling, easy to understand, and cognitively accessible about this lesson topic.

CRITICAL WORD COUNT REQUIREMENT:
- MINIMUM: 2700 words (absolutely required - do not go below this)
- TARGET: 3000 words (aim for this)
- MAXIMUM: 3300 words
- This equals approximately 10-12 minutes of reading time
- If you find yourself finishing early, add more examples, case studies, or expand on key concepts

STRUCTURE (approximate word counts per section):
- Introduction: ~300 words - hook the reader, introduce the topic, preview what they'll learn
- Main Section 1: ~500 words - core concept with examples
- Main Section 2: ~500 words - second major concept with practical applications
- Main Section 3: ~500 words - third concept or deeper dive
- Main Section 4: ~400 words - advanced tips or common mistakes
- Case Study/Example: ~400 words - real-world application or detailed scenario
- Key Takeaways: ~200 words - summarize actionable points
- Conclusion: ~200 words - wrap up and inspire action

FORMAT:
- Use Markdown with ## for main headings and ### for subheadings
- Include bullet points and numbered lists where appropriate
- Bold key terms and important concepts

Design the content so it:
- Minimises cognitive load
- Avoids unnecessary jargon or explains it simply
- Uses clear structure, short sections, and predictable patterns
- Supports different learning styles without stereotyping

Structure the content as follows:
- Why this matters – a short, motivating explanation in plain language
- The big idea – the core concept in one or two sentences
- Break it down – step-by-step explanation using simple examples or metaphors
- Key points to remember – concise bullet points
- Common misunderstandings – clarify what people often get wrong
- Try this – a low-pressure practical exercise or reflection
- If you only remember one thing – a single takeaway sentence

Style and tone requirements:
- Calm, supportive, and non-judgemental
- Direct and concrete rather than abstract
- No “hustle”, fear-based, or shaming language
- Use whitespace, bullet points, and headings generously

Accessibility guidelines:
- Short paragraphs (max 3–4 lines)
- Avoid idioms unless explained
- Avoid long lists without grouping
- Include optional depth sections clearly marked as “Optional”
- Focus on providing genuine value and practical knowledge that readers can apply to their businesses.

Write the full article now, ensuring you meet the minimum 2700 word requirement.`
      },
      {
        name: 'podcast_summary',
        description: 'Generates a chatty podcast-style summary (1000-1200 words)',
        template: `Act as an inclusive learning designer and podcast scriptwriter experienced in creating calm, accessible audio content for neurodiverse listeners (including ADHD, autistic, dyslexic, and anxiety-prone audiences).

Topic: {{topic}}
Lesson {{lesson_number}}: {{lesson_title}}

The full lesson content is provided below. Create a podcast script that summarizes the key points.

CRITICAL WORD COUNT REQUIREMENT:
- MINIMUM: 1000 words (absolutely required - do not go below this)
- TARGET: 1100 words (aim for this)
- MAXIMUM: 1200 words
- This equals approximately 8-9 minutes of speaking time at a natural pace
- If you finish early, add more conversational examples or expand on key points

STRUCTURE (approximate word counts):
- Opening hook: ~100 words - grab attention, introduce today's topic
- Main point 1: ~200 words - first key concept, explained conversationally
- Main point 2: ~200 words - second key concept with relatable example
- Main point 3: ~200 words - third concept or practical tip
- Story/Example: ~150 words - a relatable scenario or "imagine this" moment
- Quick recap: ~100 words - summarize the main takeaways
- Call to action: ~50 words - encourage listeners to apply what they learned

Assume the listener may be:
- Distracted or multitasking
- Listening while tired, anxious, or overstimulated
- Dropping in and out of attention

Design the script so it:
- Works even if the listener misses a few sentences
- Repeats key ideas without sounding repetitive
- Uses clear signposting and verbal structure
- Avoids fast pacing, pressure, or performative energy

Script structure:
Gentle opening
-Brief welcome
- Reassurance that there’s no need to concentrate perfectly
- One-sentence description of what this episode is about
Why this matters (spoken)
- Plain-language explanation
- One relatable real-world scenario
The core idea
- Explained slowly and clearly
- Restated once using different wording or a simple metaphor
Break it down
- Short sections introduced with verbal signposts (e.g. “First…”, “Next…”)
- Concrete examples rather than abstract theory
Pause points
- Occasional verbal cues to breathe, reflect, or let the idea land
Common confusions
- Brief clarification of what people often misunderstand
Try this (optional)
- A low-pressure suggestion the listener could try later
- Explicit permission not to do it right now
If you remember one thing
- A single, calm takeaway sentence
Soft close
- Reassurance and encouragement
- Clear statement that it’s okay to stop, rewind, or revisit
Style and delivery guidance:
- Write exactly as it should be spoken
- Short sentences, natural rhythm
- No long monologues or dense explanations
- Avoid rhetorical questions that demand answers
- Avoid hype, urgency, or “you should” language

The script should feel like a friendly conversation while covering the essential learning points.

End with a reminder that the listener can return to this episode whenever they want, and that partial listening still has value.

Write the complete podcast script now, ensuring you meet the minimum 1000 word requirement.

Full lesson content to summarize:
{{lesson_content}}`
      }
    ];

    for (const prompt of defaultPrompts) {
      insertPrompt.run(prompt.name, prompt.description, prompt.template);
    }

    console.log('Default prompts seeded successfully');
  }
}
