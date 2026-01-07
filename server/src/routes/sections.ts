import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

// Get all sections with nested groups and components
router.get('/', (_req, res) => {
  try {
    const sections = db.prepare(`
      SELECT id, name, type, sort_order
      FROM sections
      ORDER BY sort_order, id
    `).all();

    const groups = db.prepare(`
      SELECT id, section_id, name, sort_order
      FROM groups
      ORDER BY sort_order, id
    `).all() as Array<{ id: number; section_id: number; name: string; sort_order: number }>;

    const components = db.prepare(`
      SELECT id, group_id, name, sort_order
      FROM components
      ORDER BY sort_order, id
    `).all() as Array<{ id: number; group_id: number; name: string; sort_order: number }>;

    // Build nested structure
    const groupsMap = new Map<number, typeof groups>();
    for (const group of groups) {
      if (!groupsMap.has(group.section_id)) {
        groupsMap.set(group.section_id, []);
      }
      groupsMap.get(group.section_id)!.push(group);
    }

    const componentsMap = new Map<number, typeof components>();
    for (const component of components) {
      if (!componentsMap.has(component.group_id)) {
        componentsMap.set(component.group_id, []);
      }
      componentsMap.get(component.group_id)!.push(component);
    }

    const result = (sections as Array<{ id: number; name: string; type: string; sort_order: number }>).map((section) => ({
      ...section,
      groups: (groupsMap.get(section.id) || []).map((group) => ({
        ...group,
        components: componentsMap.get(group.id) || [],
      })),
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
});

// Create a new section
router.post('/', (req, res) => {
  try {
    const { name, type } = req.body;

    if (!name || !type || !['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'Invalid name or type' });
    }

    const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM sections').get() as { max: number | null };
    const sortOrder = (maxOrder.max || 0) + 1;

    const result = db.prepare('INSERT INTO sections (name, type, sort_order) VALUES (?, ?, ?)').run(name, type, sortOrder);

    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      type,
      sort_order: sortOrder,
      groups: [],
    });
  } catch (error) {
    console.error('Error creating section:', error);
    res.status(500).json({ error: 'Failed to create section' });
  }
});

// Update a section
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, type } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (type && !['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const existing = db.prepare('SELECT * FROM sections WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Section not found' });
    }

    db.prepare('UPDATE sections SET name = ?, type = COALESCE(?, type) WHERE id = ?').run(name, type, id);

    res.json({ id: Number(id), name, type: type || (existing as { type: string }).type });
  } catch (error) {
    console.error('Error updating section:', error);
    res.status(500).json({ error: 'Failed to update section' });
  }
});

// Delete a section
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM sections WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Section not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting section:', error);
    res.status(500).json({ error: 'Failed to delete section' });
  }
});

export default router;
