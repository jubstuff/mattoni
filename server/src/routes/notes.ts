import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

// Get all notes for a specific year
router.get('/:year', (req, res) => {
  try {
    const { year } = req.params;

    const notes = db.prepare(`
      SELECT component_id, month, note
      FROM budget_notes
      WHERE year = ?
    `).all(year) as Array<{ component_id: number; month: number; note: string }>;

    // Group notes by component_id
    const notesByComponent: Record<number, Record<number, string>> = {};

    for (const item of notes) {
      if (!notesByComponent[item.component_id]) {
        notesByComponent[item.component_id] = {};
      }
      notesByComponent[item.component_id][item.month] = item.note;
    }

    res.json(notesByComponent);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Update notes for a component
router.put('/component/:componentId', (req, res) => {
  try {
    const { componentId } = req.params;
    const { year, notes } = req.body;

    if (!year || !notes || typeof notes !== 'object') {
      return res.status(400).json({ error: 'year and notes object are required' });
    }

    const component = db.prepare('SELECT id FROM components WHERE id = ?').get(componentId);
    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    const upsert = db.prepare(`
      INSERT INTO budget_notes (component_id, year, month, note, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(component_id, year, month)
      DO UPDATE SET note = excluded.note, updated_at = CURRENT_TIMESTAMP
    `);

    const deleteNote = db.prepare(`
      DELETE FROM budget_notes
      WHERE component_id = ? AND year = ? AND month = ?
    `);

    const transaction = db.transaction(() => {
      for (const [month, note] of Object.entries(notes)) {
        const monthNum = parseInt(month, 10);
        if (monthNum >= 1 && monthNum <= 12) {
          if (note && (note as string).trim()) {
            upsert.run(componentId, year, monthNum, (note as string).trim());
          } else {
            deleteNote.run(componentId, year, monthNum);
          }
        }
      }
    });

    transaction();

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating notes:', error);
    res.status(500).json({ error: 'Failed to update notes' });
  }
});

// Get notes for a specific component
router.get('/component/:componentId/:year', (req, res) => {
  try {
    const { componentId, year } = req.params;

    const notes = db.prepare(`
      SELECT month, note
      FROM budget_notes
      WHERE component_id = ? AND year = ?
    `).all(componentId, year) as Array<{ month: number; note: string }>;

    const result: Record<number, string> = {};

    for (const item of notes) {
      result[item.month] = item.note;
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching component notes:', error);
    res.status(500).json({ error: 'Failed to fetch component notes' });
  }
});

export default router;
