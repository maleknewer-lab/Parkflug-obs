// Booking length counts CALENDAR days in Europe/Berlin, arrival day and departure day included.
// Using the Berlin calendar date (not 24h blocks, not UTC) keeps the count stable across
// daylight-saving changes and late-evening / early-morning times.

const berlinFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" of the instant, as seen on a wall calendar in Berlin. */
export function berlinDateKey(d: Date): string {
  return berlinFormat.format(d);
}

function keyToUtcDay(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Calendar days from arrival to departure, both days included. Same day = 1. */
export function calendarDaysInclusive(arrival: Date, departure: Date): number {
  const diff = keyToUtcDay(berlinDateKey(departure)) - keyToUtcDay(berlinDateKey(arrival));
  return Math.round(diff / 86_400_000) + 1;
}

// ───────── Wall-clock helpers (datetime-local inputs are Berlin time, the server runs in UTC) ─────────

const partsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function berlinParts(ts: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of partsFormat.formatToParts(new Date(ts))) out[p.type] = p.value;
  return out;
}

/** Berlin's UTC offset (ms) at the given instant. */
function berlinOffsetMs(ts: number): number {
  const p = berlinParts(ts);
  const wallAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return wallAsUtc - Math.floor(ts / 60_000) * 60_000;
}

/** Instant → "YYYY-MM-DDTHH:mm" in Berlin time (value for <input type="datetime-local">). */
export function toBerlinLocalInput(d: Date): string {
  const p = berlinParts(d.getTime());
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * "YYYY-MM-DDTHH:mm" read as Berlin wall-clock time → the real instant.
 * Returns null for malformed input or for times that do not exist (spring DST gap).
 */
export function berlinLocalToDate(local: string): Date | null {
  const value = local.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let ts = wall - berlinOffsetMs(wall);
  ts = wall - berlinOffsetMs(ts);
  const date = new Date(ts);
  return toBerlinLocalInput(date) === value ? date : null;
}

const displayFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "01.12.2026, 10:00" in Berlin time. */
export function formatBerlin(d: Date): string {
  return displayFormat.format(d);
}
