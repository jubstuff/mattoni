import './YearSelector.css';

interface YearSelectorProps {
  year: number;
  onYearChange: (year: number) => void;
}

export function YearSelector({ year, onYearChange }: YearSelectorProps) {
  return (
    <div className="year-selector">
      <button
        className="year-btn"
        onClick={() => onYearChange(year - 1)}
        aria-label="Previous year"
      >
        ◀
      </button>
      <span className="year-display">{year}</span>
      <button
        className="year-btn"
        onClick={() => onYearChange(year + 1)}
        aria-label="Next year"
      >
        ▶
      </button>
    </div>
  );
}
