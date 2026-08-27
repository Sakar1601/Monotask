// RFC 4180 field escaping: wrap in quotes whenever the field contains a
// quote, comma, or newline, and double any embedded quotes.
export const escapeCsvField = (value: string | number | null | undefined): string => {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const toCsvRow = (fields: Array<string | number | null | undefined>): string =>
  fields.map(escapeCsvField).join(',');
