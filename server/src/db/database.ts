import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/budget.db');

export const db = new Database(dbPath);

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS budget_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
      amount REAL DEFAULT 0,
      UNIQUE(component_id, year, month)
    );
  `);

  db.pragma('foreign_keys = ON');
}

export function seedDatabase() {
  const sectionCount = db.prepare('SELECT COUNT(*) as count FROM sections').get() as { count: number };

  if (sectionCount.count === 0) {
    const insertSection = db.prepare('INSERT INTO sections (name, type, sort_order) VALUES (?, ?, ?)');
    const insertGroup = db.prepare('INSERT INTO groups (section_id, name, sort_order) VALUES (?, ?, ?)');
    const insertComponent = db.prepare('INSERT INTO components (group_id, name, sort_order) VALUES (?, ?, ?)');
    const insertValue = db.prepare('INSERT INTO budget_values (component_id, year, month, amount) VALUES (?, ?, ?, ?)');

    const transaction = db.transaction(() => {
      // Income section
      const incomeResult = insertSection.run('Revenues', 'income', 1);
      const incomeId = incomeResult.lastInsertRowid;

      // Salary group
      const salaryGroupResult = insertGroup.run(incomeId, 'Salary', 1);
      const salaryGroupId = salaryGroupResult.lastInsertRowid;

      const jobResult = insertComponent.run(salaryGroupId, 'Main Job', 1);
      const jobId = jobResult.lastInsertRowid;

      // Add sample values for 2025
      for (let month = 1; month <= 12; month++) {
        insertValue.run(jobId, 2025, month, 3000);
      }

      // Expense section
      const expenseResult = insertSection.run('Costs', 'expense', 2);
      const expenseId = expenseResult.lastInsertRowid;

      // Housing group
      const housingGroupResult = insertGroup.run(expenseId, 'Housing', 1);
      const housingGroupId = housingGroupResult.lastInsertRowid;

      const rentResult = insertComponent.run(housingGroupId, 'Rent', 1);
      const rentId = rentResult.lastInsertRowid;

      const utilitiesResult = insertComponent.run(housingGroupId, 'Utilities', 2);
      const utilitiesId = utilitiesResult.lastInsertRowid;

      // Add sample values for 2025
      for (let month = 1; month <= 12; month++) {
        insertValue.run(rentId, 2025, month, 1200);
        insertValue.run(utilitiesId, 2025, month, 150);
      }
    });

    transaction();
    console.log('Database seeded with sample data');
  }
}
