import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

// Create a new component
router.post('/', (req, res) => {
  try {
    const { group_id, name } = req.body;

    if (!group_id || !name) {
      return res.status(400).json({ error: 'group_id and name are required' });
    }

    const group = db.prepare('SELECT id FROM groups WHERE id = ?').get(group_id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM components WHERE group_id = ?').get(group_id) as { max: number | null };
    const sortOrder = (maxOrder.max || 0) + 1;

    const result = db.prepare('INSERT INTO components (group_id, name, sort_order) VALUES (?, ?, ?)').run(group_id, name, sortOrder);

    res.status(201).json({
      id: result.lastInsertRowid,
      group_id,
      name,
      sort_order: sortOrder,
    });
  } catch (error) {
    console.error('Error creating component:', error);
    res.status(500).json({ error: 'Failed to create component' });
  }
});

// Update a component
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const existing = db.prepare('SELECT * FROM components WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Component not found' });
    }

    db.prepare('UPDATE components SET name = ? WHERE id = ?').run(name, id);

    res.json({ ...(existing as object), name });
  } catch (error) {
    console.error('Error updating component:', error);
    res.status(500).json({ error: 'Failed to update component' });
  }
});

// Delete a component
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM components WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting component:', error);
    res.status(500).json({ error: 'Failed to delete component' });
  }
});

export default router;
