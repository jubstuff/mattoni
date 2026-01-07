import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, seedDatabase } from './db/database.js';
import sectionsRouter from './routes/sections.js';
import groupsRouter from './routes/groups.js';
import componentsRouter from './routes/components.js';
import budgetRouter from './routes/budget.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize database
initializeDatabase();
seedDatabase();

// API Routes
app.use('/api/sections', sectionsRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/components', componentsRouter);
app.use('/api/budget', budgetRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientPath));

  // Handle client-side routing
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
