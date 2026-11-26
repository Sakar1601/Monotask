// Mirrors the password settings of the Supabase project (Authentication, Email provider),
// which is what actually enforces them. These checks only apply when a password is being
// set: signing in must keep accepting passwords created under older rules.
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_HINT = `${PASSWORD_MIN_LENGTH}+ characters, letters and numbers`;

/** Why a new password would be rejected, or null if it meets the rules. */
export function newPasswordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include both letters and numbers';
  }
  return null;
}
