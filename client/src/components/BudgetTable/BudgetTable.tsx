import { useState, useMemo } from 'react';
import type { Section, BudgetValues } from '../../types';
import './BudgetTable.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface BudgetTableProps {
  sections: Section[];
  budgetValues: BudgetValues;
  year: number;
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

export function BudgetTable({ sections, budgetValues, year }: BudgetTableProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set(sections.map((s) => s.id)));
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(
    new Set(sections.flatMap((s) => s.groups.map((g) => g.id)))
  );

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

    return { groupTotals, sectionTotals, grandTotals };
  }, [sections, budgetValues]);

  const { groupTotals, sectionTotals, grandTotals } = calculations;

  return (
    <div className="budget-table-container">
      <table className="budget-table">
        <thead>
          <tr>
            <th className="name-column">Budget Report - {year}</th>
            {MONTHS.map((month, idx) => (
              <th key={idx} className="month-column">
                {month} {year}
              </th>
            ))}
            <th className="total-column">Total</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => {
            const sectionYearTotal = Object.values(sectionTotals[section.id] || {}).reduce((a, b) => a + b, 0);
            const isExpense = section.type === 'expense';

            return (
              <tbody key={section.id} className="section-group">
                {/* Section row */}
                <tr className="section-row">
                  <td className="name-cell">
                    <button className="toggle-btn" onClick={() => toggleSection(section.id)}>
                      {expandedSections.has(section.id) ? '▼' : '▶'}
                    </button>
                    <span className={`section-name ${section.type}`}>{section.name}</span>
                  </td>
                  {MONTHS.map((_, idx) => {
                    const value = sectionTotals[section.id]?.[idx + 1] || 0;
                    return (
                      <td key={idx} className={`value-cell ${value < 0 ? 'expense' : ''}`}>
                        {formatCurrency(Math.abs(value), value < 0)}
                      </td>
                    );
                  })}
                  <td className={`value-cell total ${sectionYearTotal < 0 ? 'expense' : ''}`}>
                    {formatCurrency(Math.abs(sectionYearTotal), sectionYearTotal < 0)}
                  </td>
                </tr>

                {expandedSections.has(section.id) &&
                  section.groups.map((group) => {
                    const groupYearTotal = Object.values(groupTotals[group.id] || {}).reduce((a, b) => a + b, 0);

                    return (
                      <tbody key={group.id} className="group-section">
                        {/* Group row */}
                        <tr className="group-row">
                          <td className="name-cell">
                            <button className="toggle-btn indent-1" onClick={() => toggleGroup(group.id)}>
                              {expandedGroups.has(group.id) ? '▼' : '▶'}
                            </button>
                            <span className="group-name">{group.name}</span>
                          </td>
                          {MONTHS.map((_, idx) => {
                            const value = groupTotals[group.id]?.[idx + 1] || 0;
                            return (
                              <td key={idx} className={`value-cell ${value < 0 ? 'expense' : ''}`}>
                                {formatCurrency(Math.abs(value), value < 0)}
                              </td>
                            );
                          })}
                          <td className={`value-cell total ${groupYearTotal < 0 ? 'expense' : ''}`}>
                            {formatCurrency(Math.abs(groupYearTotal), groupYearTotal < 0)}
                          </td>
                        </tr>

                        {expandedGroups.has(group.id) &&
                          group.components.map((component) => {
                            const componentYearTotal = Array.from({ length: 12 }, (_, i) =>
                              getComponentValue(component.id, i + 1)
                            ).reduce((a, b) => a + b, 0);

                            return (
                              <tr key={component.id} className="component-row">
                                <td className="name-cell">
                                  <span className="component-name">{component.name}</span>
                                </td>
                                {MONTHS.map((_, idx) => {
                                  const value = getComponentValue(component.id, idx + 1);
                                  return (
                                    <td key={idx} className={`value-cell ${isExpense ? 'expense' : ''}`}>
                                      {formatCurrency(value, isExpense)}
                                    </td>
                                  );
                                })}
                                <td className={`value-cell total ${isExpense ? 'expense' : ''}`}>
                                  {formatCurrency(componentYearTotal, isExpense)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    );
                  })}
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
                <td key={idx} className={`value-cell ${value < 0 ? 'expense' : ''}`}>
                  {formatCurrency(Math.abs(value), value < 0)}
                </td>
              );
            })}
            <td className={`value-cell total ${Object.values(grandTotals).reduce((a, b) => a + b, 0) < 0 ? 'expense' : ''}`}>
              {formatCurrency(
                Math.abs(Object.values(grandTotals).reduce((a, b) => a + b, 0)),
                Object.values(grandTotals).reduce((a, b) => a + b, 0) < 0
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
