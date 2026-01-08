import { useState, useEffect } from 'react';
import type { CashflowSettings } from '../../types';
import './SettingsModal.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CashflowSettings;
  onSave: (settings: CashflowSettings) => void;
}

export function SettingsModal({ isOpen, onClose, settings, onSave }: SettingsModalProps) {
  const [balance, setBalance] = useState(settings.starting_balance.toString());
  const [year, setYear] = useState(settings.starting_year);
  const [month, setMonth] = useState(settings.starting_month);

  // Sync with props when modal opens
  useEffect(() => {
    if (isOpen) {
      setBalance(settings.starting_balance.toString());
      setYear(settings.starting_year);
      setMonth(settings.starting_month);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    const numBalance = parseFloat(balance) || 0;
    onSave({
      starting_balance: numBalance,
      starting_year: year,
      starting_month: month,
    });
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Generate year options (current year - 10 to current year + 5)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 16 }, (_, i) => currentYear - 10 + i);

  return (
    <div className="settings-modal-overlay" onClick={handleOverlayClick}>
      <div className="settings-modal">
        <div className="settings-modal-header">
          <h2>Cashflow Settings</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="settings-modal-content">
          <p className="settings-description">
            Set your starting cash balance and the date it applies from.
            The cashflow view will calculate running balances from this point forward.
          </p>

          <div className="settings-form">
            <div className="form-group">
              <label htmlFor="starting-balance">Starting Balance</label>
              <input
                id="starting-balance"
                type="number"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="starting-month">As of Month</label>
                <select
                  id="starting-month"
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                >
                  {MONTHS.map((name, idx) => (
                    <option key={idx} value={idx + 1}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="starting-year">Year</label>
                <select
                  id="starting-year"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="settings-modal-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
