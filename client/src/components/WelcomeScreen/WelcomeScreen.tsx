import { useState, useEffect } from 'react';
import type { BudgetMetadata } from '../../types';
import { getBudgets, createBudget, deleteBudget, selectBudget } from '../../api/client';
import './WelcomeScreen.css';

interface WelcomeScreenProps {
  onBudgetSelect: (budget: BudgetMetadata) => void;
}

export function WelcomeScreen({ onBudgetSelect }: WelcomeScreenProps) {
  const [budgets, setBudgets] = useState<BudgetMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBudgetName, setNewBudgetName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadBudgets();
  }, []);

  async function loadBudgets() {
    try {
      setLoading(true);
      const response = await getBudgets();
      // Sort by last accessed, most recent first
      const sorted = [...response.budgets].sort(
        (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
      );
      setBudgets(sorted);
      setError(null);
    } catch (err) {
      setError('Failed to load budgets');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBudget() {
    if (!newBudgetName.trim()) return;

    try {
      setCreating(true);
      const budget = await createBudget(newBudgetName.trim());
      // After creating, select it
      await selectBudget(budget.id);
      onBudgetSelect(budget);
    } catch (err) {
      setError('Failed to create budget');
      console.error(err);
    } finally {
      setCreating(false);
      setShowCreateModal(false);
      setNewBudgetName('');
    }
  }

  async function handleSelectBudget(budget: BudgetMetadata) {
    try {
      await selectBudget(budget.id);
      onBudgetSelect(budget);
    } catch (err) {
      setError('Failed to open budget');
      console.error(err);
    }
  }

  async function handleDeleteBudget(e: React.MouseEvent, id: string) {
    e.stopPropagation();

    const budget = budgets.find((b) => b.id === id);
    if (!budget) return;

    if (!confirm(`Are you sure you want to delete "${budget.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(id);
      await deleteBudget(id);
      setBudgets((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      setError('Failed to delete budget');
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  if (loading) {
    return (
      <div className="welcome-screen">
        <div className="welcome-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-container">
        <header className="welcome-header">
          <h1>Mattoni</h1>
          <p>Personal Finance Budgeting</p>
        </header>

        {error && <div className="welcome-error">{error}</div>}

        <div className="welcome-content">
          {budgets.length > 0 ? (
            <>
              <h2>Your Budgets</h2>
              <div className="budget-list">
                {budgets.map((budget) => (
                  <div
                    key={budget.id}
                    className={`budget-card ${deletingId === budget.id ? 'deleting' : ''}`}
                    onClick={() => handleSelectBudget(budget)}
                  >
                    <div className="budget-card-content">
                      <span className="budget-name">{budget.name}</span>
                      <span className="budget-date">Last opened: {formatDate(budget.lastAccessedAt)}</span>
                    </div>
                    <button
                      className="budget-delete-btn"
                      onClick={(e) => handleDeleteBudget(e, budget.id)}
                      disabled={deletingId === budget.id}
                      title="Delete budget"
                    >
                      {deletingId === budget.id ? '...' : '×'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="welcome-empty">
              <p>No budgets yet. Create your first budget to get started.</p>
            </div>
          )}

          <button className="create-budget-btn" onClick={() => setShowCreateModal(true)}>
            + Create New Budget
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Budget</h3>
            <input
              type="text"
              className="modal-input"
              placeholder="Budget name..."
              value={newBudgetName}
              onChange={(e) => setNewBudgetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateBudget()}
              autoFocus
            />
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button
                className="modal-btn create"
                onClick={handleCreateBudget}
                disabled={!newBudgetName.trim() || creating}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
