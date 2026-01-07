import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

// Create a new group
router.post('/', (req, res) => {
  try {
    const { section_id, name } = req.body;

    if (!section_id || !name) {
      return res.status(400).json({ error: 'section_id and name are required' });
    }

    const section = db.prepare('SELECT id FROM sections WHERE id = ?').get(section_id);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM groups WHERE section_id = ?').get(section_id) as { max: number | null };
    const sortOrder = (maxOrder.max || 0) + 1;

    const result = db.prepare('INSERT INTO groups (section_id, name, sort_order) VALUES (?, ?, ?)').run(section_id, name, sortOrder);

    res.status(201).json({
      id: result.lastInsertRowid,
      section_id,
      name,
      sort_order: sortOrder,
      components: [],
    });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Update a group
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const existing = db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Group not found' });
    }

    db.prepare('UPDATE groups SET name = ? WHERE id = ?').run(name, id);

    res.json({ ...(existing as object), name });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Delete a group
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM groups WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

export default router;
