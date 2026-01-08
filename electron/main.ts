import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import type { AddressInfo } from 'net';

let mainWindow: BrowserWindow | null = null;
let server: ReturnType<typeof express.application.listen> | null = null;

// Database setup
function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'budget.db');
}

function initializeDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS budget_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      component_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE,
      UNIQUE(component_id, year, month)
    );

    CREATE TABLE IF NOT EXISTS budget_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      component_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      note TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE,
      UNIQUE(component_id, year, month)
    );
  `);
}

function seedDatabase(db: Database.Database): void {
  const count = db.prepare('SELECT COUNT(*) as count FROM sections').get() as { count: number };
  if (count.count > 0) return;

  // Seed with household finance data
  const insertSection = db.prepare('INSERT INTO sections (name, type, sort_order) VALUES (?, ?, ?)');
  const insertGroup = db.prepare('INSERT INTO groups (section_id, name, sort_order) VALUES (?, ?, ?)');
  const insertComponent = db.prepare('INSERT INTO components (group_id, name, sort_order) VALUES (?, ?, ?)');

  // Income section
  const incomeResult = insertSection.run('Income', 'income', 1);
  const incomeId = incomeResult.lastInsertRowid;

  const employmentGroup = insertGroup.run(incomeId, 'Employment', 1);
  insertComponent.run(employmentGroup.lastInsertRowid, 'Salary', 1);
  insertComponent.run(employmentGroup.lastInsertRowid, 'Bonus', 2);

  const otherIncomeGroup = insertGroup.run(incomeId, 'Other Income', 2);
  insertComponent.run(otherIncomeGroup.lastInsertRowid, 'Side Jobs', 1);
  insertComponent.run(otherIncomeGroup.lastInsertRowid, 'Investments', 2);

  // Expenses section
  const expenseResult = insertSection.run('Expenses', 'expense', 2);
  const expenseId = expenseResult.lastInsertRowid;

  const housingGroup = insertGroup.run(expenseId, 'Housing', 1);
  insertComponent.run(housingGroup.lastInsertRowid, 'Rent/Mortgage', 1);
  insertComponent.run(housingGroup.lastInsertRowid, 'Utilities', 2);
  insertComponent.run(housingGroup.lastInsertRowid, 'Home Insurance', 3);

  const transportGroup = insertGroup.run(expenseId, 'Transportation', 2);
  insertComponent.run(transportGroup.lastInsertRowid, 'Car Payment', 1);
  insertComponent.run(transportGroup.lastInsertRowid, 'Gas', 2);
  insertComponent.run(transportGroup.lastInsertRowid, 'Car Insurance', 3);

  const foodGroup = insertGroup.run(expenseId, 'Food', 3);
  insertComponent.run(foodGroup.lastInsertRowid, 'Groceries', 1);
  insertComponent.run(foodGroup.lastInsertRowid, 'Dining Out', 2);

  const personalGroup = insertGroup.run(expenseId, 'Personal', 4);
  insertComponent.run(personalGroup.lastInsertRowid, 'Subscriptions', 1);
  insertComponent.run(personalGroup.lastInsertRowid, 'Entertainment', 2);
  insertComponent.run(personalGroup.lastInsertRowid, 'Healthcare', 3);
}

function startServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const expressApp = express();
      const db = new Database(getDbPath());

      initializeDatabase(db);
      seedDatabase(db);

      expressApp.use(cors());
      expressApp.use(express.json());

      // API Routes

      // Sections - Get all with nested groups and components
      expressApp.get('/api/sections', (_req, res) => {
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

      expressApp.post('/api/sections', (req, res) => {
        const { name, type, sort_order } = req.body;
        const result = db.prepare('INSERT INTO sections (name, type, sort_order) VALUES (?, ?, ?)').run(name, type, sort_order || 0);
        const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(section);
      });

      expressApp.put('/api/sections/:id', (req, res) => {
        const { id } = req.params;
        const { name, type, sort_order } = req.body;

        // Build dynamic update query for partial updates
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

      expressApp.delete('/api/sections/:id', (req, res) => {
        const { id } = req.params;
        db.prepare('DELETE FROM sections WHERE id = ?').run(id);
        res.status(204).send();
      });

      // Groups
      expressApp.get('/api/groups', (_req, res) => {
        const groups = db.prepare('SELECT * FROM groups ORDER BY sort_order, id').all();
        res.json(groups);
      });

      expressApp.post('/api/groups', (req, res) => {
        const { section_id, name, sort_order } = req.body;
        const result = db.prepare('INSERT INTO groups (section_id, name, sort_order) VALUES (?, ?, ?)').run(section_id, name, sort_order || 0);
        const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(group);
      });

      expressApp.put('/api/groups/:id', (req, res) => {
        const { id } = req.params;
        const { section_id, name, sort_order } = req.body;

        // Build dynamic update query for partial updates
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

      expressApp.delete('/api/groups/:id', (req, res) => {
        const { id } = req.params;
        db.prepare('DELETE FROM groups WHERE id = ?').run(id);
        res.status(204).send();
      });

      // Components
      expressApp.get('/api/components', (_req, res) => {
        const components = db.prepare('SELECT * FROM components ORDER BY sort_order, id').all();
        res.json(components);
      });

      expressApp.post('/api/components', (req, res) => {
        const { group_id, name, sort_order } = req.body;
        const result = db.prepare('INSERT INTO components (group_id, name, sort_order) VALUES (?, ?, ?)').run(group_id, name, sort_order || 0);
        const component = db.prepare('SELECT * FROM components WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(component);
      });

      expressApp.put('/api/components/:id', (req, res) => {
        const { id } = req.params;
        const { group_id, name, sort_order } = req.body;

        // Build dynamic update query for partial updates
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

      expressApp.delete('/api/components/:id', (req, res) => {
        const { id } = req.params;
        db.prepare('DELETE FROM components WHERE id = ?').run(id);
        res.status(204).send();
      });

      // Budget values - Get all for a year (grouped by component)
      expressApp.get('/api/budget/:year', (req, res) => {
        const { year } = req.params;
        const values = db.prepare(`
          SELECT component_id, month, amount
          FROM budget_values
          WHERE year = ?
        `).all(year) as Array<{ component_id: number; month: number; amount: number }>;

        // Group values by component_id
        const valuesByComponent: Record<number, Record<number, number>> = {};
        for (const value of values) {
          if (!valuesByComponent[value.component_id]) {
            valuesByComponent[value.component_id] = {};
          }
          valuesByComponent[value.component_id][value.month] = value.amount;
        }
        res.json(valuesByComponent);
      });

      // Update budget values for a component
      expressApp.put('/api/budget/component/:componentId', (req, res) => {
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

      // Get budget values for a specific component
      expressApp.get('/api/budget/component/:componentId/:year', (req, res) => {
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

      // Notes - Get all for a year (grouped by component)
      expressApp.get('/api/notes/:year', (req, res) => {
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

      // Update notes for a component
      expressApp.put('/api/notes/component/:componentId', (req, res) => {
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

      // Get notes for a specific component
      expressApp.get('/api/notes/component/:componentId/:year', (req, res) => {
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
        res.json({ status: 'ok' });
      });

      // Serve static files - different paths for dev vs production
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
  if (server) {
    server.close();
  }
});
