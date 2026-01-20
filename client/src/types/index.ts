export interface Component {
  id: number;
  group_id: number;
  name: string;
  sort_order: number;
  is_disabled: boolean;
}

export interface Group {
  id: number;
  section_id: number;
  name: string;
  sort_order: number;
  is_disabled: boolean;
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

// Cashflow settings
export interface CashflowSettings {
  starting_balance: number;
  starting_year: number;
  starting_month: number;
}

// Actuals cutoff settings
export interface ActualsCutoffSettings {
  cutoff_year: number;
  cutoff_month: number;
}
