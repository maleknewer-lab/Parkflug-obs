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
