import { Router } from 'express';

const router = Router();

// Default budget for web server (single database mode)
const DEFAULT_BUDGET = {
  id: 'default',
  name: 'Default Budget',
  createdAt: new Date().toISOString(),
  modifiedAt: new Date().toISOString(),
};

// Get all budgets
router.get('/', (_req, res) => {
  try {
    res.json({
      budgets: [DEFAULT_BUDGET],
      lastSelectedBudgetId: 'default',
    });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

// Create a new budget (no-op for web server)
router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    res.json({
      id: 'default',
      name: name || 'Default Budget',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error creating budget:', error);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

// Select a budget
router.post('/:id/select', (req, res) => {
  try {
    res.json({
      success: true,
      budget: DEFAULT_BUDGET,
    });
  } catch (error) {
    console.error('Error selecting budget:', error);
    res.status(500).json({ error: 'Failed to select budget' });
  }
});

// Deselect budget
router.post('/deselect', (_req, res) => {
  try {
    res.json({ success: true });
  } catch (error) {
    console.error('Error deselecting budget:', error);
    res.status(500).json({ error: 'Failed to deselect budget' });
  }
});

// Rename budget
router.put('/:id', (req, res) => {
  try {
    const { name } = req.body;
    res.json({
      ...DEFAULT_BUDGET,
      name: name || DEFAULT_BUDGET.name,
      modifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error renaming budget:', error);
    res.status(500).json({ error: 'Failed to rename budget' });
  }
});

// Delete budget (no-op for web server)
router.delete('/:id', (_req, res) => {
  try {
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting budget:', error);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

export default router;
