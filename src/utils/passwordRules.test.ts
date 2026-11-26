import { describe, expect, it } from 'vitest';
import { newPasswordProblem } from './passwordRules';

describe('newPasswordProblem', () => {
  it.each(['abcde1234', 'abc123', ''])('rejects %j as too short', (password) => {
    expect(newPasswordProblem(password)).toMatch(/at least 10 characters/);
  });

  it.each(['abcdefghij', '1234567890', '!!!!!!!!!1'])('rejects %j for missing letters or numbers', (password) => {
    expect(newPasswordProblem(password)).toMatch(/letters and numbers/);
  });

  it.each(['abcdefghi1', 'ABCDEFGHI1', 'correct horse battery 9'])('accepts %j', (password) => {
    expect(newPasswordProblem(password)).toBeNull();
  });
});
