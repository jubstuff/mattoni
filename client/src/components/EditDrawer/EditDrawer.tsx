import { useState, useEffect, useRef, useCallback } from 'react';
import type { Component, Section, MonthlyValues } from '../../types';
import { getComponentBudgetValues, updateBudgetValues } from '../../api/client';
import './EditDrawer.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface EditDrawerProps {
  component: Component | null;
  section: Section | null;
  year: number;
  onClose: () => void;
  onValuesChange: () => void;
}

export function EditDrawer({ component, section, year, onClose, onValuesChange }: EditDrawerProps) {
  const [values, setValues] = useState<MonthlyValues>({});
  const [loading, setLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const tableRef = useRef<HTMLTableElement>(null);

  // Use refs to track values for auto-save without causing re-renders
  const previousComponentIdRef = useRef<number | null>(null);
  const valuesRef = useRef<MonthlyValues>({});
  const hasChangesRef = useRef(false);
  const yearRef = useRef(year);

  // Keep refs in sync
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);

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

  // Load values when component changes
  useEffect(() => {
    const previousId = previousComponentIdRef.current;
    const currentId = component?.id ?? null;

    // Save previous component's values if there were changes
    if (previousId !== null && previousId !== currentId && hasChangesRef.current) {
      saveValues(previousId, valuesRef.current, yearRef.current);
    }

    // Update ref
    previousComponentIdRef.current = currentId;
    setHasChanges(false);
    hasChangesRef.current = false;

    if (!component) {
      setValues({});
      return;
    }

    // Load new component's values
    setLoading(true);
    getComponentBudgetValues(component.id, year)
      .then((data) => {
        setValues(data);
        valuesRef.current = data;
      })
      .catch((err) => {
        console.error('Error loading values:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [component?.id, year, saveValues]);

  // Save on unmount or when closing
  useEffect(() => {
    return () => {
      if (previousComponentIdRef.current !== null && hasChangesRef.current) {
        updateBudgetValues(previousComponentIdRef.current, yearRef.current, valuesRef.current)
          .then(onValuesChange)
          .catch(console.error);
      }
    };
  }, [onValuesChange]);

  const handleValueChange = (month: number, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value) || 0;
    setValues((prev) => {
      const newValues = { ...prev, [month]: numValue };
      valuesRef.current = newValues;
      return newValues;
    });
    setHasChanges(true);
    hasChangesRef.current = true;
  };

  const focusCell = useCallback((month: number) => {
    if (month >= 1 && month <= 12) {
      setSelectedCell(month);
      inputRefs.current[month - 1]?.focus();
      inputRefs.current[month - 1]?.select();
    }
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
  };

  // Fill handle drag functionality
  const handleFillHandleMouseDown = (e: React.MouseEvent, month: number) => {
    e.preventDefault();
    e.stopPropagation();
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
      const sourceValue = values[dragStart] || 0;
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
  }, [isDragging, dragStart, dragEnd, values]);

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
                                type="number"
                                className="value-input"
                                value={values[month] || ''}
                                onChange={(e) => handleValueChange(month, e.target.value)}
                                onKeyDown={(e) => handleCellKeyDown(e, month)}
                                onFocus={() => handleCellFocus(month)}
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
                  Arrow keys or Tab to navigate • Drag corner to fill • Auto-saves on switch
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
    </>
  );
}
