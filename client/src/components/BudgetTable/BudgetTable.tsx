import { useState, useMemo, useEffect, useRef } from 'react';
import { marked } from 'marked';
import type { Section, BudgetValues, Notes, CashflowSettings } from '../../types';
import type { ViewMode } from '../ViewToggle/ViewToggle';
import './BudgetTable.css';

// Configure marked for inline rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface BudgetTableProps {
  sections: Section[];
  budgetValues: BudgetValues;
  notes: Notes;
  year: number;
  budgetId: string | null;
  viewMode: ViewMode;
  cashflowSettings: CashflowSettings;
}

function formatCurrency(amount: number, isExpense: boolean): string {
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absAmount);

  if (isExpense && amount !== 0) {
    return `(${formatted})`;
  }
  return formatted;
}

export function BudgetTable({ sections, budgetValues, notes, year, budgetId, viewMode, cashflowSettings }: BudgetTableProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const initializedForBudget = useRef<string | null>(null);

  // Load state from localStorage when budgetId becomes available
  useEffect(() => {
    if (!budgetId || sections.length === 0) return;
    if (initializedForBudget.current === budgetId) return; // Already initialized for this budget

    const savedSections = localStorage.getItem(`mattoni:${budgetId}:table:expandedSections`);
    const savedGroups = localStorage.getItem(`mattoni:${budgetId}:table:expandedGroups`);

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
        setExpandedGroups(new Set(sections.flatMap((s) => s.groups.map((g) => g.id))));
      }
    } else {
      // Default: all groups expanded
      setExpandedGroups(new Set(sections.flatMap((s) => s.groups.map((g) => g.id))));
    }

    initializedForBudget.current = budgetId;
  }, [budgetId, sections]);

  // Persist expanded state to localStorage (only after initialization)
  useEffect(() => {
    if (budgetId && initializedForBudget.current === budgetId) {
      localStorage.setItem(`mattoni:${budgetId}:table:expandedSections`, JSON.stringify([...expandedSections]));
    }
  }, [budgetId, expandedSections]);

  useEffect(() => {
    if (budgetId && initializedForBudget.current === budgetId) {
      localStorage.setItem(`mattoni:${budgetId}:table:expandedGroups`, JSON.stringify([...expandedGroups]));
    }
  }, [budgetId, expandedGroups]);

  const toggleSection = (id: number) => {
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

  const toggleGroup = (id: number) => {
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

  const getComponentValue = (componentId: number, month: number): number => {
    return budgetValues[componentId]?.[month] || 0;
  };

  const getComponentNote = (componentId: number, month: number): string | undefined => {
    return notes[componentId]?.[month];
  };

  // Check if a month/year is before the starting date
  const isBeforeStartingDate = (checkYear: number, checkMonth: number): boolean => {
    const { starting_year, starting_month } = cashflowSettings;
    if (checkYear < starting_year) return true;
    if (checkYear > starting_year) return false;
    return checkMonth < starting_month;
  };

  const calculations = useMemo(() => {
    const groupTotals: Record<number, Record<number, number>> = {};
    const sectionTotals: Record<number, Record<number, number>> = {};
    const grandTotals: Record<number, number> = {};

    for (let month = 1; month <= 12; month++) {
      grandTotals[month] = 0;
    }

    for (const section of sections) {
      sectionTotals[section.id] = {};
      for (let month = 1; month <= 12; month++) {
        sectionTotals[section.id][month] = 0;
      }

      for (const group of section.groups) {
        groupTotals[group.id] = {};
        for (let month = 1; month <= 12; month++) {
          groupTotals[group.id][month] = 0;
        }

        for (const component of group.components) {
          // Skip disabled components or components in disabled groups
          if (component.is_disabled || group.is_disabled) continue;

          for (let month = 1; month <= 12; month++) {
            const value = getComponentValue(component.id, month);
            const signedValue = section.type === 'expense' ? -value : value;
            groupTotals[group.id][month] += signedValue;
            sectionTotals[section.id][month] += signedValue;
            grandTotals[month] += signedValue;
          }
        }
      }
    }

    // Calculate running balances for cashflow view
    // Start from the configured starting month
    const runningBalances: Record<number, number | null> = {};
    const { starting_balance } = cashflowSettings;

    let cumulative = starting_balance;
    for (let month = 1; month <= 12; month++) {
      if (isBeforeStartingDate(year, month)) {
        runningBalances[month] = null; // Will show dash
      } else {
        cumulative += grandTotals[month];
        runningBalances[month] = cumulative;
      }
    }

    return { groupTotals, sectionTotals, grandTotals, runningBalances };
  }, [sections, budgetValues, cashflowSettings, year]);

  const { groupTotals, sectionTotals, grandTotals, runningBalances } = calculations;
  const isCashflow = viewMode === 'cashflow';

  return (
    <div className="budget-table-container">
      <table className="budget-table">
        <thead>
          <tr>
            <th className="name-column">{isCashflow ? 'Cashflow Report' : 'Budget Report'} - {year}</th>
            {MONTHS.map((month, idx) => (
              <th key={idx} className="month-column">
                {month} {year}
              </th>
            ))}
            <th className="total-column">Total</th>
          </tr>
        </thead>
        <tbody>
          {/* Starting Balance row (cashflow only) */}
          {isCashflow && (
            <tr className="starting-balance-row">
              <td className="name-cell">
                <span className="starting-balance-name">Starting Balance</span>
              </td>
              {MONTHS.map((_, idx) => {
                const month = idx + 1;
                const isStartingMonth = year === cashflowSettings.starting_year && month === cashflowSettings.starting_month;
                return (
                  <td key={idx} className="value-cell">
                    {isStartingMonth ? formatCurrency(cashflowSettings.starting_balance, false) : ''}
                  </td>
                );
              })}
              <td className="value-cell total">
                {year >= cashflowSettings.starting_year ? formatCurrency(cashflowSettings.starting_balance, false) : '-'}
              </td>
            </tr>
          )}

          {sections.map((section) => {
            const sectionYearTotal = Object.values(sectionTotals[section.id] || {}).reduce((a, b) => a + b, 0);
            const isExpense = section.type === 'expense';
            const isSectionExpanded = expandedSections.has(section.id);

            return (
              <tbody key={section.id} className="section-group">
                {/* Section header row */}
                <tr className="section-row">
                  <td className="name-cell">
                    <button className="toggle-btn" onClick={() => toggleSection(section.id)}>
                      {isSectionExpanded ? '▾' : '▸'}
                    </button>
                    <span className={`section-name ${section.type}`}>{section.name}</span>
                  </td>
                  {!isSectionExpanded && MONTHS.map((_, idx) => {
                    const value = sectionTotals[section.id]?.[idx + 1] || 0;
                    return (
                      <td key={idx} className={`value-cell total-value ${value < 0 ? 'expense' : ''}`}>
                        {formatCurrency(Math.abs(value), value < 0)}
                      </td>
                    );
                  })}
                  {!isSectionExpanded && (
                    <td className={`value-cell total total-value ${sectionYearTotal < 0 ? 'expense' : ''}`}>
                      {formatCurrency(Math.abs(sectionYearTotal), sectionYearTotal < 0)}
                    </td>
                  )}
                  {isSectionExpanded && <td colSpan={13}></td>}
                </tr>

                {isSectionExpanded &&
                  section.groups.map((group) => {
                    const groupYearTotal = Object.values(groupTotals[group.id] || {}).reduce((a, b) => a + b, 0);
                    const isGroupExpanded = expandedGroups.has(group.id);

                    return (
                      <tbody key={group.id} className="group-section">
                        {/* Group header row - shows totals when collapsed */}
                        <tr className={`group-row ${!isGroupExpanded ? 'collapsed' : ''} ${group.is_disabled ? 'disabled' : ''}`}>
                          <td className="name-cell indent-1">
                            <button className="toggle-btn" onClick={() => toggleGroup(group.id)}>
                              {isGroupExpanded ? '▾' : '▸'}
                            </button>
                            <span className="group-name">{group.name}</span>
                          </td>
                          {!isGroupExpanded && MONTHS.map((_, idx) => {
                            const value = groupTotals[group.id]?.[idx + 1] || 0;
                            return (
                              <td key={idx} className={`value-cell total-value ${value < 0 ? 'expense' : ''}`}>
                                {formatCurrency(Math.abs(value), value < 0)}
                              </td>
                            );
                          })}
                          {!isGroupExpanded && (
                            <td className={`value-cell total total-value ${groupYearTotal < 0 ? 'expense' : ''}`}>
                              {formatCurrency(Math.abs(groupYearTotal), groupYearTotal < 0)}
                            </td>
                          )}
                          {isGroupExpanded && <td colSpan={13}></td>}
                        </tr>

                        {isGroupExpanded && (
                          <>
                            {/* Component rows */}
                            {group.components.map((component) => {
                              const componentYearTotal = Array.from({ length: 12 }, (_, i) =>
                                getComponentValue(component.id, i + 1)
                              ).reduce((a, b) => a + b, 0);

                              const isComponentDisabled = component.is_disabled || group.is_disabled;

                              return (
                                <tr key={component.id} className={`component-row ${isComponentDisabled ? 'disabled' : ''}`}>
                                  <td className="name-cell indent-2">
                                    <span className="component-name">{component.name}</span>
                                  </td>
                                  {MONTHS.map((_, idx) => {
                                    const month = idx + 1;
                                    const value = getComponentValue(component.id, month);
                                    const note = getComponentNote(component.id, month);
                                    return (
                                      <td key={idx} className={`value-cell ${isExpense && value > 0 ? 'expense' : ''} ${note ? 'has-note' : ''}`}>
                                        {value === 0 ? '' : formatCurrency(value, isExpense)}
                                        {note && (
                                          <>
                                            <span className="note-indicator" />
                                            <div
                                              className="note-tooltip"
                                              dangerouslySetInnerHTML={{ __html: marked.parse(note) as string }}
                                            />
                                          </>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className={`value-cell total ${isExpense && componentYearTotal > 0 ? 'expense' : ''}`}>
                                    {componentYearTotal === 0 ? '' : formatCurrency(componentYearTotal, isExpense)}
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Group total row at bottom */}
                            <tr className="group-total-row">
                              <td className="name-cell indent-2">
                                <span className="group-total-name">Total of {group.name}</span>
                              </td>
                              {MONTHS.map((_, idx) => {
                                const value = groupTotals[group.id]?.[idx + 1] || 0;
                                return (
                                  <td key={idx} className={`value-cell total-value ${value < 0 ? 'expense' : ''}`}>
                                    {formatCurrency(Math.abs(value), value < 0)}
                                  </td>
                                );
                              })}
                              <td className={`value-cell total total-value ${groupYearTotal < 0 ? 'expense' : ''}`}>
                                {formatCurrency(Math.abs(groupYearTotal), groupYearTotal < 0)}
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    );
                  })}

                {/* Section total row at bottom when expanded */}
                {isSectionExpanded && (
                  <tr className="section-total-row">
                    <td className="name-cell indent-1">
                      <span className="section-total-name">Total of {section.name}</span>
                    </td>
                    {MONTHS.map((_, idx) => {
                      const value = sectionTotals[section.id]?.[idx + 1] || 0;
                      return (
                        <td key={idx} className={`value-cell total-value ${value < 0 ? 'expense' : ''}`}>
                          {formatCurrency(Math.abs(value), value < 0)}
                        </td>
                      );
                    })}
                    <td className={`value-cell total total-value ${sectionYearTotal < 0 ? 'expense' : ''}`}>
                      {formatCurrency(Math.abs(sectionYearTotal), sectionYearTotal < 0)}
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}

          {/* Grand total row */}
          <tr className="grand-total-row">
            <td className="name-cell">
              <span className="grand-total-name">Net Total</span>
            </td>
            {MONTHS.map((_, idx) => {
              const value = grandTotals[idx + 1] || 0;
              return (
                <td key={idx} className={`value-cell total-value ${value < 0 ? 'expense' : ''}`}>
                  {formatCurrency(Math.abs(value), value < 0)}
                </td>
              );
            })}
            <td className={`value-cell total total-value ${Object.values(grandTotals).reduce((a, b) => a + b, 0) < 0 ? 'expense' : ''}`}>
              {formatCurrency(
                Math.abs(Object.values(grandTotals).reduce((a, b) => a + b, 0)),
                Object.values(grandTotals).reduce((a, b) => a + b, 0) < 0
              )}
            </td>
          </tr>

          {/* Running Balance row (cashflow only) */}
          {isCashflow && (
            <tr className="running-balance-row">
              <td className="name-cell">
                <span className="running-balance-name">Running Balance</span>
              </td>
              {MONTHS.map((_, idx) => {
                const balance = runningBalances[idx + 1];
                if (balance === null) {
                  return <td key={idx} className="value-cell running-balance na">-</td>;
                }
                return (
                  <td key={idx} className={`value-cell running-balance ${balance < 0 ? 'negative' : ''}`}>
                    {formatCurrency(Math.abs(balance), balance < 0)}
                  </td>
                );
              })}
              <td className={`value-cell total running-balance ${(runningBalances[12] ?? 0) < 0 ? 'negative' : ''} ${runningBalances[12] === null ? 'na' : ''}`}>
                {runningBalances[12] !== null
                  ? formatCurrency(Math.abs(runningBalances[12]), runningBalances[12] < 0)
                  : '-'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
