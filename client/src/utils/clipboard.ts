export interface ParsedClipboardData {
  values: number[];
  rawValues: string[];
  errors: string[];
  isValid: boolean;
}

/**
 * Parse tab-separated values from clipboard (Excel/Google Sheets format)
 */
export function parseClipboardTSV(text: string): ParsedClipboardData {
  const rawValues: string[] = [];
  const values: number[] = [];
  const errors: string[] = [];

  // Split by tab (TSV from Excel/Sheets)
  const parts = text.trim().split('\t');

  // Validate we have data
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    return {
      values: [],
      rawValues: [],
      errors: ['No data found in clipboard'],
      isValid: false,
    };
  }

  // Parse each value (max 12 for months)
  for (let i = 0; i < parts.length && i < 12; i++) {
    const raw = parts[i].trim();
    rawValues.push(raw);

    // Handle empty cells
    if (raw === '' || raw === '-') {
      values.push(0);
      continue;
    }

    // Clean the value for parsing
    let cleaned = raw
      .replace(/[€$£¥]/g, '')  // Remove currency symbols
      .replace(/\s/g, '');      // Remove whitespace

    // Detect European vs US number format
    // European: 1.234,56 (dot for thousands, comma for decimal)
    // US: 1,234.56 (comma for thousands, dot for decimal)
    const hasCommaDecimal = /,\d{1,2}$/.test(cleaned);
    const hasDotThousands = /\.\d{3}/.test(cleaned);

    if (hasCommaDecimal || hasDotThousands) {
      // European format: remove dots (thousands), replace comma with dot (decimal)
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: remove commas (thousands)
      cleaned = cleaned.replace(/,/g, '');
    }

    // Handle parentheses for negative numbers: (100) → -100
    const parenMatch = cleaned.match(/^\((\d+\.?\d*)\)$/);
    if (parenMatch) {
      cleaned = '-' + parenMatch[1];
    }

    const num = parseFloat(cleaned);

    if (isNaN(num)) {
      errors.push(`Invalid value at position ${i + 1}: "${raw}"`);
      values.push(0);
    } else {
      values.push(num);
    }
  }

  return {
    values,
    rawValues,
    errors,
    isValid: errors.length === 0 && values.length > 0,
  };
}

/**
 * Convert array of values to MonthlyValues object starting from a given month
 */
export function valuesToMonthlyValues(
  values: number[],
  startMonth: number = 1
): { [month: number]: number } {
  const result: { [month: number]: number } = {};
  for (let i = 0; i < values.length && startMonth + i <= 12; i++) {
    result[startMonth + i] = values[i];
  }
  return result;
}
