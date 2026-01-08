import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Section, Component, Group } from '../../types';
import {
  updateSection,
  deleteSection,
  createGroup,
  updateGroup,
  deleteGroup,
  createComponent,
  updateComponent,
  deleteComponent,
  reorderGroups,
  reorderComponents,
  toggleComponentDisabled,
  toggleGroupDisabled,
} from '../../api/client';
import './TreeSidebar.css';

interface TreeSidebarProps {
  sections: Section[];
  budgetId: string | null;
  onDataChange: () => void;
  onComponentSelect: (component: Component, section: Section) => void;
  selectedComponentId: number | null;
}

interface SortableGroupProps {
  group: Group;
  section: Section;
  isExpanded: boolean;
  onToggle: (id: number, e: React.MouseEvent) => void;
  onToggleDisabled: (id: number, e: React.MouseEvent) => void;
  editingId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  onStartEdit: (type: string, id: number, name: string, e: React.MouseEvent) => void;
  onSaveEdit: (type: string, id: number) => void;
  onDelete: (type: string, id: number, e: React.MouseEvent) => void;
  onKeyDown: (e: React.KeyboardEvent, action: () => void) => void;
  children: React.ReactNode;
}

function SortableGroup({
  group,
  isExpanded,
  onToggle,
  onToggleDisabled,
  editingId,
  editingName,
  setEditingName,
  onStartEdit,
  onSaveEdit,
  onDelete,
  onKeyDown,
  children,
}: SortableGroupProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `group-${group.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="tree-group">
      <div className={`tree-item tree-item-group ${group.is_disabled ? 'disabled' : ''}`}>
        <span className="drag-handle" {...attributes} {...listeners}>⠿</span>
        <button className="tree-toggle" onClick={(e) => onToggle(group.id, e)}>
          {isExpanded ? '▼' : '▶'}
        </button>
        {editingId === `group-${group.id}` ? (
          <input
            className="tree-edit-input"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={() => onSaveEdit('group', group.id)}
            onKeyDown={(e) => onKeyDown(e, () => onSaveEdit('group', group.id))}
            autoFocus
          />
        ) : (
          <>
            <span
              className="tree-name"
              onDoubleClick={(e) => onStartEdit('group', group.id, group.name, e)}
            >
              {group.name}
            </span>
            <button
              className={`tree-action-btn toggle-visibility ${group.is_disabled ? 'is-disabled' : ''}`}
              onClick={(e) => onToggleDisabled(group.id, e)}
              title={group.is_disabled ? 'Enable group' : 'Disable group'}
            >
              {group.is_disabled ? '○' : '●'}
            </button>
            <button
              className="tree-action-btn delete"
              onClick={(e) => onDelete('group', group.id, e)}
              title="Delete group"
            >
              ×
            </button>
          </>
        )}
      </div>
      {children}
    </div>
  );
}

interface SortableComponentProps {
  component: Component;
  section: Section;
  isSelected: boolean;
  editingId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  onClick: (component: Component, section: Section, e: React.MouseEvent) => void;
  onToggleDisabled: (id: number, e: React.MouseEvent) => void;
  onStartEdit: (type: string, id: number, name: string, e: React.MouseEvent) => void;
  onSaveEdit: (type: string, id: number) => void;
  onDelete: (type: string, id: number, e: React.MouseEvent) => void;
  onKeyDown: (e: React.KeyboardEvent, action: () => void) => void;
}

function SortableComponent({
  component,
  section,
  isSelected,
  editingId,
  editingName,
  setEditingName,
  onClick,
  onToggleDisabled,
  onStartEdit,
  onSaveEdit,
  onDelete,
  onKeyDown,
}: SortableComponentProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `component-${component.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`tree-item tree-item-component ${isSelected ? 'selected' : ''} ${component.is_disabled ? 'disabled' : ''}`}
      onClick={(e) => onClick(component, section, e)}
    >
      <span className="drag-handle" {...attributes} {...listeners}>⠿</span>
      {editingId === `component-${component.id}` ? (
        <input
          className="tree-edit-input"
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onBlur={() => onSaveEdit('component', component.id)}
          onKeyDown={(e) => onKeyDown(e, () => onSaveEdit('component', component.id))}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <span
            className="tree-name"
            onDoubleClick={(e) => onStartEdit('component', component.id, component.name, e)}
          >
            {component.name}
          </span>
          <button
            className={`tree-action-btn toggle-visibility ${component.is_disabled ? 'is-disabled' : ''}`}
            onClick={(e) => onToggleDisabled(component.id, e)}
            title={component.is_disabled ? 'Enable component' : 'Disable component'}
          >
            {component.is_disabled ? '○' : '●'}
          </button>
          <button
            className="tree-action-btn delete"
            onClick={(e) => onDelete('component', component.id, e)}
            title="Delete component"
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}

export function TreeSidebar({ sections, budgetId, onDataChange, onComponentSelect, selectedComponentId }: TreeSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const initializedForBudget = useRef<string | null>(null);

  // Load state from localStorage when budgetId becomes available
  useEffect(() => {
    if (!budgetId || sections.length === 0) return;
    if (initializedForBudget.current === budgetId) return; // Already initialized for this budget

    const savedSections = localStorage.getItem(`mattoni:${budgetId}:sidebar:expandedSections`);
    const savedGroups = localStorage.getItem(`mattoni:${budgetId}:sidebar:expandedGroups`);

    if (savedSections) {
      try {
        setExpandedSections(new Set(JSON.parse(savedSections)));
      } catch {
        setExpandedSections(new Set(sections.map((s) => s.id)));
      }
    } else {
      // Default: all sections expanded
      setExpandedSections(new Set(sections.map((s) => s.id)));
    }

    if (savedGroups) {
      try {
        setExpandedGroups(new Set(JSON.parse(savedGroups)));
      } catch {
        setExpandedGroups(new Set());
      }
    } else {
      setExpandedGroups(new Set());
    }

    initializedForBudget.current = budgetId;
  }, [budgetId, sections]);

  // Persist expanded state to localStorage (only after initialization)
  useEffect(() => {
    if (budgetId && initializedForBudget.current === budgetId) {
      localStorage.setItem(`mattoni:${budgetId}:sidebar:expandedSections`, JSON.stringify([...expandedSections]));
    }
  }, [budgetId, expandedSections]);

  useEffect(() => {
    if (budgetId && initializedForBudget.current === budgetId) {
      localStorage.setItem(`mattoni:${budgetId}:sidebar:expandedGroups`, JSON.stringify([...expandedGroups]));
    }
  }, [budgetId, expandedGroups]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [addingTo, setAddingTo] = useState<{ type: 'group' | 'component'; parentId: number } | null>(null);
  const [newName, setNewName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  const handleStartAdd = (type: 'group' | 'component', parentId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAddingTo({ type, parentId });
    setNewName('');
  };

  const handleSaveAdd = async () => {
    if (!addingTo || !newName.trim()) return;

    try {
      if (addingTo.type === 'group') {
        await createGroup(addingTo.parentId, newName);
        setExpandedSections((prev) => new Set([...prev, addingTo.parentId]));
      } else if (addingTo.type === 'component') {
        await createComponent(addingTo.parentId, newName);
        setExpandedGroups((prev) => new Set([...prev, addingTo.parentId]));
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

  const handleToggleGroupDisabled = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleGroupDisabled(id);
      onDataChange();
    } catch (err) {
      console.error('Error toggling group disabled state:', err);
    }
  };

  const handleToggleComponentDisabled = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleComponentDisabled(id);
      onDataChange();
    } catch (err) {
      console.error('Error toggling component disabled state:', err);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Handle group reordering
    if (activeIdStr.startsWith('group-') && overIdStr.startsWith('group-')) {
      const activeGroupId = parseInt(activeIdStr.replace('group-', ''));
      const overGroupId = parseInt(overIdStr.replace('group-', ''));

      // Find which sections contain these groups
      let activeSection: Section | undefined;
      let overSection: Section | undefined;
      let activeGroup: Group | undefined;
      let overGroup: Group | undefined;

      for (const section of sections) {
        for (const group of section.groups) {
          if (group.id === activeGroupId) {
            activeSection = section;
            activeGroup = group;
          }
          if (group.id === overGroupId) {
            overSection = section;
            overGroup = group;
          }
        }
      }

      if (!activeSection || !overSection || !activeGroup || !overGroup) return;

      // Build updates array
      const updates: Array<{ id: number; sort_order: number; section_id?: number }> = [];

      if (activeSection.id === overSection.id) {
        // Same section: just reorder
        const groupsCopy = [...activeSection.groups];
        const oldIndex = groupsCopy.findIndex((g) => g.id === activeGroupId);
        const newIndex = groupsCopy.findIndex((g) => g.id === overGroupId);

        groupsCopy.splice(oldIndex, 1);
        groupsCopy.splice(newIndex, 0, activeGroup);

        groupsCopy.forEach((g, index) => {
          updates.push({ id: g.id, sort_order: index + 1 });
        });
      } else {
        // Different sections: move group to new section
        const sourceGroups = activeSection.groups.filter((g) => g.id !== activeGroupId);
        const targetGroups = [...overSection.groups];
        const overIndex = targetGroups.findIndex((g) => g.id === overGroupId);
        targetGroups.splice(overIndex, 0, activeGroup);

        // Update source section groups
        sourceGroups.forEach((g, index) => {
          updates.push({ id: g.id, sort_order: index + 1 });
        });

        // Update target section groups with new section_id for the moved group
        targetGroups.forEach((g, index) => {
          if (g.id === activeGroupId) {
            updates.push({ id: g.id, sort_order: index + 1, section_id: overSection!.id });
          } else {
            updates.push({ id: g.id, sort_order: index + 1 });
          }
        });
      }

      try {
        await reorderGroups(updates);
        onDataChange();
      } catch (err) {
        console.error('Error reordering groups:', err);
      }
    }

    // Handle component reordering
    if (activeIdStr.startsWith('component-') && overIdStr.startsWith('component-')) {
      const activeComponentId = parseInt(activeIdStr.replace('component-', ''));
      const overComponentId = parseInt(overIdStr.replace('component-', ''));

      // Find the group containing these components
      let targetGroup: Group | undefined;
      let activeComponent: Component | undefined;

      for (const section of sections) {
        for (const group of section.groups) {
          for (const component of group.components) {
            if (component.id === activeComponentId) {
              activeComponent = component;
            }
            if (component.id === overComponentId) {
              targetGroup = group;
            }
          }
        }
      }

      if (!targetGroup || !activeComponent) return;

      // Check if both components are in the same group
      const activeInGroup = targetGroup.components.some((c) => c.id === activeComponentId);
      if (!activeInGroup) return; // Don't allow moving between groups

      const componentsCopy = [...targetGroup.components];
      const oldIndex = componentsCopy.findIndex((c) => c.id === activeComponentId);
      const newIndex = componentsCopy.findIndex((c) => c.id === overComponentId);

      componentsCopy.splice(oldIndex, 1);
      componentsCopy.splice(newIndex, 0, activeComponent);

      const updates = componentsCopy.map((c, index) => ({
        id: c.id,
        sort_order: index + 1,
      }));

      try {
        await reorderComponents(updates);
        onDataChange();
      } catch (err) {
        console.error('Error reordering components:', err);
      }
    }
  };

  // Get all group IDs for the DndContext
  const allGroupIds = sections.flatMap((s) => s.groups.map((g) => `group-${g.id}`));

  // Find active item for overlay
  const getActiveItem = () => {
    if (!activeId) return null;

    if (activeId.startsWith('group-')) {
      const groupId = parseInt(activeId.replace('group-', ''));
      for (const section of sections) {
        const group = section.groups.find((g) => g.id === groupId);
        if (group) return { type: 'group', name: group.name };
      }
    }

    if (activeId.startsWith('component-')) {
      const componentId = parseInt(activeId.replace('component-', ''));
      for (const section of sections) {
        for (const group of section.groups) {
          const component = group.components.find((c) => c.id === componentId);
          if (component) return { type: 'component', name: component.name };
        }
      }
    }

    return null;
  };

  const activeItem = getActiveItem();

  return (
    <aside className="tree-sidebar">
      <div className="tree-content">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={allGroupIds} strategy={verticalListSortingStrategy}>
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
                      <SortableGroup
                        key={group.id}
                        group={group}
                        section={section}
                        isExpanded={expandedGroups.has(group.id)}
                        onToggle={toggleGroup}
                        onToggleDisabled={handleToggleGroupDisabled}
                        editingId={editingId}
                        editingName={editingName}
                        setEditingName={setEditingName}
                        onStartEdit={handleStartEdit}
                        onSaveEdit={handleSaveEdit}
                        onDelete={handleDelete}
                        onKeyDown={handleKeyDown}
                      >
                        {expandedGroups.has(group.id) && (
                          <div className="tree-children">
                            <SortableContext
                              items={group.components.map((c) => `component-${c.id}`)}
                              strategy={verticalListSortingStrategy}
                            >
                              {group.components.map((component) => (
                                <SortableComponent
                                  key={component.id}
                                  component={component}
                                  section={section}
                                  isSelected={selectedComponentId === component.id}
                                  editingId={editingId}
                                  editingName={editingName}
                                  setEditingName={setEditingName}
                                  onClick={handleComponentClick}
                                  onToggleDisabled={handleToggleComponentDisabled}
                                  onStartEdit={handleStartEdit}
                                  onSaveEdit={handleSaveEdit}
                                  onDelete={handleDelete}
                                  onKeyDown={handleKeyDown}
                                />
                              ))}
                            </SortableContext>

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
                      </SortableGroup>
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
          </SortableContext>

          <DragOverlay>
            {activeItem ? (
              <div className={`drag-overlay drag-overlay-${activeItem.type}`}>
                {activeItem.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

      </div>
    </aside>
  );
}
