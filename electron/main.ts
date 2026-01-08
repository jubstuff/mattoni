import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import type { AddressInfo } from 'net';
import {
  getCurrentDatabase,
  switchDatabase,
  closeDatabase,
  createNewDatabase,
  deleteDatabase,
  databaseFileExists,
} from './database-manager.js';
import {
  loadMetadata,
  saveMetadata,
  addBudget,
  removeBudget,
  updateLastAccessed,
  setLastSelectedBudget,
  getBudgetById,
  renameBudget,
  getDataPath,
} from './metadata-manager.js';
import type { BudgetMetadata } from './types.js';

let mainWindow: BrowserWindow | null = null;
let server: ReturnType<typeof express.application.listen> | null = null;

// Migration: Handle existing budget.db from before multi-budget support
function migrateExistingBudget(): void {
  const metadata = loadMetadata();
  const legacyDbPath = path.join(getDataPath(), 'budget.db');

  // Only migrate if no budgets exist and legacy file exists
  if (metadata.budgets.length === 0 && fs.existsSync(legacyDbPath)) {
    const newId = crypto.randomUUID();
    const newFilename = `budget-${newId}.db`;
    const newPath = path.join(getDataPath(), newFilename);

    // Rename old file to new format
    fs.renameSync(legacyDbPath, newPath);

    // Add to metadata
    const migratedBudget: BudgetMetadata = {
      id: newId,
      name: 'My Budget',
      filename: newFilename,
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
    };

    metadata.budgets.push(migratedBudget);
    metadata.lastSelectedBudgetId = newId;
    saveMetadata(metadata);

    console.log('Migrated existing budget.db to new format');
  }
}

// Middleware to require an active database connection
function requireDatabase(req: Request, res: Response, next: NextFunction) {
  if (!getCurrentDatabase()) {
    return res.status(503).json({ error: 'No budget selected' });
  }
  next();
}

function startServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const expressApp = express();

      // Run migration on startup
      migrateExistingBudget();

      expressApp.use(cors());
      expressApp.use(express.json());

      // ============================================
      // Budget Management API (no database required)
      // ============================================

      // Get all budgets and last selected
      expressApp.get('/api/budgets', (_req, res) => {
        const metadata = loadMetadata();
        res.json({
          budgets: metadata.budgets,
          lastSelectedBudgetId: metadata.lastSelectedBudgetId,
        });
      });

      // Create new budget
      expressApp.post('/api/budgets', (req, res) => {
        try {
          const { name } = req.body;

          if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Budget name is required' });
          }

          const budget = addBudget(name.trim());

          // Create and seed the database file
          createNewDatabase(budget.filename, true);

          // Set as last selected
          setLastSelectedBudget(budget.id);

          res.status(201).json(budget);
        } catch (error) {
          console.error('Error creating budget:', error);
          res.status(500).json({ error: 'Failed to create budget' });
        }
      });

      // Select/switch to a budget
      expressApp.post('/api/budgets/:id/select', (req, res) => {
        try {
          const { id } = req.params;
          const budget = getBudgetById(id);

          if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
          }

          // Check if database file exists
          if (!databaseFileExists(budget.filename)) {
            return res.status(404).json({ error: 'Budget file not found' });
          }

          // Switch to this database
          switchDatabase(budget.filename);

          // Update last accessed
          updateLastAccessed(id);

          // Set as last selected
          setLastSelectedBudget(id);

          // Get updated budget info
          const updatedBudget = getBudgetById(id);

          res.json({ success: true, budget: updatedBudget });
        } catch (error) {
          console.error('Error selecting budget:', error);
          res.status(500).json({ error: 'Failed to select budget' });
        }
      });

      // Deselect current budget (return to welcome screen)
      expressApp.post('/api/budgets/deselect', (_req, res) => {
        try {
          closeDatabase();
          setLastSelectedBudget(null);
          res.json({ success: true });
        } catch (error) {
          console.error('Error deselecting budget:', error);
          res.status(500).json({ error: 'Failed to deselect budget' });
        }
      });

      // Get current budget info
      expressApp.get('/api/budgets/current', (_req, res) => {
        const metadata = loadMetadata();
        if (!metadata.lastSelectedBudgetId) {
          return res.json(null);
        }
        const budget = getBudgetById(metadata.lastSelectedBudgetId);
        res.json(budget);
      });

      // Rename a budget
      expressApp.put('/api/budgets/:id', (req, res) => {
        try {
          const { id } = req.params;
          const { name } = req.body;

          if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Budget name is required' });
          }

          const budget = renameBudget(id, name.trim());

          if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
          }

          res.json(budget);
        } catch (error) {
          console.error('Error renaming budget:', error);
          res.status(500).json({ error: 'Failed to rename budget' });
        }
      });

      // Delete a budget
      expressApp.delete('/api/budgets/:id', (req, res) => {
        try {
          const { id } = req.params;
          const budget = getBudgetById(id);

          if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
          }

          // Delete database file
          deleteDatabase(budget.filename);

          // Remove from metadata
          removeBudget(id);

          res.status(204).send();
        } catch (error) {
          console.error('Error deleting budget:', error);
          res.status(500).json({ error: 'Failed to delete budget' });
        }
      });

      // ============================================
      // Data API (requires active database)
      // ============================================

      // Sections - Get all with nested groups and components
      expressApp.get('/api/sections', requireDatabase, (_req, res) => {
        const db = getCurrentDatabase()!;
        const sections = db.prepare(`
          SELECT id, name, type, sort_order
          FROM sections
          ORDER BY sort_order, id
        `).all() as Array<{ id: number; name: string; type: string; sort_order: number }>;

        const groups = db.prepare(`
          SELECT id, section_id, name, sort_order
          FROM groups
          ORDER BY sort_order, id
        `).all() as Array<{ id: number; section_id: number; name: string; sort_order: number }>;

        const components = db.prepare(`
          SELECT id, group_id, name, sort_order
          FROM components
          ORDER BY sort_order, id
        `).all() as Array<{ id: number; group_id: number; name: string; sort_order: number }>;

        // Build nested structure
        const groupsMap = new Map<number, typeof groups>();
        for (const group of groups) {
          if (!groupsMap.has(group.section_id)) {
            groupsMap.set(group.section_id, []);
          }
          groupsMap.get(group.section_id)!.push(group);
        }

        const componentsMap = new Map<number, typeof components>();
        for (const component of components) {
          if (!componentsMap.has(component.group_id)) {
            componentsMap.set(component.group_id, []);
          }
          componentsMap.get(component.group_id)!.push(component);
        }

        const result = sections.map((section) => ({
          ...section,
          groups: (groupsMap.get(section.id) || []).map((group) => ({
            ...group,
            components: componentsMap.get(group.id) || [],
          })),
        }));

        res.json(result);
      });

      expressApp.post('/api/sections', requireDatabase, (req, res) => {
        const db = getCurrentDatabase()!;
        const { name, type, sort_order } = req.body;
        const result = db.prepare('INSERT INTO sections (name, type, sort_order) VALUES (?, ?, ?)').run(name, type, sort_order || 0);
        const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(section);
      });

      expressApp.put('/api/sections/:id', requireDatabase, (req, res) => {
        const db = getCurrentDatabase()!;
        const { id } = req.params;
        const { name, type, sort_order } = req.body;

        const updates: string[] = [];
        const values: (string | number)[] = [];

        if (name !== undefined) {
          updates.push('name = ?');
          values.push(name);
        }
        if (type !== undefined) {
          updates.push('type = ?');
          values.push(type);
        }
        if (sort_order !== undefined) {
          updates.push('sort_order = ?');
          values.push(sort_order);
        }

        if (updates.length > 0) {
          values.push(Number(id));
          db.prepare(`UPDATE sections SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        }

        const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(id);
        res.json(section);
      });

      expressApp.delete('/api/sections/:id', requireDatabase, (req, res) => {
        const db = getCurrentDatabase()!;
        const { id } = req.params;
        db.prepare('DELETE FROM sections WHERE id = ?').run(id);
        res.status(204).send();
      });

      // Groups
      expressApp.get('/api/groups', requireDatabase, (_req, res) => {
        const db = getCurrentDatabase()!;
        const groups = db.prepare('SELECT * FROM groups ORDER BY sort_order, id').all();
        res.json(groups);
      });

      expressApp.post('/api/groups', requireDatabase, (req, res) => {
        const db = getCurrentDatabase()!;
        const { section_id, name, sort_order } = req.body;
        const result = db.prepare('INSERT INTO groups (section_id, name, sort_order) VALUES (?, ?, ?)').run(section_id, name, sort_order || 0);
        const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(group);
      });

      expressApp.put('/api/groups/:id', requireDatabase, (req, res) => {
        const db = getCurrentDatabase()!;
        const { id } = req.params;
        const { section_id, name, sort_order } = req.body;

        const updates: string[] = [];
        const values: (string | number)[] = [];

        if (section_id !== undefined) {
          updates.push('section_id = ?');
          values.push(section_id);
        }
        if (name !== undefined) {
          updates.push('name = ?');
          values.push(name);
        }
        if (sort_order !== undefined) {
          updates.push('sort_order = ?');
          values.push(sort_order);
        }

        if (updates.length > 0) {
          values.push(Number(id));
          db.prepare(`UPDATE groups SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        }

        const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
        res.json(group);
      });

      expressApp.delete('/api/groups/:id', requireDatabase, (req, res) => {
        const db = getCurrentDatabase()!;
        const { id } = req.params;
        db.prepare('DELETE FROM groups WHERE id = ?').run(id);
        res.status(204).send();
      });

      // Batch reorder groups
      expressApp.patch('/api/groups/reorder', requireDatabase, (req, res) => {
        try {
          const db = getCurrentDatabase()!;
          const { updates } = req.body;

          if (!updates || !Array.isArray(updates)) {
            return res.status(400).json({ error: 'updates array is required' });
          }

          const stmt = db.prepare('UPDATE groups SET sort_order = ?, section_id = COALESCE(?, section_id) WHERE id = ?');

          const transaction = db.transaction(() => {
            for (const { id, sort_order, section_id } of updates) {
              stmt.run(sort_order, section_id ?? null, id);
            }
          });

          transaction();
          res.json({ success: true });
        } catch (error) {
          console.error('Error reordering groups:', error);
          res.status(500).json({ error: 'Failed to reorder groups' });
        }
      });

      // Components
      expressApp.get('/api/components', requireDatabase, (_req, res) => {
        const db = getCurrentDatabase()!;
        const components = db.prepare('SELECT * FROM components ORDER BY sort_order, id').all();
        res.json(components);
      });

      expressApp.post('/api/components', requireDatabase, (req, res) => {
        const db = getCurrentDatabase()!;
        const { group_id, name, sort_order } = req.body;
        const result = db.prepare('INSERT INTO components (group_id, name, sort_order) VALUES (?, ?, ?)').run(group_id, name, sort_order || 0);
        const component = db.prepare('SELECT * FROM components WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(component);
      });

      expressApp.put('/api/components/:id', requireDatabase, (req, res) => {
        const db = getCurrentDatabase()!;
        const { id } = req.params;
        const { group_id, name, sort_order } = req.body;

        const updates: string[] = [];
        const values: (string | number)[] = [];

        if (group_id !== undefined) {
          updates.push('group_id = ?');
          values.push(group_id);
        }
        if (name !== undefined) {
          updates.push('name = ?');
          values.push(name);
        }
        if (sort_order !== undefined) {
          updates.push('sort_order = ?');
          values.push(sort_order);
        }

        if (updates.length > 0) {
          values.push(Number(id));
          db.prepare(`UPDATE components SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        }

        const component = db.prepare('SELECT * FROM components WHERE id = ?').get(id);
        res.json(component);
      });

      expressApp.delete('/api/components/:id', requireDatabase, (req, res) => {
        const db = getCurrentDatabase()!;
        const { id } = req.params;
        db.prepare('DELETE FROM components WHERE id = ?').run(id);
        res.status(204).send();
      });

      // Batch reorder components
      expressApp.patch('/api/components/reorder', requireDatabase, (req, res) => {
        try {
          const db = getCurrentDatabase()!;
          const { updates } = req.body;

          if (!updates || !Array.isArray(updates)) {
            return res.status(400).json({ error: 'updates array is required' });
          }

          const stmt = db.prepare('UPDATE components SET sort_order = ? WHERE id = ?');

          const transaction = db.transaction(() => {
            for (const { id, sort_order } of updates) {
              stmt.run(sort_order, id);
            }
          });

          transaction();
          res.json({ success: true });
        } catch (error) {
          console.error('Error reordering components:', error);
          res.status(500).json({ error: 'Failed to reorder components' });
        }
      });

      // Budget values
      expressApp.get('/api/budget/:year', requireDatabase, (req, res) => {
        const db = getCurrentDatabase()!;
        const { year } = req.params;
        const values = db.prepare(`
          SELECT component_id, month, amount
          FROM budget_values
          WHERE year = ?
        `).all(year) as Array<{ component_id: number; month: number; amount: number }>;

        const valuesByComponent: Record<number, Record<number, number>> = {};
        for (const value of values) {
          if (!valuesByComponent[value.component_id]) {
            valuesByComponent[value.component_id] = {};
          }
          valuesByComponent[value.component_id][value.month] = value.amount;
        }
        res.json(valuesByComponent);
      });

      expressApp.put('/api/budget/component/:componentId', requireDatabase, (req, res) => {
        const db = getCurrentDatabase()!;
        const { componentId } = req.params;
        const { year, values } = req.body;

        if (!year || !values || typeof values !== 'object') {
          return res.status(400).json({ error: 'year and values object are required' });
        }

        const component = db.prepare('SELECT id FROM components WHERE id = ?').get(componentId);
        if (!component) {
          return res.status(404).json({ error: 'Component not found' });
        }

        const upsert = db.prepare(`
          INSERT INTO budget_values (component_id, year, month, amount)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(component_id, year, month)
          DO UPDATE SET amount = excluded.amount
        `);

        const transaction = db.transaction(() => {
          for (const [month, amount] of Object.entries(values)) {
            const monthNum = parseInt(month, 10);
            if (monthNum >= 1 && monthNum <= 12) {
              upsert.run(componentId, year, monthNum, amount);
            }
          }
        });

        transaction();
        res.json({ success: true });
      });

      expressApp.get('/api/budget/component/:componentId/:year', requireDatabase, (req, res) => {
        const db = getCurrentDatabase()!;
        const { componentId, year } = req.params;

        const values = db.prepare(`
          SELECT month, amount
          FROM budget_values
          WHERE component_id = ? AND year = ?
        `).all(componentId, year) as Array<{ month: number; amount: number }>;

        const result: Record<number, number> = {};
        for (let month = 1; month <= 12; month++) {
          result[month] = 0;
        }

        for (const value of values) {
          result[value.month] = value.amount;
        }

        res.json(result);
      });

      // Notes
      expressApp.get('/api/notes/:year', requireDatabase, (req, res) => {
        const db = getCurrentDatabase()!;
        const { year } = req.params;
        const notes = db.prepare(`
          SELECT component_id, month, note
          FROM budget_notes
          WHERE year = ?
        `).all(year) as Array<{ component_id: number; month: number; note: string }>;

        const notesByComponent: Record<number, Record<number, string>> = {};
        for (const item of notes) {
          if (!notesByComponent[item.component_id]) {
            notesByComponent[item.component_id] = {};
          }
          notesByComponent[item.component_id][item.month] = item.note;
        }
        res.json(notesByComponent);
      });

      expressApp.put('/api/notes/component/:componentId', requireDatabase, (req, res) => {
        const db = getCurrentDatabase()!;
        const { componentId } = req.params;
        const { year, notes } = req.body;

        if (!year || !notes || typeof notes !== 'object') {
          return res.status(400).json({ error: 'year and notes object are required' });
        }

        const component = db.prepare('SELECT id FROM components WHERE id = ?').get(componentId);
        if (!component) {
          return res.status(404).json({ error: 'Component not found' });
        }

        const upsert = db.prepare(`
          INSERT INTO budget_notes (component_id, year, month, note, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(component_id, year, month)
          DO UPDATE SET note = excluded.note, updated_at = CURRENT_TIMESTAMP
        `);

        const deleteNote = db.prepare(`
          DELETE FROM budget_notes
          WHERE component_id = ? AND year = ? AND month = ?
        `);

        const transaction = db.transaction(() => {
          for (const [month, note] of Object.entries(notes)) {
            const monthNum = parseInt(month, 10);
            if (monthNum >= 1 && monthNum <= 12) {
              if (note && (note as string).trim()) {
                upsert.run(componentId, year, monthNum, (note as string).trim());
              } else {
                deleteNote.run(componentId, year, monthNum);
              }
            }
          }
        });

        transaction();
        res.json({ success: true });
      });

      expressApp.get('/api/notes/component/:componentId/:year', requireDatabase, (req, res) => {
        const db = getCurrentDatabase()!;
        const { componentId, year } = req.params;

        const notes = db.prepare(`
          SELECT month, note
          FROM budget_notes
          WHERE component_id = ? AND year = ?
        `).all(componentId, year) as Array<{ month: number; note: string }>;

        const result: Record<number, string> = {};
        for (const item of notes) {
          result[item.month] = item.note;
        }

        res.json(result);
      });

      // Health check
      expressApp.get('/api/health', (_req, res) => {
        res.json({ status: 'ok', hasBudget: getCurrentDatabase() !== null });
      });

      // Serve static files
      const clientPath = app.isPackaged
        ? path.join(process.resourcesPath, 'client')
        : path.join(__dirname, '..', '..', 'client', 'dist');
      expressApp.use(express.static(clientPath));
      expressApp.get('*', (_req, res) => {
        res.sendFile(path.join(clientPath, 'index.html'));
      });

      server = expressApp.listen(0, () => {
        const actualPort = (server!.address() as AddressInfo).port;
        console.log(`Server running on http://localhost:${actualPort}`);
        resolve(actualPort);
      });

      server.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

function createWindow(port: number): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let serverPort: number;

app.whenReady().then(async () => {
  try {
    serverPort = await startServer();
    createWindow(serverPort);
  } catch (error) {
    console.error('Failed to start server:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null && serverPort) {
    createWindow(serverPort);
  }
});

app.on('before-quit', () => {
  closeDatabase();
  if (server) {
    server.close();
  }
});
