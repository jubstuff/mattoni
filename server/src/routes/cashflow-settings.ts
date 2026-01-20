import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

// Get cashflow settings
router.get('/', (_req, res) => {
  try {
    const settings = db.prepare(`
      SELECT starting_balance, starting_year, starting_month
      FROM cashflow_settings
      LIMIT 1
    `).get() as { starting_balance: number; starting_year: number; starting_month: number } | undefined;

    if (settings) {
      res.json(settings);
    } else {
      // Return defaults
      const now = new Date();
      res.json({
        starting_balance: 0,
        starting_year: now.getFullYear(),
        starting_month: 1,
      });
    }
  } catch (error) {
    console.error('Error fetching cashflow settings:', error);
    res.status(500).json({ error: 'Failed to fetch cashflow settings' });
  }
});

// Update cashflow settings
router.put('/', (req, res) => {
  try {
    const { starting_balance, starting_year, starting_month } = req.body;

    if (starting_balance === undefined || starting_year === undefined || starting_month === undefined) {
      return res.status(400).json({ error: 'starting_balance, starting_year, and starting_month are required' });
    }

    db.prepare('DELETE FROM cashflow_settings').run();
    db.prepare(`
      INSERT INTO cashflow_settings (starting_balance, starting_year, starting_month, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(starting_balance, starting_year, starting_month);

    res.json({ success: true, starting_balance, starting_year, starting_month });
  } catch (error) {
    console.error('Error updating cashflow settings:', error);
    res.status(500).json({ error: 'Failed to update cashflow settings' });
  }
});

export default router;
