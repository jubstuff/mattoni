import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

// Get all actual values for a specific year
router.get('/:year', (req, res) => {
  try {
    const { year } = req.params;

    const values = db.prepare(`
      SELECT component_id, month, amount
      FROM actual_values
      WHERE year = ?
    `).all(year) as Array<{ component_id: number; month: number; amount: number }>;

    const valuesByComponent: Record<number, Record<number, number>> = {};

    for (const value of values) {
      if (!valuesByComponent[value.component_id]) {
        valuesByComponent[value.component_id] = {};
      }
      valuesByComponent[value.component_id][value.month] = value.amount;
    }

    res.json(valuesByComponent);
  } catch (error) {
    console.error('Error fetching actual values:', error);
    res.status(500).json({ error: 'Failed to fetch actual values' });
  }
});

// Update actual values for a component
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
      INSERT INTO actual_values (component_id, year, month, amount)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(component_id, year, month)
      DO UPDATE SET amount = excluded.amount, updated_at = CURRENT_TIMESTAMP
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
    console.error('Error updating actual values:', error);
    res.status(500).json({ error: 'Failed to update actual values' });
  }
});

// Get cutoff settings
router.get('/cutoff/settings', (_req, res) => {
  try {
    const settings = db.prepare(`
      SELECT cutoff_year, cutoff_month
      FROM actuals_cutoff_settings
      LIMIT 1
    `).get() as { cutoff_year: number; cutoff_month: number } | undefined;

    if (settings) {
      res.json(settings);
    } else {
      // Return defaults (previous month)
      const now = new Date();
      let cutoffMonth = now.getMonth();
      let cutoffYear = now.getFullYear();
      if (cutoffMonth === 0) {
        cutoffMonth = 12;
        cutoffYear -= 1;
      }
      res.json({
        cutoff_year: cutoffYear,
        cutoff_month: cutoffMonth,
      });
    }
  } catch (error) {
    console.error('Error fetching cutoff settings:', error);
    res.status(500).json({ error: 'Failed to fetch cutoff settings' });
  }
});

// Update cutoff settings
router.put('/cutoff/settings', (req, res) => {
  try {
    const { cutoff_year, cutoff_month } = req.body;

    if (cutoff_year === undefined || cutoff_month === undefined) {
      return res.status(400).json({ error: 'cutoff_year and cutoff_month are required' });
    }

    db.prepare('DELETE FROM actuals_cutoff_settings').run();
    db.prepare(`
      INSERT INTO actuals_cutoff_settings (cutoff_year, cutoff_month, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(cutoff_year, cutoff_month);

    res.json({ success: true, cutoff_year, cutoff_month });
  } catch (error) {
    console.error('Error updating cutoff settings:', error);
    res.status(500).json({ error: 'Failed to update cutoff settings' });
  }
});

export default router;
