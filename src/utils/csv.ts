// RFC 4180 field escaping: wrap in quotes whenever the field contains a
// quote, comma, or newline, and double any embedded quotes.
const FORMULA_PREFIXES = new Set(['=', '+', '-', '@']);

function startsWithSpreadsheetFormula(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char.trim() === '' || value.charCodeAt(index) < 32) continue;
    return FORMULA_PREFIXES.has(char);
  }
  return false;
}

export const escapeCsvField = (value: string | number | null | undefined): string => {
  const raw = value === null || value === undefined ? '' : String(value);
  const str = startsWithSpreadsheetFormula(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const toCsvRow = (fields: Array<string | number | null | undefined>): string =>
  fields.map(escapeCsvField).join(',');
