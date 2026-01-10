import type { Section, BudgetValues, MonthlyValues, Notes, MonthlyNotes, BudgetMetadata, BudgetsResponse, CashflowSettings } from '../types';

const API_BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Sections
export async function getSections(): Promise<Section[]> {
  return fetchJSON<Section[]>('/sections');
}

export async function createSection(name: string, type: 'income' | 'expense'): Promise<Section> {
  return fetchJSON<Section>('/sections', {
    method: 'POST',
    body: JSON.stringify({ name, type }),
  });
}

export async function updateSection(id: number, name: string): Promise<Section> {
  return fetchJSON<Section>(`/sections/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function deleteSection(id: number): Promise<void> {
  return fetchJSON<void>(`/sections/${id}`, {
    method: 'DELETE',
  });
}

// Groups
export async function createGroup(sectionId: number, name: string): Promise<{ id: number; section_id: number; name: string }> {
  return fetchJSON(`/groups`, {
    method: 'POST',
    body: JSON.stringify({ section_id: sectionId, name }),
  });
}

export async function updateGroup(id: number, name: string): Promise<void> {
  return fetchJSON(`/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function deleteGroup(id: number): Promise<void> {
  return fetchJSON<void>(`/groups/${id}`, {
    method: 'DELETE',
  });
}

export async function reorderGroups(updates: Array<{ id: number; sort_order: number; section_id?: number }>): Promise<void> {
  return fetchJSON(`/groups/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ updates }),
  });
}

// Components
export async function createComponent(groupId: number, name: string): Promise<{ id: number; group_id: number; name: string }> {
  return fetchJSON(`/components`, {
    method: 'POST',
    body: JSON.stringify({ group_id: groupId, name }),
  });
}

export async function updateComponent(id: number, name: string): Promise<void> {
  return fetchJSON(`/components/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function deleteComponent(id: number): Promise<void> {
  return fetchJSON<void>(`/components/${id}`, {
    method: 'DELETE',
  });
}

export async function reorderComponents(updates: Array<{ id: number; sort_order: number; group_id?: number }>): Promise<void> {
  return fetchJSON(`/components/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ updates }),
  });
}

export async function toggleComponentDisabled(id: number): Promise<{ is_disabled: boolean }> {
  return fetchJSON(`/components/${id}/toggle-disabled`, {
    method: 'PATCH',
  });
}

export async function toggleGroupDisabled(id: number): Promise<{ is_disabled: boolean }> {
  return fetchJSON(`/groups/${id}/toggle-disabled`, {
    method: 'PATCH',
  });
}

// Budget Values
export async function getBudgetValues(year: number): Promise<BudgetValues> {
  return fetchJSON<BudgetValues>(`/budget/${year}`);
}

export async function updateBudgetValues(componentId: number, year: number, values: MonthlyValues): Promise<void> {
  return fetchJSON(`/budget/component/${componentId}`, {
    method: 'PUT',
    body: JSON.stringify({ year, values }),
  });
}

export async function getComponentBudgetValues(componentId: number, year: number): Promise<MonthlyValues> {
  return fetchJSON<MonthlyValues>(`/budget/component/${componentId}/${year}`);
}

// Notes
export async function getNotes(year: number): Promise<Notes> {
  return fetchJSON<Notes>(`/notes/${year}`);
}

export async function updateNotes(componentId: number, year: number, notes: MonthlyNotes): Promise<void> {
  return fetchJSON(`/notes/component/${componentId}`, {
    method: 'PUT',
    body: JSON.stringify({ year, notes }),
  });
}

export async function getComponentNotes(componentId: number, year: number): Promise<MonthlyNotes> {
  return fetchJSON<MonthlyNotes>(`/notes/component/${componentId}/${year}`);
}

// Budgets (file management)
export async function getBudgets(): Promise<BudgetsResponse> {
  return fetchJSON<BudgetsResponse>('/budgets');
}

export async function createBudget(name: string): Promise<BudgetMetadata> {
  return fetchJSON<BudgetMetadata>('/budgets', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function selectBudget(id: string): Promise<{ success: boolean; budget: BudgetMetadata }> {
  return fetchJSON(`/budgets/${id}/select`, {
    method: 'POST',
  });
}

export async function deselectBudget(): Promise<void> {
  return fetchJSON('/budgets/deselect', {
    method: 'POST',
  });
}

export async function renameBudget(id: string, name: string): Promise<BudgetMetadata> {
  return fetchJSON<BudgetMetadata>(`/budgets/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function deleteBudget(id: string): Promise<void> {
  return fetchJSON<void>(`/budgets/${id}`, {
    method: 'DELETE',
  });
}

// Cashflow Settings
export async function getCashflowSettings(): Promise<CashflowSettings> {
  return fetchJSON<CashflowSettings>('/cashflow-settings');
}

export async function updateCashflowSettings(settings: CashflowSettings): Promise<void> {
  return fetchJSON('/cashflow-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}
