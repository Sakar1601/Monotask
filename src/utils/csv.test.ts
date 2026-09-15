import { describe, it, expect } from 'vitest';
import { escapeCsvField, toCsvRow } from './csv';

describe('escapeCsvField', () => {
  it('leaves plain values unquoted', () => {
    expect(escapeCsvField('hello')).toBe('hello');
    expect(escapeCsvField(42)).toBe('42');
  });

  it('renders null/undefined as an empty string', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('quotes and escapes a field containing a comma', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes a field containing a newline', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('does not double-escape a field with no special characters', () => {
    expect(escapeCsvField('plain text')).toBe('plain text');
  });

  it('neutralizes spreadsheet formulas before structural CSV escaping', () => {
    expect(escapeCsvField('=IMPORTXML("https://example.com", "//title")')).toBe(
      '"\'=IMPORTXML(""https://example.com"", ""//title"")"',
    );
    expect(escapeCsvField('+SUM(1,2)')).toBe(`"'+SUM(1,2)"`);
    expect(escapeCsvField('-10')).toBe("'-10");
    expect(escapeCsvField('@cmd')).toBe("'@cmd");
  });

  it('neutralizes formulas after leading whitespace and control characters', () => {
    expect(escapeCsvField('  =1+1')).toBe("'  =1+1");
    expect(escapeCsvField('\t@HYPERLINK("https://example.com")')).toBe(
      `"'\t@HYPERLINK(""https://example.com"")"`,
    );
    expect(escapeCsvField('\r+1')).toBe(`"'\r+1"`);
  });
});

describe('toCsvRow', () => {
  it('joins escaped fields with commas', () => {
    expect(toCsvRow(['a', 'b,c', 'd"e'])).toBe('a,"b,c","d""e"');
  });

  it('handles an all-empty row', () => {
    expect(toCsvRow([null, undefined, ''])).toBe(',,');
  });
});
