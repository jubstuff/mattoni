export interface Component {
  id: number;
  group_id: number;
  name: string;
  sort_order: number;
}

export interface Group {
  id: number;
  section_id: number;
  name: string;
  sort_order: number;
  components: Component[];
}

export interface Section {
  id: number;
  name: string;
  type: 'income' | 'expense';
  sort_order: number;
  groups: Group[];
}

export type BudgetValues = Record<number, Record<number, number>>;

export interface MonthlyValues {
  [month: number]: number;
}

// Notes: componentId -> month -> note text
export type Notes = Record<number, Record<number, string>>;

export interface MonthlyNotes {
  [month: number]: string;
}

// Budget file metadata
export interface BudgetMetadata {
  id: string;
  name: string;
  filename: string;
  createdAt: string;
  lastAccessedAt: string;
}

export interface BudgetsResponse {
  budgets: BudgetMetadata[];
  lastSelectedBudgetId: string | null;
}
