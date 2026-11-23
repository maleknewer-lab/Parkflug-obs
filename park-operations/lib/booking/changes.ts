// Booking history: compares old and new values and returns { field: { from, to } }
// in the shape stored in ActivityLog.changes (JSON-safe: Dates become ISO strings).

export type FieldChanges = Record<string, { from: unknown; to: unknown }>;

function jsonSafe(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString();
  return v;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Only fields that are present in `after` AND listed in `fields` are compared, so a partial
 * update never reports untouched fields as changed. null and undefined count as equal.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: readonly (keyof T & string)[],
): FieldChanges {
  const changes: FieldChanges = {};
  for (const field of fields) {
    if (!(field in after)) continue;
    const from = jsonSafe(before[field]);
    const to = jsonSafe(after[field]);
    if (!same(from, to)) changes[field] = { from, to };
  }
  return changes;
}
