import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

import { initializeDatabase, seedDefaultPrompts } from './db';
import promptsRouter from './routes/prompts';
import topicsRouter from './routes/topics';
import lessonsRouter from './routes/lessons';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

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
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/prompts', promptsRouter);
app.use('/api/topics', topicsRouter);
app.use('/api/lessons', lessonsRouter);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running at http://localhost:${PORT}`);
  console.log(`📚 API endpoints:`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/prompts`);
  console.log(`   GET  /api/topics`);
  console.log(`   POST /api/topics`);
});
