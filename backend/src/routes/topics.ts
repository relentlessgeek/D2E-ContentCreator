import { Router, Request, Response } from 'express';
import db from '../db';
import { Topic, Lesson } from '../types';
import {
  breakdownTopic,
  generateAllContent,
  getGenerationStatus,
  retryFailedLessons,
  createSSEProgressCallbacks,
} from '../services/generator';
import { isApiKeyConfigured } from '../services/openai';
import { sseManager } from '../services/sse-manager';

const router = Router();

// Helper to create a URL-friendly slug
function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// GET /api/topics - List all topics
router.get('/', (_req: Request, res: Response) => {
  try {
    const topics = db.prepare('SELECT * FROM topics ORDER BY created_at DESC').all() as Topic[];
    res.json(topics);
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// GET /api/topics/:id - Get a single topic with its lessons
router.get('/:id', (req: Request, res: Response) => {
  try {
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id) as Topic | undefined;

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const lessons = db.prepare(
      'SELECT * FROM lessons WHERE topic_id = ? ORDER BY lesson_number'
    ).all(req.params.id) as Lesson[];

    res.json({ ...topic, lessons });
  } catch (error) {
    console.error('Error fetching topic:', error);
    res.status(500).json({ error: 'Failed to fetch topic' });
  }
});

// POST /api/topics - Create a new topic
router.post('/', (req: Request, res: Response) => {
  try {
    const { title } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const slug = createSlug(title);

    // Check if slug already exists
    const existing = db.prepare('SELECT id FROM topics WHERE slug = ?').get(slug);
    if (existing) {
      return res.status(409).json({ error: 'A topic with a similar title already exists' });
    }

    const result = db.prepare(`
      INSERT INTO topics (title, slug, status) VALUES (?, ?, 'pending')
    `).run(title.trim(), slug);

    const newTopic = db.prepare('SELECT * FROM topics WHERE id = ?').get(result.lastInsertRowid) as Topic;
    res.status(201).json(newTopic);
  } catch (error) {
    console.error('Error creating topic:', error);
    res.status(500).json({ error: 'Failed to create topic' });
  }
});

// DELETE /api/topics/:id - Delete a topic and its lessons
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id) as Topic | undefined;

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Close any SSE connections for this topic
    sseManager.closeTopicConnections(topic.id);

    // Delete lessons first (cascade should handle this, but being explicit)
    db.prepare('DELETE FROM lessons WHERE topic_id = ?').run(req.params.id);
    db.prepare('DELETE FROM topics WHERE id = ?').run(req.params.id);

    // TODO: Also delete generated files from filesystem

    res.json({ message: 'Topic deleted successfully' });
  } catch (error) {
    console.error('Error deleting topic:', error);
    res.status(500).json({ error: 'Failed to delete topic' });
  }
});

// GET /api/topics/:id/stream - SSE endpoint for real-time generation progress
router.get('/:id/stream', (req: Request, res: Response) => {
  try {
    const topicId = parseInt(req.params.id);

    // Check if topic exists
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId) as Topic | undefined;
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Add this connection to the SSE manager
    const connectionId = sseManager.addConnection(topicId, res);

    // Handle client disconnect
    req.on('close', () => {
      console.log(`[SSE] Client disconnected: ${connectionId}`);
      sseManager.removeConnection(connectionId);
    });

    // Send current status immediately
    const status = getGenerationStatus(topicId);
    sseManager.sendToTopic(topicId, {
      type: 'connected',
      data: {
        connectionId,
        topicId,
        currentStatus: status,
      },
    });

  } catch (error) {
    console.error('Error setting up SSE:', error);
    res.status(500).json({ error: 'Failed to set up event stream' });
  }
});

// POST /api/topics/:id/generate - Start content generation
router.post('/:id/generate', async (req: Request, res: Response) => {
  try {
    const topicId = parseInt(req.params.id);

    // Check if API key is configured
    if (!isApiKeyConfigured()) {
      return res.status(400).json({
        error: 'OpenAI API key is not configured. Please add it to your .env file.',
      });
    }

    // Check if topic exists
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId) as Topic | undefined;
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Check if already generating
    if (topic.status === 'generating') {
      return res.status(400).json({ error: 'Generation already in progress' });
    }

    // Check if already completed
    if (topic.status === 'completed') {
      return res.status(400).json({
        error: 'Content already generated. Delete and recreate the topic to regenerate.',
      });
    }

    console.log(`[Topics] Starting generation for topic ${topicId}: ${topic.title}`);

    // Check if we need to do breakdown first or just content generation
    const existingLessons = db.prepare('SELECT COUNT(*) as count FROM lessons WHERE topic_id = ?')
      .get(topicId) as { count: number };

    // Create SSE callbacks for real-time updates
    const sseCallbacks = createSSEProgressCallbacks(topicId);

    let breakdown = null;

    if (existingLessons.count === 0) {
      // Need to breakdown first
      breakdown = await breakdownTopic(topicId, sseCallbacks);
    }

    // Send immediate response that generation has started
    res.json({
      message: 'Content generation started',
      breakdown: breakdown ? {
        description: breakdown.topic_description,
        lessonCount: breakdown.lessons.length,
        lessons: breakdown.lessons,
      } : null,
      status: getGenerationStatus(topicId),
    });

    // Continue generation in background (after response sent)
    // Note: This runs after the response, so errors won't affect the HTTP response
    setImmediate(async () => {
      try {
        await generateAllContent(topicId, sseCallbacks);
        console.log(`[Topics] Background generation complete for topic ${topicId}`);
      } catch (error) {
        console.error(`[Topics] Background generation failed for topic ${topicId}:`, error);
      }
    });

  } catch (error) {
    console.error('Error generating topic:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate content';
    res.status(500).json({ error: message });
  }
});

// POST /api/topics/:id/retry - Retry failed lessons
router.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    const topicId = parseInt(req.params.id);

    // Check if API key is configured
    if (!isApiKeyConfigured()) {
      return res.status(400).json({
        error: 'OpenAI API key is not configured. Please add it to your .env file.',
      });
    }

    // Check if topic exists
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId) as Topic | undefined;
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Check if already generating
    if (topic.status === 'generating') {
      return res.status(400).json({ error: 'Generation already in progress' });
    }

    // Check if there are failed lessons to retry
    const failedLessons = db.prepare(`
      SELECT COUNT(*) as count FROM lessons
      WHERE topic_id = ? AND status IN ('failed', 'pending') AND (retry_count < 3 OR retry_count IS NULL)
    `).get(topicId) as { count: number };

    if (failedLessons.count === 0) {
      return res.status(400).json({
        error: 'No lessons available to retry. All lessons either completed or exceeded retry limit.',
      });
    }

    console.log(`[Topics] Retrying ${failedLessons.count} failed lessons for topic ${topicId}`);

    // Create SSE callbacks for real-time updates
    const sseCallbacks = createSSEProgressCallbacks(topicId);

    // Send immediate response
    res.json({
      message: `Retrying ${failedLessons.count} lesson(s)`,
      lessonsToRetry: failedLessons.count,
      status: getGenerationStatus(topicId),
    });

    // Retry in background
    setImmediate(async () => {
      try {
        const result = await retryFailedLessons(topicId, sseCallbacks);
        console.log(`[Topics] Retry complete for topic ${topicId}:`, result);
      } catch (error) {
        console.error(`[Topics] Retry failed for topic ${topicId}:`, error);
      }
    });

  } catch (error) {
    console.error('Error retrying lessons:', error);
    const message = error instanceof Error ? error.message : 'Failed to retry lessons';
    res.status(500).json({ error: message });
  }
});

// GET /api/topics/:id/status - Get generation status
router.get('/:id/status', (req: Request, res: Response) => {
  try {
    const topicId = parseInt(req.params.id);
    const status = getGenerationStatus(topicId);
    res.json(status);
  } catch (error) {
    console.error('Error getting status:', error);
    const message = error instanceof Error ? error.message : 'Failed to get status';
    res.status(500).json({ error: message });
  }
});

export default router;
