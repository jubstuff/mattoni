import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';

let currentDb: Database.Database | null = null;
let currentFilename: string | null = null;

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
      is_disabled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_disabled INTEGER DEFAULT 0,
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

  // Migration: Add is_disabled column to existing tables if not present
  const groupColumns = db.prepare("PRAGMA table_info(groups)").all() as { name: string }[];
  if (!groupColumns.some(col => col.name === 'is_disabled')) {
    db.exec('ALTER TABLE groups ADD COLUMN is_disabled INTEGER DEFAULT 0');
  }

  const componentColumns = db.prepare("PRAGMA table_info(components)").all() as { name: string }[];
  if (!componentColumns.some(col => col.name === 'is_disabled')) {
    db.exec('ALTER TABLE components ADD COLUMN is_disabled INTEGER DEFAULT 0');
  }
}

function seedDatabase(db: Database.Database): void {
  const count = db.prepare('SELECT COUNT(*) as count FROM sections').get() as { count: number };
  if (count.count > 0) return;

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

export function openDatabase(filename: string): Database.Database {
  const dbPath = path.join(app.getPath('userData'), filename);
  const db = new Database(dbPath);
  initializeDatabase(db);
  return db;
}

export function switchDatabase(filename: string): Database.Database {
  closeDatabase();

  currentDb = openDatabase(filename);
  currentFilename = filename;

  return currentDb;
}

export function closeDatabase(): void {
  if (currentDb) {
    currentDb.close();
    currentDb = null;
    currentFilename = null;
  }
}

export function getCurrentDatabase(): Database.Database | null {
  return currentDb;
}

export function getCurrentFilename(): string | null {
  return currentFilename;
}

export function createNewDatabase(filename: string, seed: boolean = true): Database.Database {
  const db = openDatabase(filename);

  if (seed) {
    seedDatabase(db);
  }

  currentDb = db;
  currentFilename = filename;

  return db;
}

export function deleteDatabase(filename: string): void {
  // Close if it's the current database
  if (currentFilename === filename) {
    closeDatabase();
  }

  const dbPath = path.join(app.getPath('userData'), filename);
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
}

export function databaseFileExists(filename: string): boolean {
  const dbPath = path.join(app.getPath('userData'), filename);
  return fs.existsSync(dbPath);
}
