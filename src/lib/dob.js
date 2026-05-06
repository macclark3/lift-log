// Date-of-birth helpers. Date-only fields (YYYY-MM-DD) are parsed manually
// rather than via `new Date(dob)` because that path treats the string as
// UTC midnight and then converts to local time, which can shift the day
// backwards in negative-UTC timezones (e.g. "1999-01-29" displays as
// "January 28" in UTC-4). Manual parsing avoids the timezone round-trip
// entirely.

export const MIN_AGE = 13;

// Returns the user's age in completed years given a YYYY-MM-DD birth date,
// or null if the input is missing/malformed. Compares against today's local
// calendar date — no Date construction from the birth string.
export function ageFromDob(dob) {
  if (!dob) return null;
  const [year, month, day] = String(dob).split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const today = new Date();
  const ty = today.getFullYear();
  const tm = today.getMonth() + 1; // getMonth is 0-indexed
  const td = today.getDate();
  let age = ty - year;
  if (tm < month || (tm === month && td < day)) age--;
  return age;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Format a YYYY-MM-DD date for display. Returns "—" when missing/malformed.
export function formatDateOfBirth(dob) {
  if (!dob) return "—";
  const [year, month, day] = String(dob).split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return "—";
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}
