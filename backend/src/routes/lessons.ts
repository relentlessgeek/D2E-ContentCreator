import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import db from '../db';
import { Lesson, Topic } from '../types';

const router = Router();

const CONTENT_DIR = path.join(__dirname, '../../../generated-content');

// GET /api/lessons/:id - Get a single lesson
router.get('/:id', (req: Request, res: Response) => {
  try {
    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id) as Lesson | undefined;

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    res.json(lesson);
  } catch (error) {
    console.error('Error fetching lesson:', error);
    res.status(500).json({ error: 'Failed to fetch lesson' });
  }
});

// GET /api/lessons/:id/content - Get the lesson markdown content
router.get('/:id/content', (req: Request, res: Response) => {
  try {
    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id) as Lesson | undefined;

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
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
    console.error('Error fetching lesson content:', error);
    res.status(500).json({ error: 'Failed to fetch lesson content' });
  }
});

// GET /api/lessons/:id/podcast - Get the podcast summary markdown content
router.get('/:id/podcast', (req: Request, res: Response) => {
  try {
    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id) as Lesson | undefined;

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
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
    console.error('Error fetching podcast content:', error);
    res.status(500).json({ error: 'Failed to fetch podcast content' });
  }
});

export default router;
