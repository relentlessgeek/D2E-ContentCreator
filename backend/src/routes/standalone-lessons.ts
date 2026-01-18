import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import {
  createStandaloneLesson,
  getStandaloneLessons,
  getStandaloneLesson,
  deleteStandaloneLesson,
  generateStandaloneLesson,
} from '../services/generator';

const router = Router();

const CONTENT_DIR = path.join(__dirname, '../../../generated-content');

// GET /api/standalone-lessons - Get all standalone lessons
router.get('/', (_req: Request, res: Response) => {
  try {
    const lessons = getStandaloneLessons();
    res.json(lessons);
  } catch (error) {
    console.error('Error fetching standalone lessons:', error);
    res.status(500).json({ error: 'Failed to fetch standalone lessons' });
  }
});

// POST /api/standalone-lessons - Create a new standalone lesson
router.post('/', (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const lesson = createStandaloneLesson(title.trim(), description?.trim() || '');
    res.status(201).json(lesson);
  } catch (error) {
    console.error('Error creating standalone lesson:', error);
    res.status(500).json({ error: 'Failed to create standalone lesson' });
  }
});

// GET /api/standalone-lessons/:id - Get a single standalone lesson
router.get('/:id', (req: Request, res: Response) => {
  try {
    const lesson = getStandaloneLesson(Number(req.params.id));

    if (!lesson) {
      return res.status(404).json({ error: 'Standalone lesson not found' });
    }

    res.json(lesson);
  } catch (error) {
    console.error('Error fetching standalone lesson:', error);
    res.status(500).json({ error: 'Failed to fetch standalone lesson' });
  }
});

// DELETE /api/standalone-lessons/:id - Delete a standalone lesson
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const lesson = getStandaloneLesson(Number(req.params.id));

    if (!lesson) {
      return res.status(404).json({ error: 'Standalone lesson not found' });
    }

    deleteStandaloneLesson(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting standalone lesson:', error);
    res.status(500).json({ error: 'Failed to delete standalone lesson' });
  }
});

// POST /api/standalone-lessons/:id/generate - Generate content for a standalone lesson
router.post('/:id/generate', async (req: Request, res: Response) => {
  try {
    const lessonId = Number(req.params.id);
    const lesson = getStandaloneLesson(lessonId);

    if (!lesson) {
      return res.status(404).json({ error: 'Standalone lesson not found' });
    }

    if (lesson.status === 'generating') {
      return res.status(409).json({ error: 'Content generation already in progress' });
    }

    // Start generation in background
    generateStandaloneLesson(lessonId).catch(err => {
      console.error(`[API] Background standalone lesson generation failed:`, err);
    });

    // Return immediately with updated status
    const updatedLesson = getStandaloneLesson(lessonId);
    res.json({
      message: 'Content generation started',
      lesson: updatedLesson,
    });
  } catch (error) {
    console.error('Error starting standalone lesson generation:', error);
    res.status(500).json({ error: 'Failed to start content generation' });
  }
});

// GET /api/standalone-lessons/:id/content - Get the lesson markdown content
router.get('/:id/content', (req: Request, res: Response) => {
  try {
    const lesson = getStandaloneLesson(Number(req.params.id));

    if (!lesson) {
      return res.status(404).json({ error: 'Standalone lesson not found' });
    }

    if (!lesson.file_path) {
      return res.status(404).json({ error: 'Lesson content not yet generated' });
    }

    const filePath = path.join(CONTENT_DIR, lesson.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Lesson file not found' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content, word_count: lesson.word_count });
  } catch (error) {
    console.error('Error fetching standalone lesson content:', error);
    res.status(500).json({ error: 'Failed to fetch lesson content' });
  }
});

// GET /api/standalone-lessons/:id/podcast - Get the podcast markdown content
router.get('/:id/podcast', (req: Request, res: Response) => {
  try {
    const lesson = getStandaloneLesson(Number(req.params.id));

    if (!lesson) {
      return res.status(404).json({ error: 'Standalone lesson not found' });
    }

    if (!lesson.podcast_file_path) {
      return res.status(404).json({ error: 'Podcast content not yet generated' });
    }

    const filePath = path.join(CONTENT_DIR, lesson.podcast_file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Podcast file not found' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content, word_count: lesson.podcast_word_count });
  } catch (error) {
    console.error('Error fetching standalone podcast content:', error);
    res.status(500).json({ error: 'Failed to fetch podcast content' });
  }
});

export default router;
