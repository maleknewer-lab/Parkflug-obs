// Query building for the bookings list and the customers list (search, filters, paging).
// Pure: turns URL parameters into validated filters and Prisma "where" objects. Unit-tested.
import type { Prisma } from "@prisma/client";
import { berlinDateKey, berlinLocalToDate } from "../pricing/dates";

export const PAGE_SIZE = 25;
/** A customer with this many (non-cancelled) bookings is flagged "Stammkunde". */
export const RETURNING_MIN_BOOKINGS = 2;

export type RawParams = Record<string, string | string[] | undefined>;

export type BookingScope = "upcoming" | "past" | "all";

export type ListFilters = {
  q: string;
  tokens: string[];
  brandId: string | null;
  status: "unconfirmed" | "confirmed" | "cancelled" | null;
  paid: "paid" | "open" | null;
  scope: BookingScope;
  dateField: "arrival" | "departure";
  from: string | null; // YYYY-MM-DD (Berlin day)
  to: string | null;
  customerId: string | null;
  page: number;
};

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

function idOrNull(v: string): string | null {
  return /^[A-Za-z0-9]{8,40}$/.test(v) ? v : null;
}

function dayOrNull(v: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && berlinLocalToDate(`${v}T00:00`) !== null ? v : null;
}

/** Search words: whitespace separated, at most 5 words of at most 40 characters. */
export function searchTokens(q: string): string[] {
  return q.split(/\s+/).filter(Boolean).slice(0, 5).map((t) => t.slice(0, 40));
}

export function parsePage(v: string): number {
  const n = /^\d{1,5}$/.test(v) ? Number(v) : 1;
  return n >= 1 ? n : 1;
}

export function parseListParams(sp: RawParams): ListFilters {
  const q = one(sp.q).slice(0, 100);
  const status = one(sp.status);
  const paid = one(sp.paid);
  const from = dayOrNull(one(sp.from));
  const to = dayOrNull(one(sp.to));
  const customerId = idOrNull(one(sp.customer));
  const scopeRaw = one(sp.scope);
  // Searching (or looking at one customer / a date range) should find old bookings too
  const scope: BookingScope =
    scopeRaw === "upcoming" || scopeRaw === "past" || scopeRaw === "all"
      ? scopeRaw
      : q || customerId || from || to
        ? "all"
        : "upcoming";
  return {
    q,
    tokens: searchTokens(q),
    brandId: idOrNull(one(sp.brand)),
    status: status === "unconfirmed" || status === "confirmed" || status === "cancelled" ? status : null,
    paid: paid === "paid" || paid === "open" ? paid : null,
    scope,
    dateField: one(sp.field) === "departure" ? "departure" : "arrival",
    from,
    to,
    customerId,
    page: parsePage(one(sp.page)),
  };
}

/** Midnight (Berlin) at the start of the day the instant falls on. */
export function berlinDayStart(d: Date): Date {
  return berlinLocalToDate(`${berlinDateKey(d)}T00:00`) ?? d;
}

function nextDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

const text = (t: string) => ({ contains: t, mode: "insensitive" as const });

export function buildBookingWhere(
  f: ListFilters,
  ctx: { allowedBrandIds: string[] | "all"; now: Date },
): Prisma.BookingWhereInput {
  const and: Prisma.BookingWhereInput[] = [];

  if (ctx.allowedBrandIds !== "all") and.push({ brandId: { in: ctx.allowedBrandIds } });
  if (f.brandId) and.push({ brandId: f.brandId });
  if (f.status) and.push({ status: f.status });
  if (f.paid) and.push({ paid: f.paid === "paid" });
  if (f.customerId) and.push({ customerId: f.customerId });

  for (const t of f.tokens) {
    and.push({
      OR: [
        { code: text(t) },
        { plate: text(t) },
        { externalRef: text(t) },
        {
          customer: {
            is: {
              OR: [
                { firstName: text(t) },
                { lastName: text(t) },
                { email: text(t) },
                { phone: text(t) },
                { company: text(t) },
              ],
            },
          },
        },
      ],
    });
  }

  const field = f.dateField === "departure" ? "departureAt" : "arrivalAt";
  if (f.from || f.to) {
    const range: { gte?: Date; lt?: Date } = {};
    if (f.from) range.gte = berlinLocalToDate(`${f.from}T00:00`) ?? undefined;
    if (f.to) range.lt = berlinLocalToDate(`${nextDayKey(f.to)}T00:00`) ?? undefined;
    and.push({ [field]: range } as Prisma.BookingWhereInput);
  } else if (f.scope !== "all") {
    const today = berlinDayStart(ctx.now);
    and.push({ departureAt: f.scope === "upcoming" ? { gte: today } : { lt: today } });
  }

  return { AND: and };
}

export function buildBookingOrderBy(f: ListFilters): Prisma.BookingOrderByWithRelationInput[] {
  const upcoming = f.scope === "upcoming" && !f.from && !f.to;
  return upcoming
    ? [{ arrivalAt: "asc" }, { createdAt: "asc" }]
    : [{ arrivalAt: "desc" }, { createdAt: "desc" }];
}

export function buildCustomerWhere(
  q: string,
  allowedBrandIds: string[] | "all",
): Prisma.CustomerWhereInput {
  const and: Prisma.CustomerWhereInput[] = [];
  // Users limited to some brands only see customers who booked one of those brands
  if (allowedBrandIds !== "all") and.push({ bookings: { some: { brandId: { in: allowedBrandIds } } } });
  for (const t of searchTokens(q)) {
    and.push({
      OR: [
        { firstName: text(t) },
        { lastName: text(t) },
        { email: text(t) },
        { phone: text(t) },
        { company: text(t) },
      ],
    });
  }
  return { AND: and };
}
