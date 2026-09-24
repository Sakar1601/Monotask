/**
 * Parses a date-only string ("2026-09-24") as local midnight.
 *
 * `new Date("2026-09-24")` is specified as UTC midnight, so in any timezone
 * west of UTC it lands on the previous local day: a task due the 24th was
 * shown as due the 23rd and counted under the wrong weekday. Anything that
 * displays or buckets a stored due date should parse it through here.
 */
export function parseDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

/** Formats a Date as "YYYY-MM-DD" using its local calendar day (not UTC). */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
