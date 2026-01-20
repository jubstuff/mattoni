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

    CREATE TABLE IF NOT EXISTS budget_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
      note TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(component_id, year, month)
    );

    CREATE TABLE IF NOT EXISTS actual_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
      amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(component_id, year, month)
    );

    CREATE TABLE IF NOT EXISTS actuals_cutoff_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cutoff_year INTEGER NOT NULL,
      cutoff_month INTEGER NOT NULL CHECK(cutoff_month BETWEEN 1 AND 12),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cashflow_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      starting_balance REAL DEFAULT 0,
      starting_year INTEGER NOT NULL,
      starting_month INTEGER NOT NULL CHECK(starting_month BETWEEN 1 AND 12),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    const transaction = db.transaction(() => {
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
    });

    transaction();
    console.log('Database seeded with sample data');
  }
}
