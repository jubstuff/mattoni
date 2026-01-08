import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { AppMetadata, BudgetMetadata } from './types.js';

const METADATA_FILENAME = 'budgets-metadata.json';

function getMetadataPath(): string {
  return path.join(app.getPath('userData'), METADATA_FILENAME);
}

function getDefaultMetadata(): AppMetadata {
  return {
    version: 1,
    lastSelectedBudgetId: null,
    budgets: [],
  };
}

export function loadMetadata(): AppMetadata {
  const metadataPath = getMetadataPath();

  if (!fs.existsSync(metadataPath)) {
    return getDefaultMetadata();
  }

  try {
    const content = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(content) as AppMetadata;
  } catch {
    console.error('Error reading metadata file, returning default');
    return getDefaultMetadata();
  }
}

export function saveMetadata(metadata: AppMetadata): void {
  const metadataPath = getMetadataPath();
  const tempPath = metadataPath + '.tmp';

  // Write to temp file first, then rename for atomic write
  fs.writeFileSync(tempPath, JSON.stringify(metadata, null, 2), 'utf-8');
  fs.renameSync(tempPath, metadataPath);
}

export function addBudget(name: string): BudgetMetadata {
  const metadata = loadMetadata();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const newBudget: BudgetMetadata = {
    id,
    name,
    filename: `budget-${id}.db`,
    createdAt: now,
    lastAccessedAt: now,
  };

  metadata.budgets.push(newBudget);
  saveMetadata(metadata);

  return newBudget;
}

export function removeBudget(id: string): boolean {
  const metadata = loadMetadata();
  const index = metadata.budgets.findIndex((b) => b.id === id);

  if (index === -1) {
    return false;
  }

  const budget = metadata.budgets[index];

  // Delete the database file
  const dbPath = path.join(app.getPath('userData'), budget.filename);
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  // Remove from metadata
  metadata.budgets.splice(index, 1);

  // Clear lastSelectedBudgetId if it was the deleted budget
  if (metadata.lastSelectedBudgetId === id) {
    metadata.lastSelectedBudgetId = null;
  }

  saveMetadata(metadata);
  return true;
}

export function updateLastAccessed(id: string): void {
  const metadata = loadMetadata();
  const budget = metadata.budgets.find((b) => b.id === id);

  if (budget) {
    budget.lastAccessedAt = new Date().toISOString();
    saveMetadata(metadata);
  }
}

export function setLastSelectedBudget(id: string | null): void {
  const metadata = loadMetadata();
  metadata.lastSelectedBudgetId = id;
  saveMetadata(metadata);
}

export function getBudgetById(id: string): BudgetMetadata | null {
  const metadata = loadMetadata();
  return metadata.budgets.find((b) => b.id === id) || null;
}

export function renameBudget(id: string, newName: string): BudgetMetadata | null {
  const metadata = loadMetadata();
  const budget = metadata.budgets.find((b) => b.id === id);

  if (!budget) {
    return null;
  }

  budget.name = newName;
  saveMetadata(metadata);
  return budget;
}

export function getDataPath(): string {
  return app.getPath('userData');
}
