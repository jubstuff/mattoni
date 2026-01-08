export interface BudgetMetadata {
  id: string;
  name: string;
  filename: string;
  createdAt: string;
  lastAccessedAt: string;
}

export interface AppMetadata {
  version: number;
  lastSelectedBudgetId: string | null;
  budgets: BudgetMetadata[];
}
