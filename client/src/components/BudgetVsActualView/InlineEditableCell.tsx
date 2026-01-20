import { useState, useRef, useEffect } from 'react';

// Evaluate simple math expressions like "100+50" or "500-20%"
function evaluateExpression(input: string): number | null {
  const trimmed = input.trim();

  if (!/[+\-*/]/.test(trimmed)) return null;

  // Handle percentage operations: 100+10% → 100 + (100 * 0.10)
  const percentMatch = trimmed.match(/^(\d+\.?\d*)\s*([+\-*/])\s*(\d+\.?\d*)%$/);
  if (percentMatch) {
    const [, base, op, percent] = percentMatch;
    const baseNum = parseFloat(base);
    const percentNum = parseFloat(percent) / 100;
    switch (op) {
      case '+': return baseNum + (baseNum * percentNum);
      case '-': return baseNum - (baseNum * percentNum);
      case '*': return baseNum * percentNum;
      case '/': return percentNum !== 0 ? baseNum / percentNum : null;
    }
  }

  // Handle basic expressions: 100+50, 200*3, etc.
  const basicMatch = trimmed.match(/^(\d+\.?\d*)\s*([+\-*/])\s*(\d+\.?\d*)$/);
  if (basicMatch) {
    const [, left, op, right] = basicMatch;
    const a = parseFloat(left);
    const b = parseFloat(right);
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b !== 0 ? a / b : null;
    }
  }

  return null;
}

interface InlineEditableCellProps {
  value: number;
  isEditable: boolean;
  isHighlighted: boolean;
  onValueChange: (value: number) => void;
  onFocus?: () => void;
}

export function InlineEditableCell({
  value,
  isEditable,
  isHighlighted,
  onValueChange,
  onFocus,
}: InlineEditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditable) return;
    setEditValue(value === 0 ? '' : String(value));
    setIsEditing(true);
    onFocus?.();
  };

  const handleBlur = () => {
    commitValue();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      setEditValue('');
    } else if (e.key === 'Tab') {
      // Allow natural tab navigation
      commitValue();
    }
  };

  const commitValue = () => {
    const evaluated = evaluateExpression(editValue);
    const numValue = evaluated !== null
      ? evaluated
      : (editValue === '' ? 0 : parseFloat(editValue) || 0);

    onValueChange(numValue);
    setIsEditing(false);
    setEditValue('');
  };

  const formatDisplayValue = (val: number): string => {
    if (val === 0) return '-';
    return val.toLocaleString('de-DE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const cellClasses = [
    'inline-editable-cell',
    isEditable ? 'editable' : 'readonly',
    isHighlighted ? 'highlighted' : '',
  ].filter(Boolean).join(' ');

  if (isEditing) {
    return (
      <td className={`${cellClasses} editing`}>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          className="inline-edit-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      </td>
    );
  }

  return (
    <td
      className={cellClasses}
      onClick={handleClick}
      tabIndex={isEditable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isEditable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          setEditValue(value === 0 ? '' : String(value));
          setIsEditing(true);
          onFocus?.();
        }
      }}
    >
      {formatDisplayValue(value)}
    </td>
  );
}
