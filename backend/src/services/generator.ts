import path from 'path';
import fs from 'fs';
import db from '../db';
import { Topic, Lesson, TopicBreakdown } from '../types';
import { callOpenAI, parseJsonResponse, isApiKeyConfigured, countWords, categorizeError } from './openai';
import { sseManager } from './sse-manager';

const CONTENT_DIR = path.join(__dirname, '../../../generated-content');
const MAX_LESSON_RETRIES = 3;

// Ensure content directory exists
function ensureContentDir(topicSlug: string): string {
  const topicDir = path.join(CONTENT_DIR, topicSlug);
  if (!fs.existsSync(topicDir)) {
    fs.mkdirSync(topicDir, { recursive: true });
  }
  return topicDir;
}

// Progress callback type for SSE updates
export interface GenerationProgressCallback {
  onBreakdownStart?: () => void;
  onBreakdownComplete?: (lessonCount: number) => void;
  onLessonStart?: (lessonNumber: number, lessonTitle: string, step: 'content' | 'podcast') => void;
  onLessonContentComplete?: (lessonNumber: number, wordCount: number) => void;
  onLessonPodcastComplete?: (lessonNumber: number, wordCount: number) => void;
  onLessonComplete?: (lessonNumber: number) => void;
  onLessonError?: (lessonNumber: number, step: 'content' | 'podcast', error: string, isRetryable: boolean) => void;
  onGenerationComplete?: (totalLessons: number) => void;
  onGenerationError?: (error: string, isRetryable: boolean) => void;
}

// Create SSE-based progress callbacks
export function createSSEProgressCallbacks(topicId: number): GenerationProgressCallback {
  return {
    onBreakdownStart: () => {
      sseManager.sendToTopic(topicId, {
        type: 'breakdown_start',
        data: { topicId },
      });
    },
    onBreakdownComplete: (lessonCount: number) => {
      sseManager.sendToTopic(topicId, {
        type: 'breakdown_complete',
        data: { topicId, lessonCount },
      });
    },
    onLessonStart: (lessonNumber: number, lessonTitle: string, step: 'content' | 'podcast') => {
      sseManager.sendToTopic(topicId, {
        type: 'lesson_start',
        data: { topicId, lessonNumber, lessonTitle, step },
      });
    },
    onLessonContentComplete: (lessonNumber: number, wordCount: number) => {
      sseManager.sendToTopic(topicId, {
        type: 'lesson_content_complete',
        data: { topicId, lessonNumber, wordCount },
      });
    },
    onLessonPodcastComplete: (lessonNumber: number, wordCount: number) => {
      sseManager.sendToTopic(topicId, {
        type: 'lesson_podcast_complete',
        data: { topicId, lessonNumber, wordCount },
      });
    },
    onLessonComplete: (lessonNumber: number) => {
      sseManager.sendToTopic(topicId, {
        type: 'lesson_complete',
        data: { topicId, lessonNumber },
      });
    },
    onLessonError: (lessonNumber: number, step: 'content' | 'podcast', error: string, isRetryable: boolean) => {
      sseManager.sendToTopic(topicId, {
        type: 'lesson_error',
        data: { topicId, lessonNumber, step, error, isRetryable },
      });
    },
    onGenerationComplete: (totalLessons: number) => {
      sseManager.sendToTopic(topicId, {
        type: 'generation_complete',
        data: { topicId, totalLessons, success: true },
      });
    },
    onGenerationError: (error: string, isRetryable: boolean) => {
      sseManager.sendToTopic(topicId, {
        type: 'generation_error',
        data: { topicId, error, isRetryable },
      });
    },
  };
}

// Break down a topic into lessons
export async function breakdownTopic(
  topicId: number,
  callbacks?: GenerationProgressCallback
): Promise<TopicBreakdown> {
  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId) as Topic | undefined;

  if (!topic) {
    throw new Error('Topic not found');
  }

  if (!isApiKeyConfigured()) {
    throw new Error('OpenAI API key is not configured. Please add it to your .env file.');
  }

  // Update topic status to generating
  db.prepare('UPDATE topics SET status = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('generating', topicId);

  callbacks?.onBreakdownStart?.();

  try {
    const response = await callOpenAI(
      'topic_breakdown',
      { topic: topic.title },
      { jsonResponse: true, temperature: 0.7 }
    );

    const breakdown = parseJsonResponse<TopicBreakdown>(response);

    if (!breakdown.lessons || !Array.isArray(breakdown.lessons)) {
      throw new Error('Invalid response: missing lessons array');
    }

    if (breakdown.lessons.length < 3 || breakdown.lessons.length > 12) {
      console.warn(`[Generator] Got ${breakdown.lessons.length} lessons, expected 3-12`);
    }

    // Update topic with description and lesson count
    db.prepare(`
      UPDATE topics
      SET description = ?, lesson_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(breakdown.topic_description, breakdown.lessons.length, topicId);

    // Create lesson records with descriptions
    const insertLesson = db.prepare(`
      INSERT INTO lessons (topic_id, lesson_number, title, description, status, retry_count)
      VALUES (?, ?, ?, ?, 'pending', 0)
    `);

    for (const lesson of breakdown.lessons) {
      insertLesson.run(topicId, lesson.number, lesson.title, lesson.description);
    }

    console.log(`[Generator] Created ${breakdown.lessons.length} lessons for topic ${topicId}`);

    callbacks?.onBreakdownComplete?.(breakdown.lessons.length);

    return breakdown;
  } catch (error) {
    const errorInfo = categorizeError(error);
    db.prepare('UPDATE topics SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('failed', errorInfo.message, topicId);
    callbacks?.onGenerationError?.(errorInfo.message, errorInfo.isRetryable);
    throw error;
  }
}

// Expand content that is too short
async function expandContent(
  existingContent: string,
  currentWordCount: number,
  targetMinWords: number,
  contentType: 'lesson' | 'podcast',
  context: { topic: string; lessonTitle: string }
): Promise<string> {
  const wordsNeeded = targetMinWords - currentWordCount + 100; // Add buffer

  const expansionPrompt = `You are expanding educational content that is currently too short.

CURRENT CONTENT (${currentWordCount} words):
${existingContent}

REQUIREMENTS:
- The content needs to be at least ${targetMinWords} words (currently ${currentWordCount} words short by ${targetMinWords - currentWordCount} words)
- Add approximately ${wordsNeeded} more words of valuable content
- Topic: ${context.topic}
- Lesson: ${context.lessonTitle}

INSTRUCTIONS:
1. Keep ALL existing content exactly as written
2. Expand sections that could use more depth, examples, or explanation
3. Add new subsections if appropriate
4. Include more practical examples, case studies, or actionable advice
5. Maintain the same writing style and tone
6. Do NOT add filler or repetitive content - all additions should be valuable

Return the COMPLETE expanded content (original + additions), properly formatted in markdown.`;

  console.log(`[Generator] Expanding ${contentType} content: ${currentWordCount} -> ${targetMinWords}+ words`);

  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: expansionPrompt }],
    max_tokens: 8192,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || existingContent;
}

// Generate content for a single lesson
async function generateLessonContent(
  topic: Topic,
  lesson: Lesson,
  totalLessons: number,
  maxRetries: number = 2
): Promise<{ content: string; wordCount: number }> {
  const minWords = 2700;
  const maxWords = 3300;

  // First attempt - generate fresh content
  console.log(`[Generator] Generating content for lesson ${lesson.lesson_number} (attempt 1)`);

  let content = await callOpenAI(
    'lesson_content',
    {
      topic: topic.title,
      lesson_number: lesson.lesson_number,
      total_lessons: totalLessons,
      lesson_title: lesson.title,
      lesson_description: lesson.description || '',
    },
    { maxTokens: 8192, temperature: 0.7 }
  );

  let wordCount = countWords(content);
  console.log(`[Generator] Lesson ${lesson.lesson_number} content: ${wordCount} words`);

  // If content is within range, return it
  if (wordCount >= minWords && wordCount <= maxWords) {
    return { content, wordCount };
  }

  // If too short, try expansion approach
  if (wordCount < minWords) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[Generator] Content too short (${wordCount}/${minWords}), expanding (attempt ${attempt + 1})`);

      content = await expandContent(
        content,
        wordCount,
        minWords,
        'lesson',
        { topic: topic.title, lessonTitle: lesson.title }
      );

      wordCount = countWords(content);
      console.log(`[Generator] After expansion: ${wordCount} words`);

      if (wordCount >= minWords) {
        return { content, wordCount };
      }
    }
  }

  // If too long, we accept it (better too long than too short)
  if (wordCount > maxWords) {
    console.log(`[Generator] Content slightly over max (${wordCount}/${maxWords}), accepting`);
    return { content, wordCount };
  }

  console.warn(`[Generator] Accepting content with ${wordCount} words after retries`);
  return { content, wordCount };
}

// Generate podcast summary for a lesson
async function generatePodcastSummary(
  topic: Topic,
  lesson: Lesson,
  lessonContent: string,
  maxRetries: number = 2
): Promise<{ content: string; wordCount: number }> {
  const minWords = 1000;
  const maxWords = 1200;

  // First attempt - generate fresh content
  console.log(`[Generator] Generating podcast for lesson ${lesson.lesson_number} (attempt 1)`);

  let content = await callOpenAI(
    'podcast_summary',
    {
      topic: topic.title,
      lesson_number: lesson.lesson_number,
      lesson_title: lesson.title,
      lesson_content: lessonContent,
    },
    { maxTokens: 2048, temperature: 0.8 }
  );

  let wordCount = countWords(content);
  console.log(`[Generator] Lesson ${lesson.lesson_number} podcast: ${wordCount} words`);

  // If content is within range, return it
  if (wordCount >= minWords && wordCount <= maxWords) {
    return { content, wordCount };
  }

  // If too short, try expansion approach
  if (wordCount < minWords) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[Generator] Podcast too short (${wordCount}/${minWords}), expanding (attempt ${attempt + 1})`);

      content = await expandContent(
        content,
        wordCount,
        minWords,
        'podcast',
        { topic: topic.title, lessonTitle: lesson.title }
      );

      wordCount = countWords(content);
      console.log(`[Generator] After expansion: ${wordCount} words`);

      if (wordCount >= minWords) {
        return { content, wordCount };
      }
    }
  }

  // If too long, we accept it (better too long than too short)
  if (wordCount > maxWords) {
    console.log(`[Generator] Podcast slightly over max (${wordCount}/${maxWords}), accepting`);
    return { content, wordCount };
  }

  console.warn(`[Generator] Accepting podcast with ${wordCount} words after retries`);
  return { content, wordCount };
}

// Generate content for a single lesson with error tracking
async function generateSingleLesson(
  topic: Topic,
  lesson: Lesson,
  totalLessons: number,
  topicDir: string,
  callbacks?: GenerationProgressCallback
): Promise<boolean> {
  try {
    // Mark lesson as generating
    db.prepare('UPDATE lessons SET status = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('generating', lesson.id);

    callbacks?.onLessonStart?.(lesson.lesson_number, lesson.title, 'content');

    // Generate lesson content
    const { content: lessonContent, wordCount: lessonWordCount } = await generateLessonContent(
      topic,
      lesson,
      totalLessons
    );

    // Save lesson content to file
    const lessonFileName = `lesson-${String(lesson.lesson_number).padStart(2, '0')}.md`;
    const lessonFilePath = path.join(topicDir, lessonFileName);
    fs.writeFileSync(lessonFilePath, lessonContent, 'utf-8');

    // Update lesson with file path and word count
    db.prepare(`
      UPDATE lessons
      SET file_path = ?, word_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(`${topic.slug}/${lessonFileName}`, lessonWordCount, lesson.id);

    callbacks?.onLessonContentComplete?.(lesson.lesson_number, lessonWordCount);
    callbacks?.onLessonStart?.(lesson.lesson_number, lesson.title, 'podcast');

    // Generate podcast summary
    const { content: podcastContent, wordCount: podcastWordCount } = await generatePodcastSummary(
      topic,
      lesson,
      lessonContent
    );

    // Save podcast content to file
    const podcastFileName = `lesson-${String(lesson.lesson_number).padStart(2, '0')}-podcast.md`;
    const podcastFilePath = path.join(topicDir, podcastFileName);
    fs.writeFileSync(podcastFilePath, podcastContent, 'utf-8');

    // Update lesson with podcast file path, word count, and mark as completed
    db.prepare(`
      UPDATE lessons
      SET podcast_file_path = ?, podcast_word_count = ?, status = 'completed', last_error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(`${topic.slug}/${podcastFileName}`, podcastWordCount, lesson.id);

    callbacks?.onLessonPodcastComplete?.(lesson.lesson_number, podcastWordCount);
    callbacks?.onLessonComplete?.(lesson.lesson_number);

    console.log(`[Generator] Completed lesson ${lesson.lesson_number}/${totalLessons}`);
    return true;
  } catch (error) {
    const errorInfo = categorizeError(error);
    const currentRetryCount = (lesson.retry_count || 0) + 1;

    // Update lesson with error info
    db.prepare(`
      UPDATE lessons
      SET status = 'failed', last_error = ?, retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(errorInfo.message, currentRetryCount, lesson.id);

    const step = lesson.file_path ? 'podcast' : 'content';
    callbacks?.onLessonError?.(lesson.lesson_number, step, errorInfo.message, errorInfo.isRetryable);

    console.error(`[Generator] Failed lesson ${lesson.lesson_number}: ${errorInfo.message}`);
    return false;
  }
}

// Generate all content for a topic (sequential)
export async function generateAllContent(
  topicId: number,
  callbacks?: GenerationProgressCallback,
  onProgress?: (lessonNumber: number, step: 'content' | 'podcast', totalLessons: number) => void
): Promise<void> {
  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId) as Topic | undefined;

  if (!topic) {
    throw new Error('Topic not found');
  }

  const lessons = db.prepare(
    'SELECT * FROM lessons WHERE topic_id = ? ORDER BY lesson_number'
  ).all(topicId) as Lesson[];

  if (lessons.length === 0) {
    throw new Error('No lessons found. Run topic breakdown first.');
  }

  // Ensure content directory exists
  const topicDir = ensureContentDir(topic.slug);

  console.log(`[Generator] Starting content generation for ${lessons.length} lessons`);

  try {
    let failedCount = 0;

    for (const lesson of lessons) {
      // Skip already completed lessons
      if (lesson.status === 'completed') {
        console.log(`[Generator] Skipping completed lesson ${lesson.lesson_number}`);
        continue;
      }

      // Check if lesson has exceeded retry limit
      if ((lesson.retry_count || 0) >= MAX_LESSON_RETRIES) {
        console.log(`[Generator] Skipping lesson ${lesson.lesson_number} - max retries exceeded`);
        failedCount++;
        continue;
      }

      // Legacy callback support
      onProgress?.(lesson.lesson_number, 'content', lessons.length);

      const success = await generateSingleLesson(topic, lesson, lessons.length, topicDir, callbacks);

      if (!success) {
        failedCount++;
      }
    }

    // Check final status
    const finalLessons = db.prepare(
      'SELECT * FROM lessons WHERE topic_id = ? ORDER BY lesson_number'
    ).all(topicId) as Lesson[];

    const completedCount = finalLessons.filter(l => l.status === 'completed').length;
    const allCompleted = completedCount === finalLessons.length;

    if (allCompleted) {
      // Mark topic as completed
      db.prepare('UPDATE topics SET status = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('completed', topicId);

      callbacks?.onGenerationComplete?.(lessons.length);
      console.log(`[Generator] All content generation complete for topic ${topicId}`);
    } else {
      // Mark topic as failed but preserve completed lessons
      const errorMsg = `${failedCount} lesson(s) failed to generate. ${completedCount}/${finalLessons.length} completed.`;
      db.prepare('UPDATE topics SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('failed', errorMsg, topicId);

      callbacks?.onGenerationError?.(errorMsg, true);
      console.log(`[Generator] Generation partially failed for topic ${topicId}: ${errorMsg}`);
    }
  } catch (error) {
    const errorInfo = categorizeError(error);

    // Mark topic as failed but preserve completed lessons
    db.prepare('UPDATE topics SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('failed', errorInfo.message, topicId);

    // Mark any generating lessons as failed
    db.prepare(`
      UPDATE lessons SET status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP
      WHERE topic_id = ? AND status = 'generating'
    `).run(errorInfo.message, topicId);

    callbacks?.onGenerationError?.(errorInfo.message, errorInfo.isRetryable);

    throw error;
  }
}

// Retry failed lessons for a topic
export async function retryFailedLessons(
  topicId: number,
  callbacks?: GenerationProgressCallback
): Promise<{ retried: number; succeeded: number; failed: number }> {
  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId) as Topic | undefined;

  if (!topic) {
    throw new Error('Topic not found');
  }

  // Get only failed or pending lessons that haven't exceeded retry limit
  const lessons = db.prepare(`
    SELECT * FROM lessons
    WHERE topic_id = ? AND status IN ('failed', 'pending') AND (retry_count < ? OR retry_count IS NULL)
    ORDER BY lesson_number
  `).all(topicId, MAX_LESSON_RETRIES) as Lesson[];

  if (lessons.length === 0) {
    return { retried: 0, succeeded: 0, failed: 0 };
  }

  // Update topic status to generating
  db.prepare('UPDATE topics SET status = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('generating', topicId);

  const topicDir = ensureContentDir(topic.slug);
  const allLessons = db.prepare(
    'SELECT * FROM lessons WHERE topic_id = ? ORDER BY lesson_number'
  ).all(topicId) as Lesson[];

  let succeeded = 0;
  let failed = 0;

  for (const lesson of lessons) {
    const success = await generateSingleLesson(topic, lesson, allLessons.length, topicDir, callbacks);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  // Check final status
  const finalLessons = db.prepare(
    'SELECT * FROM lessons WHERE topic_id = ? ORDER BY lesson_number'
  ).all(topicId) as Lesson[];

  const completedCount = finalLessons.filter(l => l.status === 'completed').length;
  const allCompleted = completedCount === finalLessons.length;

  if (allCompleted) {
    db.prepare('UPDATE topics SET status = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('completed', topicId);
    callbacks?.onGenerationComplete?.(finalLessons.length);
  } else {
    const failedLessons = finalLessons.filter(l => l.status === 'failed').length;
    const errorMsg = `${failedLessons} lesson(s) still failed. ${completedCount}/${finalLessons.length} completed.`;
    db.prepare('UPDATE topics SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('failed', errorMsg, topicId);
    callbacks?.onGenerationError?.(errorMsg, true);
  }

  return { retried: lessons.length, succeeded, failed };
}

// Get generation status for a topic
export function getGenerationStatus(topicId: number): {
  topic: Topic;
  lessons: Lesson[];
  progress: {
    total: number;
    completed: number;
    failed: number;
    current: number | null;
    step: 'breakdown' | 'content' | 'podcast' | 'complete';
  };
} {
  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId) as Topic | undefined;

  if (!topic) {
    throw new Error('Topic not found');
  }

  const lessons = db.prepare(
    'SELECT * FROM lessons WHERE topic_id = ? ORDER BY lesson_number'
  ).all(topicId) as Lesson[];

  const completedLessons = lessons.filter(l => l.status === 'completed').length;
  const failedLessons = lessons.filter(l => l.status === 'failed').length;
  const currentLesson = lessons.find(l => l.status === 'generating');

  let step: 'breakdown' | 'content' | 'podcast' | 'complete' = 'breakdown';
  if (lessons.length > 0) {
    if (completedLessons === lessons.length) {
      step = 'complete';
    } else if (currentLesson) {
      step = currentLesson.file_path ? 'podcast' : 'content';
    } else {
      step = 'content';
    }
  }

  return {
    topic,
    lessons,
    progress: {
      total: lessons.length,
      completed: completedLessons,
      failed: failedLessons,
      current: currentLesson?.lesson_number || null,
      step,
    },
  };
}
