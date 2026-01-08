import './ViewToggle.css';

export type ViewMode = 'budget' | 'cashflow';

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
        Cashflow
      </button>
    </div>
  );
}
