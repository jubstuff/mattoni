import type { ParsedClipboardData } from '../../utils/clipboard';
import './PastePreviewModal.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface PastePreviewModalProps {
  isOpen: boolean;
  data: ParsedClipboardData;
  startMonth: number;
  currentValues: { [month: number]: number };
  onConfirm: () => void;
  onCancel: () => void;
}

export function PastePreviewModal({
  isOpen,
  data,
  startMonth,
  currentValues,
  onConfirm,
  onCancel,
}: PastePreviewModalProps) {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  // Calculate which months will be affected
  const affectedMonths = data.values
    .map((_, i) => startMonth + i)
    .filter((m) => m <= 12);

  const formatValue = (value: number) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="paste-modal-overlay" onClick={handleOverlayClick}>
      <div className="paste-modal">
        <div className="paste-modal-header">
          <h2>Paste Values Preview</h2>
          <button className="close-btn" onClick={onCancel}>
            &times;
          </button>
        </div>

        <div className="paste-modal-content">
          {data.errors.length > 0 && (
            <div className="paste-warnings">
              <p className="warning-title">Warnings:</p>
              <ul>
                {data.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="paste-description">
            {affectedMonths.length} value{affectedMonths.length !== 1 ? 's' : ''} will be applied
            starting from {MONTHS[startMonth - 1]}:
          </p>

          <table className="paste-preview-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Current</th>
                <th>New Value</th>
              </tr>
            </thead>
            <tbody>
              {affectedMonths.map((month, i) => (
                <tr key={month}>
                  <td>{MONTHS[month - 1]}</td>
                  <td className="current-value">{formatValue(currentValues[month] || 0)}</td>
                  <td className="new-value">{formatValue(data.values[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.values.length < 12 && startMonth === 1 && (
            <p className="paste-note">
              Note: Only {data.values.length} value{data.values.length !== 1 ? 's' : ''} provided.
              Remaining months will be unchanged.
            </p>
          )}

          {startMonth > 1 && (
            <p className="paste-note">
              Values will be applied starting from {MONTHS[startMonth - 1]} (selected cell).
            </p>
          )}
        </div>

        <div className="paste-modal-footer">
          <button className="cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="confirm-btn" onClick={onConfirm}>
            Apply {affectedMonths.length} Value{affectedMonths.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
