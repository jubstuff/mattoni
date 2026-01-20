import { useState, useCallback } from 'react';
import type { Section, BudgetValues, ActualsCutoffSettings, MonthlyValues } from '../../types';
import { updateActualValues, updateActualsCutoff } from '../../api/client';
import { ComparisonTable } from './ComparisonTable';
import { CutoffDatePicker } from './CutoffDatePicker';
import './BudgetVsActualView.css';

interface BudgetVsActualViewProps {
  sections: Section[];
  budgetValues: BudgetValues;
  actualValues: BudgetValues;
  cutoffSettings: ActualsCutoffSettings;
  year: number;
  onDataChange: () => void;
}

export function BudgetVsActualView({
  sections,
  budgetValues,
  actualValues,
  cutoffSettings,
  year,
  onDataChange,
}: BudgetVsActualViewProps) {
  const [highlightedComponentId, setHighlightedComponentId] = useState<number | null>(null);
  const [localCutoff, setLocalCutoff] = useState<ActualsCutoffSettings>(cutoffSettings);
  const [pendingActualChanges, setPendingActualChanges] = useState<Record<number, MonthlyValues>>({});

  const handleActualValueChange = useCallback((componentId: number, month: number, value: number) => {
    setPendingActualChanges((prev) => ({
      ...prev,
      [componentId]: {
        ...prev[componentId],
        [month]: value,
      },
    }));

    // Save immediately
    updateActualValues(componentId, year, { [month]: value })
      .then(() => onDataChange())
      .catch(console.error);
  }, [year, onDataChange]);

  const handleCutoffChange = useCallback((settings: ActualsCutoffSettings) => {
    setLocalCutoff(settings);
    updateActualsCutoff(settings).catch(console.error);
  }, []);

  const handleHighlight = useCallback((componentId: number | null) => {
    setHighlightedComponentId(componentId);
  }, []);

  // Merge pending changes with props for display
  const displayActualValues = { ...actualValues };
  for (const [componentId, changes] of Object.entries(pendingActualChanges)) {
    const id = parseInt(componentId, 10);
    displayActualValues[id] = { ...displayActualValues[id], ...changes };
  }

  return (
    <div className="budget-vs-actual-view">
      <div className="budget-vs-actual-header">
        <h2>Budget vs Actual - {year}</h2>
        <CutoffDatePicker
          settings={localCutoff}
          onChange={handleCutoffChange}
        />
      </div>

      <div className="budget-vs-actual-content single-table">
        <ComparisonTable
          sections={sections}
          budgetValues={budgetValues}
          actualValues={displayActualValues}
          year={year}
          highlightedComponentId={highlightedComponentId}
          onActualValueChange={handleActualValueChange}
          onHighlight={handleHighlight}
        />
      </div>
    </div>
  );
}
