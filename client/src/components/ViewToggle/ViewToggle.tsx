import './ViewToggle.css';

export type ViewMode = 'budget' | 'cashflow' | 'budget-vs-actual';

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="view-toggle">
      <button
        className={`view-toggle-btn ${viewMode === 'budget' ? 'active' : ''}`}
        onClick={() => onViewModeChange('budget')}
      >
        Budget
      </button>
      <button
        className={`view-toggle-btn ${viewMode === 'cashflow' ? 'active' : ''}`}
        onClick={() => onViewModeChange('cashflow')}
      >
        Cash Flow
      </button>
      <button
        className={`view-toggle-btn ${viewMode === 'budget-vs-actual' ? 'active' : ''}`}
        onClick={() => onViewModeChange('budget-vs-actual')}
      >
        Budget vs Actual
      </button>
    </div>
  );
}
