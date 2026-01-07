import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

// Get all budget values for a specific year
router.get('/:year', (req, res) => {
  try {
    const { year } = req.params;

    const values = db.prepare(`
      SELECT component_id, month, amount
      FROM budget_values
      WHERE year = ?
    `).all(year) as Array<{ component_id: number; month: number; amount: number }>;

    // Group values by component_id
    const valuesByComponent: Record<number, Record<number, number>> = {};

    for (const value of values) {
      if (!valuesByComponent[value.component_id]) {
        valuesByComponent[value.component_id] = {};
      }
      valuesByComponent[value.component_id][value.month] = value.amount;
    }

    res.json(valuesByComponent);
  } catch (error) {
    console.error('Error fetching budget values:', error);
    res.status(500).json({ error: 'Failed to fetch budget values' });
  }
});

// Update budget values for a component
router.put('/component/:componentId', (req, res) => {
  try {
    const { componentId } = req.params;
    const { year, values } = req.body;

    if (!year || !values || typeof values !== 'object') {
      return res.status(400).json({ error: 'year and values object are required' });
    }

    const component = db.prepare('SELECT id FROM components WHERE id = ?').get(componentId);
    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    const upsert = db.prepare(`
      INSERT INTO budget_values (component_id, year, month, amount)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(component_id, year, month)
      DO UPDATE SET amount = excluded.amount
    `);

    const transaction = db.transaction(() => {
      for (const [month, amount] of Object.entries(values)) {
        const monthNum = parseInt(month, 10);
        if (monthNum >= 1 && monthNum <= 12) {
          upsert.run(componentId, year, monthNum, amount);
        }
      }
    });

    transaction();

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating budget values:', error);
    res.status(500).json({ error: 'Failed to update budget values' });
  }
});

// Get budget values for a specific component
router.get('/component/:componentId/:year', (req, res) => {
  try {
    const { componentId, year } = req.params;

    const values = db.prepare(`
      SELECT month, amount
      FROM budget_values
      WHERE component_id = ? AND year = ?
    `).all(componentId, year) as Array<{ month: number; amount: number }>;

    const result: Record<number, number> = {};
    for (let month = 1; month <= 12; month++) {
      result[month] = 0;
    }

    for (const value of values) {
      result[value.month] = value.amount;
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching component budget values:', error);
    res.status(500).json({ error: 'Failed to fetch component budget values' });
  }
});

export default router;
