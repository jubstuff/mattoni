import { useState, useMemo, Fragment } from 'react';
import type { Section, BudgetValues } from '../../types';
import { InlineEditableCell } from './InlineEditableCell';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface ComparisonTableProps {
  sections: Section[];
  budgetValues: BudgetValues;
  actualValues: BudgetValues;
  year: number;
  highlightedComponentId: number | null;
  onActualValueChange: (componentId: number, month: number, value: number) => void;
  onHighlight: (componentId: number | null) => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ComparisonTable({
  sections,
  budgetValues,
  actualValues,
  year: _year,
  highlightedComponentId,
  onActualValueChange,
  onHighlight,
}: ComparisonTableProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set(sections.map((s) => s.id))
  );
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

  const getValue = (componentId: number, month: number, type: 'budget' | 'actual'): number => {
    const values = type === 'budget' ? budgetValues : actualValues;
    return values[componentId]?.[month] || 0;
  };

  const getDifference = (componentId: number, month: number, sectionType: 'income' | 'expense'): number => {
    const budget = getValue(componentId, month, 'budget');
    const actual = getValue(componentId, month, 'actual');
    // For expenses: Budget - Actual (positive = under budget = good)
    // For income: Actual - Budget (positive = exceeded target = good)
    return sectionType === 'expense' ? budget - actual : actual - budget;
  };

  // Calculate totals
  const calculations = useMemo(() => {
    const groupTotals: Record<number, { budget: Record<number, number>; actual: Record<number, number> }> = {};
    const sectionTotals: Record<number, { budget: Record<number, number>; actual: Record<number, number> }> = {};

    for (const section of sections) {
      sectionTotals[section.id] = { budget: {}, actual: {} };
      for (let month = 1; month <= 12; month++) {
        sectionTotals[section.id].budget[month] = 0;
        sectionTotals[section.id].actual[month] = 0;
      }

      for (const group of section.groups) {
        if (group.is_disabled) continue;
        groupTotals[group.id] = { budget: {}, actual: {} };
        for (let month = 1; month <= 12; month++) {
          groupTotals[group.id].budget[month] = 0;
          groupTotals[group.id].actual[month] = 0;
        }

        for (const component of group.components) {
          if (component.is_disabled) continue;
          for (let month = 1; month <= 12; month++) {
            const budgetVal = getValue(component.id, month, 'budget');
            const actualVal = getValue(component.id, month, 'actual');
            groupTotals[group.id].budget[month] += budgetVal;
            groupTotals[group.id].actual[month] += actualVal;
            sectionTotals[section.id].budget[month] += budgetVal;
            sectionTotals[section.id].actual[month] += actualVal;
          }
        }
      }
    }

    return { groupTotals, sectionTotals };
  }, [sections, budgetValues, actualValues]);

  const renderDifferenceCell = (diff: number, key?: string | number) => {
    const isFavorable = diff > 0;
    const className = diff === 0 ? 'diff-neutral' : (isFavorable ? 'diff-favorable' : 'diff-unfavorable');
    const prefix = diff > 0 ? '+' : '';
    return (
      <td key={key} className={`diff-cell ${className}`}>
        {diff === 0 ? '-' : `${prefix}${formatCurrency(diff)}`}
      </td>
    );
  };

  return (
    <div className="comparison-table-wrapper">
      <div className="comparison-table-scroll">
        <table className="comparison-table">
          <thead>
            <tr>
              <th className="name-column sticky-col">Category</th>
              <th className="row-type-column">Type</th>
              {MONTHS.map((month) => (
                <th key={month} className="month-column">{month}</th>
              ))}
              <th className="total-column">Total</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => {
              const isSectionExpanded = expandedSections.has(section.id);
              const sectionBudgetTotal = Object.values(calculations.sectionTotals[section.id]?.budget || {}).reduce((a, b) => a + b, 0);
              const sectionActualTotal = Object.values(calculations.sectionTotals[section.id]?.actual || {}).reduce((a, b) => a + b, 0);
              const sectionDiffTotal = section.type === 'expense'
                ? sectionBudgetTotal - sectionActualTotal
                : sectionActualTotal - sectionBudgetTotal;

              return (
                <Fragment key={section.id}>
                  {/* Section Header - Budget row */}
                  <tr className={`section-row ${section.type}`}>
                    <td
                      className="name-column sticky-col section-name"
                      onClick={() => toggleSection(section.id)}
                    >
                      <span className="expand-icon">{isSectionExpanded ? '▼' : '▶'}</span>
                      {section.name}
                    </td>
                    <td className="row-type-column type-budget">Budget</td>
                    {MONTHS.map((_, idx) => (
                      <td key={idx} className="section-total-cell">
                        {formatCurrency(calculations.sectionTotals[section.id]?.budget[idx + 1] || 0)}
                      </td>
                    ))}
                    <td className="section-total-cell total-column">
                      {formatCurrency(sectionBudgetTotal)}
                    </td>
                  </tr>
                  {/* Section - Actual row */}
                  <tr className={`section-row ${section.type}`}>
                    <td className="name-column sticky-col"></td>
                    <td className="row-type-column type-actual">Actual</td>
                    {MONTHS.map((_, idx) => (
                      <td key={idx} className="section-total-cell">
                        {formatCurrency(calculations.sectionTotals[section.id]?.actual[idx + 1] || 0)}
                      </td>
                    ))}
                    <td className="section-total-cell total-column">
                      {formatCurrency(sectionActualTotal)}
                    </td>
                  </tr>
                  {/* Section - Diff row */}
                  <tr className={`section-row ${section.type} diff-row`}>
                    <td className="name-column sticky-col"></td>
                    <td className="row-type-column type-diff">Diff</td>
                    {MONTHS.map((_, idx) => {
                      const diff = section.type === 'expense'
                        ? (calculations.sectionTotals[section.id]?.budget[idx + 1] || 0) - (calculations.sectionTotals[section.id]?.actual[idx + 1] || 0)
                        : (calculations.sectionTotals[section.id]?.actual[idx + 1] || 0) - (calculations.sectionTotals[section.id]?.budget[idx + 1] || 0);
                      return renderDifferenceCell(diff, idx);
                    })}
                    {renderDifferenceCell(sectionDiffTotal)}
                  </tr>

                  {/* Groups and Components */}
                  {isSectionExpanded && section.groups.filter((g) => !g.is_disabled).map((group) => {
                    const isGroupExpanded = expandedGroups.has(group.id);
                    const groupBudgetTotal = Object.values(calculations.groupTotals[group.id]?.budget || {}).reduce((a, b) => a + b, 0);
                    const groupActualTotal = Object.values(calculations.groupTotals[group.id]?.actual || {}).reduce((a, b) => a + b, 0);
                    const groupDiffTotal = section.type === 'expense'
                      ? groupBudgetTotal - groupActualTotal
                      : groupActualTotal - groupBudgetTotal;

                    return (
                      <Fragment key={group.id}>
                        {/* Group Header - Budget */}
                        <tr className="group-row">
                          <td
                            className="name-column sticky-col group-name"
                            onClick={() => toggleGroup(group.id)}
                          >
                            <span className="expand-icon">{isGroupExpanded ? '▼' : '▶'}</span>
                            {group.name}
                          </td>
                          <td className="row-type-column type-budget">Budget</td>
                          {MONTHS.map((_, idx) => (
                            <td key={idx} className="group-total-cell">
                              {formatCurrency(calculations.groupTotals[group.id]?.budget[idx + 1] || 0)}
                            </td>
                          ))}
                          <td className="group-total-cell total-column">
                            {formatCurrency(groupBudgetTotal)}
                          </td>
                        </tr>
                        {/* Group - Actual */}
                        <tr className="group-row">
                          <td className="name-column sticky-col"></td>
                          <td className="row-type-column type-actual">Actual</td>
                          {MONTHS.map((_, idx) => (
                            <td key={idx} className="group-total-cell">
                              {formatCurrency(calculations.groupTotals[group.id]?.actual[idx + 1] || 0)}
                            </td>
                          ))}
                          <td className="group-total-cell total-column">
                            {formatCurrency(groupActualTotal)}
                          </td>
                        </tr>
                        {/* Group - Diff */}
                        <tr className="group-row diff-row">
                          <td className="name-column sticky-col"></td>
                          <td className="row-type-column type-diff">Diff</td>
                          {MONTHS.map((_, idx) => {
                            const diff = section.type === 'expense'
                              ? (calculations.groupTotals[group.id]?.budget[idx + 1] || 0) - (calculations.groupTotals[group.id]?.actual[idx + 1] || 0)
                              : (calculations.groupTotals[group.id]?.actual[idx + 1] || 0) - (calculations.groupTotals[group.id]?.budget[idx + 1] || 0);
                            return renderDifferenceCell(diff, idx);
                          })}
                          {renderDifferenceCell(groupDiffTotal)}
                        </tr>

                        {/* Components */}
                        {isGroupExpanded && group.components.filter((c) => !c.is_disabled).map((component) => {
                          const isHighlighted = highlightedComponentId === component.id;
                          const componentBudgetTotal = Array.from({ length: 12 }, (_, i) => getValue(component.id, i + 1, 'budget')).reduce((a, b) => a + b, 0);
                          const componentActualTotal = Array.from({ length: 12 }, (_, i) => getValue(component.id, i + 1, 'actual')).reduce((a, b) => a + b, 0);
                          const componentDiffTotal = section.type === 'expense'
                            ? componentBudgetTotal - componentActualTotal
                            : componentActualTotal - componentBudgetTotal;

                          return (
                            <Fragment key={component.id}>
                              {/* Budget row - read only */}
                              <tr
                                className={`component-row budget-row ${isHighlighted ? 'highlighted' : ''}`}
                                onClick={() => onHighlight(component.id)}
                              >
                                <td className="name-column sticky-col component-name">
                                  {component.name}
                                </td>
                                <td className="row-type-column type-budget">Budget</td>
                                {MONTHS.map((_, idx) => (
                                  <td key={idx} className="value-cell">
                                    {getValue(component.id, idx + 1, 'budget') === 0
                                      ? '-'
                                      : formatCurrency(getValue(component.id, idx + 1, 'budget'))}
                                  </td>
                                ))}
                                <td className="total-cell">{formatCurrency(componentBudgetTotal)}</td>
                              </tr>
                              {/* Actual row - editable */}
                              <tr className={`component-row actual-row ${isHighlighted ? 'highlighted' : ''}`}>
                                <td className="name-column sticky-col"></td>
                                <td className="row-type-column type-actual">Actual</td>
                                {MONTHS.map((_, idx) => (
                                  <InlineEditableCell
                                    key={idx}
                                    value={getValue(component.id, idx + 1, 'actual')}
                                    isEditable={true}
                                    isHighlighted={isHighlighted}
                                    onValueChange={(value) => onActualValueChange(component.id, idx + 1, value)}
                                    onFocus={() => onHighlight(component.id)}
                                  />
                                ))}
                                <td className="total-cell">{formatCurrency(componentActualTotal)}</td>
                              </tr>
                              {/* Difference row */}
                              <tr className={`component-row diff-row ${isHighlighted ? 'highlighted' : ''}`}>
                                <td className="name-column sticky-col"></td>
                                <td className="row-type-column type-diff">Diff</td>
                                {MONTHS.map((_, idx) => {
                                  const diff = getDifference(component.id, idx + 1, section.type);
                                  return renderDifferenceCell(diff, idx);
                                })}
                                {renderDifferenceCell(componentDiffTotal)}
                              </tr>
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
