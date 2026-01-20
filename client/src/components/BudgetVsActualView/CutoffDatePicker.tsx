import type { ActualsCutoffSettings } from '../../types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface CutoffDatePickerProps {
  settings: ActualsCutoffSettings;
  onChange: (settings: ActualsCutoffSettings) => void;
}

export function CutoffDatePicker({ settings, onChange }: CutoffDatePickerProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...settings,
      cutoff_month: parseInt(e.target.value, 10),
    });
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...settings,
      cutoff_year: parseInt(e.target.value, 10),
    });
  };

  return (
    <div className="cutoff-date-picker">
      <span className="cutoff-label">Actuals reviewed up to:</span>
      <select
        className="cutoff-select"
        value={settings.cutoff_month}
        onChange={handleMonthChange}
      >
        {MONTHS.map((name, idx) => (
          <option key={idx} value={idx + 1}>{name}</option>
        ))}
      </select>
      <select
        className="cutoff-select"
        value={settings.cutoff_year}
        onChange={handleYearChange}
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}
