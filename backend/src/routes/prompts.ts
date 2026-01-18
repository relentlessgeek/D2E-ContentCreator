import { Router, Request, Response } from 'express';
import db from '../db';
import { Prompt } from '../types';

const router = Router();

// GET /api/prompts - List all prompts
router.get('/', (_req: Request, res: Response) => {
  try {
    const prompts = db.prepare('SELECT * FROM prompts ORDER BY id').all() as Prompt[];
    res.json(prompts);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// GET /api/prompts/:id - Get a single prompt
router.get('/:id', (req: Request, res: Response) => {
  try {
    const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(req.params.id) as Prompt | undefined;
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    res.json(prompt);
  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

// PUT /api/prompts/:id - Update a prompt
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { template, description } = req.body;

    if (!template) {
      return res.status(400).json({ error: 'Template is required' });
    }

    const result = db.prepare(`
      UPDATE prompts
      SET template = ?, description = COALESCE(?, description), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(template, description, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const updatedPrompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(req.params.id) as Prompt;
    res.json(updatedPrompt);
  } catch (error) {
    console.error('Error updating prompt:', error);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

// POST /api/prompts/:id/reset - Reset a prompt to default (future implementation)
router.post('/:id/reset', (req: Request, res: Response) => {
  // This will be implemented in a later phase
  res.status(501).json({ error: 'Not implemented yet' });
});

export default router;
