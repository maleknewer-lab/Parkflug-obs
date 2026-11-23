// Booking rules. All limits come from the brand's settings (minLeadHours, freeCancelHours),
// never hard-coded here. Pure functions: "now" is always passed in.

const HOUR_MS = 3_600_000;

/** Online booking needs a minimum lead time (default 2 h, set per brand). */
export function checkLeadTime(arrival: Date, now: Date, minLeadHours: number) {
  const earliestArrival = new Date(now.getTime() + minLeadHours * HOUR_MS);
  return { ok: arrival.getTime() >= earliestArrival.getTime(), earliestArrival };
}

/** Free cancellation up to `freeCancelHours` before arrival (exactly at the limit is still free). */
export function cancellationPolicy(arrival: Date, now: Date, freeCancelHours: number) {
  const deadline = new Date(arrival.getTime() - freeCancelHours * HOUR_MS);
  return {
    free: now.getTime() <= deadline.getTime(),
    deadline,
    hoursBeforeArrival: (arrival.getTime() - now.getTime()) / HOUR_MS,
  };
}

/**
 * Money outcome of a cancellation.
 * free      → everything paid is refunded, nothing owed.
 * not free  → full price stays due, nothing refunded; if not fully paid, the rest is owed.
 */
export function cancellationOutcome(args: {
  priceCents: number;
  paidCents: number;
  free: boolean;
}) {
  const { priceCents, paidCents, free } = args;
  if (free) return { refundCents: paidCents, owedCents: 0 };
  return { refundCents: 0, owedCents: Math.max(0, priceCents - paidCents) };
}
