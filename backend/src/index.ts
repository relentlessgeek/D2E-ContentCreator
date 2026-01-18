import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

import { initializeDatabase, seedDefaultPrompts } from './db';
import promptsRouter from './routes/prompts';
import topicsRouter from './routes/topics';
import lessonsRouter from './routes/lessons';
import standaloneLessonsRouter from './routes/standalone-lessons';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Read version from package.json
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const VERSION = packageJson.version;

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initializeDatabase();
seedDefaultPrompts();

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: VERSION
  });
});

// API Routes
app.use('/api/prompts', promptsRouter);
app.use('/api/topics', topicsRouter);
app.use('/api/lessons', lessonsRouter);
app.use('/api/standalone-lessons', standaloneLessonsRouter);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Content Magic Backend v${VERSION}`);
  console.log(`   Server running at http://localhost:${PORT}`);
  console.log(`📚 API endpoints:`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/prompts`);
  console.log(`   GET  /api/topics`);
  console.log(`   POST /api/topics`);
  console.log(`   GET  /api/standalone-lessons`);
  console.log(`   POST /api/standalone-lessons`);
});
