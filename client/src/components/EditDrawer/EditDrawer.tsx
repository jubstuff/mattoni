import { useState, useEffect, useRef, useCallback } from 'react';
import type { Component, Section, MonthlyValues, MonthlyNotes } from '../../types';
import { getComponentBudgetValues, updateBudgetValues, getComponentNotes, updateNotes } from '../../api/client';
import { PastePreviewModal } from '../PastePreviewModal/PastePreviewModal';
import { parseClipboardTSV, valuesToMonthlyValues, type ParsedClipboardData } from '../../utils/clipboard';
import './EditDrawer.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Evaluate simple math expressions like "100+50" or "500-20%"
function evaluateExpression(input: string): number | null {
  const trimmed = input.trim();

  // Check if it looks like an expression (contains operator)
  if (!/[+\-*/]/.test(trimmed)) return null;

  // Handle percentage operations: 100+10% → 100 + (100 * 0.10)
  const percentMatch = trimmed.match(/^(\d+\.?\d*)\s*([+\-*/])\s*(\d+\.?\d*)%$/);
  if (percentMatch) {
    const [, base, op, percent] = percentMatch;
    const baseNum = parseFloat(base);
    const percentNum = parseFloat(percent) / 100;
    switch (op) {
      case '+': return baseNum + (baseNum * percentNum);
      case '-': return baseNum - (baseNum * percentNum);
      case '*': return baseNum * percentNum;
      case '/': return percentNum !== 0 ? baseNum / percentNum : null;
    }
  }

  // Handle basic expressions: 100+50, 200*3, etc.
  const basicMatch = trimmed.match(/^(\d+\.?\d*)\s*([+\-*/])\s*(\d+\.?\d*)$/);
  if (basicMatch) {
    const [, left, op, right] = basicMatch;
    const a = parseFloat(left);
    const b = parseFloat(right);
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b !== 0 ? a / b : null;
    }
  }

  return null;
}

interface EditDrawerProps {
  component: Component | null;
  section: Section | null;
  year: number;
  onClose: () => void;
  onValuesChange: () => void;
}

export function EditDrawer({ component, section, year, onClose, onValuesChange }: EditDrawerProps) {
  const [values, setValues] = useState<MonthlyValues>({});
  const [componentNotes, setComponentNotes] = useState<MonthlyNotes>({});
  const [loading, setLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasNoteChanges, setHasNoteChanges] = useState(false);
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const tableRef = useRef<HTMLTableElement>(null);
  const dragSourceValueRef = useRef<number>(0);

  // Paste preview modal state
  const [pastePreviewOpen, setPastePreviewOpen] = useState(false);
  const [pasteData, setPasteData] = useState<ParsedClipboardData | null>(null);

  // Use refs to track values for auto-save without causing re-renders
  const previousComponentIdRef = useRef<number | null>(null);
  const valuesRef = useRef<MonthlyValues>({});
  const notesRef = useRef<MonthlyNotes>({});
  const hasChangesRef = useRef(false);
  const hasNoteChangesRef = useRef(false);
  const yearRef = useRef(year);

  // Keep refs in sync
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    notesRef.current = componentNotes;
  }, [componentNotes]);

  useEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);

  useEffect(() => {
    hasNoteChangesRef.current = hasNoteChanges;
  }, [hasNoteChanges]);

  useEffect(() => {
    yearRef.current = year;
  }, [year]);

  // Save function using refs (doesn't change on every render)
  const saveValues = useCallback(async (componentId: number, valuesToSave: MonthlyValues, currentYear: number) => {
    try {
      await updateBudgetValues(componentId, currentYear, valuesToSave);
      onValuesChange();
    } catch (err) {
      console.error('Error saving values:', err);
    }
  }, [onValuesChange]);

  const saveNotes = useCallback(async (componentId: number, notesToSave: MonthlyNotes, currentYear: number) => {
    try {
      await updateNotes(componentId, currentYear, notesToSave);
      onValuesChange();
    } catch (err) {
      console.error('Error saving notes:', err);
    }
  }, [onValuesChange]);

  // Load values when component changes
  useEffect(() => {
    const previousId = previousComponentIdRef.current;
    const currentId = component?.id ?? null;

    // Save previous component's values and notes if there were changes
    if (previousId !== null && previousId !== currentId) {
      if (hasChangesRef.current) {
        saveValues(previousId, valuesRef.current, yearRef.current);
      }
      if (hasNoteChangesRef.current) {
        saveNotes(previousId, notesRef.current, yearRef.current);
      }
    }

    // Update ref
    previousComponentIdRef.current = currentId;
    setHasChanges(false);
    setHasNoteChanges(false);
    hasChangesRef.current = false;
    hasNoteChangesRef.current = false;

    if (!component) {
      setValues({});
      setComponentNotes({});
      return;
    }

    // Load new component's values and notes
    setLoading(true);
    Promise.all([
      getComponentBudgetValues(component.id, year),
      getComponentNotes(component.id, year),
    ])
      .then(([valuesData, notesData]) => {
        setValues(valuesData);
        valuesRef.current = valuesData;
        setComponentNotes(notesData);
        notesRef.current = notesData;
        // Focus first cell after loading
        setTimeout(() => {
          inputRefs.current[0]?.focus();
          inputRefs.current[0]?.select();
          setSelectedCell(1);
          setEditingMonth(1);
          const firstValue = valuesData[1] || 0;
          setEditingValue(firstValue === 0 ? '' : String(firstValue));
        }, 50);
      })
      .catch((err) => {
        console.error('Error loading values:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [component?.id, year, saveValues, saveNotes]);

  // Save on unmount or when closing
  useEffect(() => {
    return () => {
      if (previousComponentIdRef.current !== null) {
        const promises: Promise<void>[] = [];
        if (hasChangesRef.current) {
          promises.push(
            updateBudgetValues(previousComponentIdRef.current, yearRef.current, valuesRef.current)
          );
        }
        if (hasNoteChangesRef.current) {
          promises.push(
            updateNotes(previousComponentIdRef.current, yearRef.current, notesRef.current)
          );
        }
        if (promises.length > 0) {
          Promise.all(promises).then(onValuesChange).catch(console.error);
        }
      }
    };
  }, [onValuesChange]);

  const handleValueChange = (_month: number, value: string) => {
    // Just track the raw input while editing
    setEditingValue(value);
  };

  const commitValue = (month: number) => {
    // Evaluate expression and commit the result
    const evaluated = evaluateExpression(editingValue);
    const numValue = evaluated !== null ? evaluated : (editingValue === '' ? 0 : parseFloat(editingValue) || 0);
    setValues((prev) => {
      const newValues = { ...prev, [month]: numValue };
      valuesRef.current = newValues;
      return newValues;
    });
    setHasChanges(true);
    hasChangesRef.current = true;
    setEditingMonth(null);
    setEditingValue('');
  };

  const handleNoteChange = (month: number, note: string) => {
    setComponentNotes((prev) => {
      const newNotes = { ...prev, [month]: note };
      notesRef.current = newNotes;
      return newNotes;
    });
    setHasNoteChanges(true);
    hasNoteChangesRef.current = true;
  };

  const focusCell = useCallback((month: number) => {
    if (month >= 1 && month <= 12) {
      setSelectedCell(month);
      inputRefs.current[month - 1]?.focus();
      inputRefs.current[month - 1]?.select();
    }
  }, []);

  // Paste from clipboard handlers
  const handlePaste = useCallback(async () => {
    if (!component) return;

    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseClipboardTSV(text);

      if (parsed.values.length === 0) {
        return;
      }

      setPasteData(parsed);
      setPastePreviewOpen(true);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  }, [component]);

  const handlePasteConfirm = useCallback(() => {
    if (!pasteData) return;

    const startMonth = selectedCell ?? 1;
    const newMonthlyValues = valuesToMonthlyValues(pasteData.values, startMonth);

    setValues((prev) => {
      const merged = { ...prev, ...newMonthlyValues };
      valuesRef.current = merged;
      return merged;
    });

    setHasChanges(true);
    hasChangesRef.current = true;

    setPastePreviewOpen(false);
    setPasteData(null);
  }, [pasteData, selectedCell]);

  const handlePasteCancel = useCallback(() => {
    setPastePreviewOpen(false);
    setPasteData(null);
  }, []);

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, month: number) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'Tab':
        if (!e.shiftKey) {
          e.preventDefault();
          focusCell(month + 1);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          focusCell(month - 1);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        focusCell(month - 1);
        break;
      case 'ArrowDown':
      case 'Enter':
        e.preventDefault();
        inputRefs.current[month - 1]?.blur();
        break;
      case 'ArrowUp':
        e.preventDefault();
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  const handleCellFocus = (month: number) => {
    setSelectedCell(month);
    setEditingMonth(month);
    // Initialize with current value as string
    const currentValue = values[month] || 0;
    setEditingValue(currentValue === 0 ? '' : String(currentValue));
  };

  const handleCellBlur = (month: number) => {
    if (editingMonth === month) {
      commitValue(month);
    }
  };

  // Fill handle drag functionality
  const handleFillHandleMouseDown = (e: React.MouseEvent, month: number) => {
    e.preventDefault();
    e.stopPropagation();

    // Get the source value - either from current edit or stored values
    let sourceValue: number;
    if (editingMonth === month && editingValue) {
      const evaluated = evaluateExpression(editingValue);
      sourceValue = evaluated !== null ? evaluated : (editingValue === '' ? 0 : parseFloat(editingValue) || 0);
      // Commit the edit
      setValues((prev) => {
        const newValues = { ...prev, [month]: sourceValue };
        valuesRef.current = newValues;
        return newValues;
      });
      setHasChanges(true);
      hasChangesRef.current = true;
      setEditingMonth(null);
      setEditingValue('');
    } else {
      sourceValue = values[month] || 0;
    }

    // Store source value in ref for use in handleMouseUp
    dragSourceValueRef.current = sourceValue;

    setIsDragging(true);
    setDragStart(month);
    setDragEnd(month);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || dragStart === null || !tableRef.current) return;

    const cells = tableRef.current.querySelectorAll('.cell-wrapper');
    let closestCell = dragStart;
    let closestDistance = Infinity;

    cells.forEach((cell, idx) => {
      const rect = cell.getBoundingClientRect();
      const cellCenterX = rect.left + rect.width / 2;
      const distance = Math.abs(e.clientX - cellCenterX);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestCell = idx + 1;
      }
    });

    setDragEnd(closestCell);
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && dragStart !== null && dragEnd !== null && dragStart !== dragEnd) {
      const sourceValue = dragSourceValueRef.current;
      const start = Math.min(dragStart, dragEnd);
      const end = Math.max(dragStart, dragEnd);

      setValues((prev) => {
        const newValues = { ...prev };
        for (let i = start; i <= end; i++) {
          newValues[i] = sourceValue;
        }
        valuesRef.current = newValues;
        return newValues;
      });
      setHasChanges(true);
      hasChangesRef.current = true;
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Keyboard listener for Cmd+V / Ctrl+V paste
  useEffect(() => {
    if (!component) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        navigator.clipboard.readText().then((text) => {
          if (text.includes('\t')) {
            e.preventDefault();
            handlePaste();
          }
          // Single value: let default paste behavior handle it
        }).catch(() => {
          // Clipboard read failed, let default behavior continue
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [component, handlePaste]);

  const isInDragRange = (month: number) => {
    if (!isDragging || dragStart === null || dragEnd === null) return false;
    const start = Math.min(dragStart, dragEnd);
    const end = Math.max(dragStart, dragEnd);
    return month >= start && month <= end;
  };

  const total = Object.values(values).reduce((sum, val) => sum + val, 0);
  const isExpense = section?.type === 'expense';
  const isOpen = component !== null;

  return (
    <>
      {isOpen && <div className="drawer-overlay" onClick={onClose} />}
      <aside className={`edit-drawer ${isOpen ? 'open' : ''}`}>
        {component && section && (
        <>
          <div className="drawer-header">
            <div className="drawer-title">
              <h2>{component.name}</h2>
              <span className={`drawer-type ${section.type}`}>{section.type}</span>
            </div>
            <button className="drawer-close" onClick={onClose} title="Close">
              ×
            </button>
          </div>

          <div className="drawer-body">
            <p className="drawer-description">
              Monthly {isExpense ? 'expense' : 'income'} for {year}
              {hasChanges && <span className="unsaved-badge">Unsaved</span>}
            </p>

            {loading ? (
              <p className="drawer-loading">Loading...</p>
            ) : (
              <div className="values-table-container">
                <table className="values-table" ref={tableRef}>
                  <thead>
                    <tr>
                      <th className="year-header"></th>
                      {MONTHS.map((month) => (
                        <th key={month}>{month}</th>
                      ))}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="year-cell">{year}</td>
                      {MONTHS.map((_, idx) => {
                        const month = idx + 1;
                        const isSelected = selectedCell === month;
                        const inDragRange = isInDragRange(month);

                        return (
                          <td
                            key={idx}
                            className={`value-cell ${inDragRange ? 'drag-highlight' : ''}`}
                          >
                            <div className={`cell-wrapper ${isSelected ? 'selected' : ''}`}>
                              <input
                                ref={(el) => { inputRefs.current[idx] = el; }}
                                type="text"
                                inputMode="decimal"
                                className="value-input"
                                value={editingMonth === month ? editingValue : (values[month] || '')}
                                onChange={(e) => handleValueChange(month, e.target.value)}
                                onKeyDown={(e) => handleCellKeyDown(e, month)}
                                onFocus={() => handleCellFocus(month)}
                                onBlur={() => handleCellBlur(month)}
                                placeholder="0"
                              />
                              {isSelected && !isDragging && (
                                <div
                                  className="fill-handle"
                                  onMouseDown={(e) => handleFillHandleMouseDown(e, month)}
                                  title="Drag to fill"
                                />
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className={`total-cell ${isExpense ? 'expense' : ''}`}>
                        {isExpense ? `(€${total.toLocaleString('de-DE')})` : `€${total.toLocaleString('de-DE')}`}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="keyboard-hint">
                  Arrow keys or Tab to navigate • Drag corner to fill • Math: 100+50, 500-20% • Cmd+V to paste • Auto-saves
                </p>

                {selectedCell && (
                  <div className="note-section">
                    <label className="note-label">
                      Note for {MONTHS[selectedCell - 1]}
                      {hasNoteChanges && <span className="unsaved-badge">Unsaved</span>}
                    </label>
                    <textarea
                      className="note-textarea"
                      value={componentNotes[selectedCell] || ''}
                      onChange={(e) => handleNoteChange(selectedCell, e.target.value)}
                      placeholder="Add a note for this month (supports markdown)..."
                      rows={3}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="drawer-footer">
            <button className="save-btn" onClick={onClose}>
              Save
            </button>
          </div>
        </>
      )}
    </aside>
      <PastePreviewModal
        isOpen={pastePreviewOpen}
        data={pasteData ?? { values: [], rawValues: [], errors: [], isValid: false }}
        startMonth={selectedCell ?? 1}
        currentValues={values}
        onConfirm={handlePasteConfirm}
        onCancel={handlePasteCancel}
      />
    </>
  );
}
