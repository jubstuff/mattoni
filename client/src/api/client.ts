import type { Section, BudgetValues, MonthlyValues } from '../types';

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
