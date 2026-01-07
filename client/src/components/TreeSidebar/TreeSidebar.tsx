import { useState } from 'react';
import type { Section, Component } from '../../types';
import {
  createSection,
  updateSection,
  deleteSection,
  createGroup,
  updateGroup,
  deleteGroup,
  createComponent,
  updateComponent,
  deleteComponent,
} from '../../api/client';
import './TreeSidebar.css';

interface TreeSidebarProps {
  sections: Section[];
  onDataChange: () => void;
  onComponentSelect: (component: Component, section: Section) => void;
  selectedComponentId: number | null;
}

export function TreeSidebar({ sections, onDataChange, onComponentSelect, selectedComponentId }: TreeSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set(sections.map((s) => s.id)));
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [addingTo, setAddingTo] = useState<{ type: 'section' | 'group' | 'component'; parentId?: number } | null>(null);
  const [newName, setNewName] = useState('');

  const toggleSection = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleGroup = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleComponentClick = (component: Component, section: Section, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingId !== `component-${component.id}`) {
      onComponentSelect(component, section);
    }
  };

  const handleStartEdit = (type: string, id: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(`${type}-${id}`);
    setEditingName(name);
  };

  const handleSaveEdit = async (type: string, id: number) => {
    if (!editingName.trim()) return;

    try {
      if (type === 'section') {
        await updateSection(id, editingName);
      } else if (type === 'group') {
        await updateGroup(id, editingName);
      } else if (type === 'component') {
        await updateComponent(id, editingName);
      }
      onDataChange();
    } catch (err) {
      console.error('Error updating:', err);
    }

    setEditingId(null);
    setEditingName('');
  };

  const handleDelete = async (type: string, id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this item and all its children?')) return;

    try {
      if (type === 'section') {
        await deleteSection(id);
      } else if (type === 'group') {
        await deleteGroup(id);
      } else if (type === 'component') {
        await deleteComponent(id);
      }
      onDataChange();
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const handleStartAdd = (type: 'section' | 'group' | 'component', parentId?: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAddingTo({ type, parentId });
    setNewName('');
  };

  const handleSaveAdd = async () => {
    if (!addingTo || !newName.trim()) return;

    try {
      if (addingTo.type === 'section') {
        await createSection(newName, 'expense');
      } else if (addingTo.type === 'group' && addingTo.parentId) {
        await createGroup(addingTo.parentId, newName);
        setExpandedSections((prev) => new Set([...prev, addingTo.parentId!]));
      } else if (addingTo.type === 'component' && addingTo.parentId) {
        await createComponent(addingTo.parentId, newName);
        setExpandedGroups((prev) => new Set([...prev, addingTo.parentId!]));
      }
      onDataChange();
    } catch (err) {
      console.error('Error adding:', err);
    }

    setAddingTo(null);
    setNewName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setAddingTo(null);
    }
  };

  return (
    <aside className="tree-sidebar">
      <div className="tree-content">
        {sections.map((section) => (
          <div key={section.id} className="tree-section">
            <div className="tree-item tree-item-section">
              <button className="tree-toggle" onClick={(e) => toggleSection(section.id, e)}>
                {expandedSections.has(section.id) ? '▼' : '▶'}
              </button>
              {editingId === `section-${section.id}` ? (
                <input
                  className="tree-edit-input"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleSaveEdit('section', section.id)}
                  onKeyDown={(e) => handleKeyDown(e, () => handleSaveEdit('section', section.id))}
                  autoFocus
                />
              ) : (
                <>
                  <span
                    className={`tree-name ${section.type}`}
                    onDoubleClick={(e) => handleStartEdit('section', section.id, section.name, e)}
                  >
                    {section.name}
                  </span>
                  <span className="tree-type-badge">{section.type}</span>
                  <button
                    className="tree-action-btn delete"
                    onClick={(e) => handleDelete('section', section.id, e)}
                    title="Delete section"
                  >
                    ×
                  </button>
                </>
              )}
            </div>

            {expandedSections.has(section.id) && (
              <div className="tree-children">
                {section.groups.map((group) => (
                  <div key={group.id} className="tree-group">
                    <div className="tree-item tree-item-group">
                      <button className="tree-toggle" onClick={(e) => toggleGroup(group.id, e)}>
                        {expandedGroups.has(group.id) ? '▼' : '▶'}
                      </button>
                      {editingId === `group-${group.id}` ? (
                        <input
                          className="tree-edit-input"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => handleSaveEdit('group', group.id)}
                          onKeyDown={(e) => handleKeyDown(e, () => handleSaveEdit('group', group.id))}
                          autoFocus
                        />
                      ) : (
                        <>
                          <span
                            className="tree-name"
                            onDoubleClick={(e) => handleStartEdit('group', group.id, group.name, e)}
                          >
                            {group.name}
                          </span>
                          <button
                            className="tree-action-btn delete"
                            onClick={(e) => handleDelete('group', group.id, e)}
                            title="Delete group"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>

                    {expandedGroups.has(group.id) && (
                      <div className="tree-children">
                        {group.components.map((component) => (
                          <div
                            key={component.id}
                            className={`tree-item tree-item-component ${selectedComponentId === component.id ? 'selected' : ''}`}
                            onClick={(e) => handleComponentClick(component, section, e)}
                          >
                            {editingId === `component-${component.id}` ? (
                              <input
                                className="tree-edit-input"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onBlur={() => handleSaveEdit('component', component.id)}
                                onKeyDown={(e) => handleKeyDown(e, () => handleSaveEdit('component', component.id))}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <>
                                <span
                                  className="tree-name"
                                  onDoubleClick={(e) => handleStartEdit('component', component.id, component.name, e)}
                                >
                                  {component.name}
                                </span>
                                <button
                                  className="tree-action-btn delete"
                                  onClick={(e) => handleDelete('component', component.id, e)}
                                  title="Delete component"
                                >
                                  ×
                                </button>
                              </>
                            )}
                          </div>
                        ))}

                        {addingTo?.type === 'component' && addingTo.parentId === group.id ? (
                          <div className="tree-item tree-item-component">
                            <input
                              className="tree-add-input"
                              placeholder="Component name..."
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              onBlur={handleSaveAdd}
                              onKeyDown={(e) => handleKeyDown(e, handleSaveAdd)}
                              autoFocus
                            />
                          </div>
                        ) : (
                          <button
                            className="tree-add-btn"
                            onClick={(e) => handleStartAdd('component', group.id, e)}
                          >
                            + Add Component
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {addingTo?.type === 'group' && addingTo.parentId === section.id ? (
                  <div className="tree-item tree-item-group">
                    <input
                      className="tree-add-input"
                      placeholder="Group name..."
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onBlur={handleSaveAdd}
                      onKeyDown={(e) => handleKeyDown(e, handleSaveAdd)}
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    className="tree-add-btn"
                    onClick={(e) => handleStartAdd('group', section.id, e)}
                  >
                    + Add Group
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {addingTo?.type === 'section' ? (
          <div className="tree-section">
            <div className="tree-item tree-item-section">
              <input
                className="tree-add-input"
                placeholder="Section name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleSaveAdd}
                onKeyDown={(e) => handleKeyDown(e, handleSaveAdd)}
                autoFocus
              />
            </div>
          </div>
        ) : (
          <button className="tree-add-section-btn" onClick={(e) => handleStartAdd('section', undefined, e)}>
            + Add Section
          </button>
        )}
      </div>
    </aside>
  );
}
