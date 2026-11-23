"use server";

// Booking admin actions (admin + dispo). Every action re-checks access on the server, validates all
// input, recalculates the price on the server and writes an ActivityLog entry.

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { allowedBrandIds, brandAllowed, requireOffice } from "@/lib/booking/auth";
import {
  cancellationOutcome,
  cancellationPolicy,
  diffFields,
  generateUniqueBookingCode,
} from "@/lib/booking";
import { parseBookingForm } from "@/lib/booking/form";
import { breakdownJson, computeBookingPrice, recomputeStoredBooking } from "@/lib/booking/server";
import { manualPriceOf } from "@/lib/booking/values";
import { db } from "@/lib/db";
import { priceDifference } from "@/lib/pricing";
import { formatEuro } from "@/lib/rates/form";

function text(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

function back(path: string, kind: "saved" | "error", message = "1"): never {
  revalidatePath("/admin/bookings");
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}

export async function createBookingAction(fd: FormData) {
  const me = await requireOffice();
  const rateId = text(fd, "rateId");
  const formPath = `/admin/bookings/new?rateId=${encodeURIComponent(rateId)}`;

  const rate = await db.rate.findUnique({
    where: { id: rateId },
    select: { id: true, brandId: true, brand: { select: { extras: { select: { id: true } } } } },
  });
  if (!rate) back("/admin/bookings/new", "error", "Tarif nicht gefunden");
  if (!brandAllowed(await allowedBrandIds(me.id), rate.brandId)) {
    back("/admin/bookings/new", "error", "Kein Zugriff auf diese Marke");
  }

  const parsed = parseBookingForm((n) => text(fd, n), { extraIds: rate.brand.extras.map((e) => e.id) });
  if (!parsed.ok) back(formPath, "error", parsed.error);
  const d = parsed.data;

  const priced = await computeBookingPrice({ rateId, data: d, now: new Date() });
  if (!priced.ok) back(formPath, "error", priced.error);
  const priceCents = d.manualPriceCents ?? priced.result.totalCents;

  const code = await generateUniqueBookingCode(
    async (c) => (await db.booking.findUnique({ where: { code: c }, select: { id: true } })) !== null,
  );

  const booking = await db.$transaction(async (tx) => {
    // Same e-mail (case-insensitive) = same customer
    let customer = await tx.customer.findFirst({ where: { email: { equals: d.email, mode: "insensitive" } } });
    if (!customer) {
      customer = await tx.customer.create({
        data: { firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone, company: d.company },
      });
    } else if (!customer.phone && d.phone) {
      customer = await tx.customer.update({ where: { id: customer.id }, data: { phone: d.phone } });
    }

    return tx.booking.create({
      data: {
        code,
        brandId: priced.brandId,
        customerId: customer.id,
        rateId,
        status: d.status,
        arrivalAt: d.arrivalAt,
        departureAt: d.departureAt,
        outboundFlight: d.outboundFlight,
        returnFlight: d.returnFlight,
        adults: d.adults,
        kids: d.kids,
        seatBaby: d.seatBaby,
        seatKind: d.seatKind,
        seatBoost: d.seatBoost,
        plate: d.plate,
        vehicle: d.vehicle,
        oversize: d.oversize,
        priceCents,
        discountCents: priced.result.discountCents,
        priceBreakdown: breakdownJson(priced.result, d.manualPriceCents),
        paid: d.paid,
        paymentMethod: d.paymentMethod,
        couponId: priced.couponId,
        customerNote: d.customerNote,
        internalNote: d.internalNote,
        billingCompany: d.billingCompany,
        billingContact: d.billingContact,
        billingAddress: d.billingAddress,
        billingVatId: d.billingVatId,
        source: d.source,
        externalRef: d.externalRef,
        commissionCents: d.commissionCents,
        extras: {
          create: priced.extras.map((e) => ({ extraId: e.extraId, quantity: e.quantity, priceCents: e.priceCents })),
        },
      },
    });
  });

  await db.activityLog.create({
    data: {
      userId: me.id,
      bookingId: booking.id,
      entity: "Booking",
      entityId: booking.id,
      action: "create",
      changes: {
        status: { from: null, to: booking.status },
        priceCents: { from: null, to: priceCents },
        arrivalAt: { from: null, to: d.arrivalAt.toISOString() },
        departureAt: { from: null, to: d.departureAt.toISOString() },
      } as unknown as Prisma.InputJsonObject,
    },
  });

  back(`/admin/bookings/${booking.id}`, "saved", `Buchung ${booking.code} angelegt`);
}

// ───────── Shared helpers for edit / price / cancel ─────────

async function loadBooking(id: string, userId: string) {
  const booking = await db.booking.findUnique({
    where: { id },
    include: { brand: true, customer: true, coupon: true, extras: { include: { extra: true } } },
  });
  if (!booking) back("/admin/bookings", "error", "Buchung nicht gefunden");
  if (!brandAllowed(await allowedBrandIds(userId), booking.brandId)) {
    back("/admin/bookings", "error", "Kein Zugriff auf diese Marke");
  }
  return booking;
}

async function log(
  userId: string,
  bookingId: string,
  action: string,
  changes: Record<string, { from: unknown; to: unknown }>,
) {
  await db.activityLog.create({
    data: {
      userId,
      bookingId,
      entity: "Booking",
      entityId: bookingId,
      action,
      changes: changes as unknown as Prisma.InputJsonObject,
    },
  });
}

const BOOKING_FIELDS = [
  "rateId", "status", "arrivalAt", "departureAt", "outboundFlight", "returnFlight",
  "adults", "kids", "seatBaby", "seatKind", "seatBoost", "plate", "vehicle", "oversize",
  "paid", "paymentMethod", "couponId", "customerNote", "internalNote",
  "billingCompany", "billingContact", "billingAddress", "billingVatId",
  "source", "externalRef", "commissionCents",
] as const;

const CUSTOMER_FIELDS = ["firstName", "lastName", "email", "phone", "company"] as const;

// ───────── Edit ─────────
// Saves every field. The PRICE is not changed automatically: the booking page shows the re-calculated
// price and the difference, and staff decide ("Neuen Preis übernehmen"). Only an explicitly typed
// manual price is applied right away.
export async function updateBookingAction(fd: FormData) {
  const me = await requireOffice();
  const id = text(fd, "id");
  const path = `/admin/bookings/${id}`;
  const booking = await loadBooking(id, me.id);
  if (booking.status === "cancelled") back(path, "error", "Stornierte Buchungen können nicht bearbeitet werden");

  const rateId = text(fd, "rateId") || booking.rateId;
  if (rateId !== booking.rateId) {
    const r = await db.rate.findUnique({ where: { id: rateId }, select: { brandId: true, active: true } });
    if (!r || r.brandId !== booking.brandId) back(path, "error", "Der Tarif gehört nicht zu dieser Marke");
    if (!r.active) back(path, "error", "Der gewählte Tarif ist nicht aktiv");
  }

  const brandExtras = await db.extra.findMany({ where: { brandId: booking.brandId }, select: { id: true } });
  const parsed = parseBookingForm((n) => text(fd, n), {
    extraIds: brandExtras.map((e) => e.id),
    allowSystemValues: true,
  });
  if (!parsed.ok) back(path, "error", parsed.error);
  const d = parsed.data;

  // Values that only the system may set must not be introduced by hand
  if (d.paymentMethod === "ONLINE" && booking.paymentMethod !== "ONLINE") back(path, "error", "Zahlart „Online“ kann nicht manuell gesetzt werden");
  if (d.source === "WEBSITE" && booking.source !== "WEBSITE") back(path, "error", "Quelle „Website“ kann nicht manuell gesetzt werden");

  const couponChanged = (d.couponCode ?? null) !== (booking.coupon?.code ?? null);
  const priced = await computeBookingPrice({
    rateId,
    data: d,
    keepExtraPrices: new Map(booking.extras.map((e) => [e.extraId, e.priceCents])),
    allowInactive: true,
    now: couponChanged ? new Date() : booking.createdAt,
  });
  if (!priced.ok) back(path, "error", priced.error);

  const next = {
    rateId,
    status: d.status,
    arrivalAt: d.arrivalAt,
    departureAt: d.departureAt,
    outboundFlight: d.outboundFlight,
    returnFlight: d.returnFlight,
    adults: d.adults,
    kids: d.kids,
    seatBaby: d.seatBaby,
    seatKind: d.seatKind,
    seatBoost: d.seatBoost,
    plate: d.plate,
    vehicle: d.vehicle,
    oversize: d.oversize,
    paid: d.paid,
    paymentMethod: d.paymentMethod,
    couponId: priced.couponId,
    customerNote: d.customerNote,
    internalNote: d.internalNote,
    billingCompany: d.billingCompany,
    billingContact: d.billingContact,
    billingAddress: d.billingAddress,
    billingVatId: d.billingVatId,
    source: d.source,
    externalRef: d.externalRef,
    commissionCents: d.commissionCents,
  };
  const customerNext = {
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email,
    phone: d.phone,
    company: d.company,
  };

  const changes = diffFields(booking, next, BOOKING_FIELDS);
  const customerChanges = diffFields(booking.customer, customerNext, CUSTOMER_FIELDS);
  for (const [k, c] of Object.entries(customerChanges)) changes[`customer.${k}`] = c;

  const before = booking.extras.map((e) => `${e.extra.name} ×${e.quantity}`).sort();
  const after = priced.extras.map((e) => `${e.name} ×${e.quantity}`).sort();
  if (JSON.stringify(before) !== JSON.stringify(after)) changes.extras = { from: before, to: after };

  // An explicitly typed manual price is applied immediately
  const storedManual = manualPriceOf(booking.priceBreakdown);
  let priceUpdate: { priceCents: number; discountCents: number; priceBreakdown: Prisma.InputJsonObject } | null = null;
  if (d.manualPriceCents !== null && d.manualPriceCents !== storedManual) {
    priceUpdate = {
      priceCents: d.manualPriceCents,
      discountCents: priced.result.discountCents,
      priceBreakdown: breakdownJson(priced.result, d.manualPriceCents),
    };
    changes.priceCents = { from: booking.priceCents, to: priceUpdate.priceCents };
  }

  if (Object.keys(changes).length === 0) back(path, "saved", "Keine Änderungen");

  await db.$transaction(async (tx) => {
    if (Object.keys(customerChanges).length > 0) {
      await tx.customer.update({ where: { id: booking.customerId }, data: customerNext });
    }
    await tx.booking.update({
      where: { id },
      data: {
        ...next,
        ...(priceUpdate ?? {}),
        extras: {
          deleteMany: {},
          create: priced.extras.map((e) => ({ extraId: e.extraId, quantity: e.quantity, priceCents: e.priceCents })),
        },
      },
    });
  });
  await log(me.id, id, "update", changes);
  back(path, "saved", "Änderungen gespeichert");
}

// ───────── Apply the re-calculated price ─────────
export async function applyPriceAction(fd: FormData) {
  const me = await requireOffice();
  const id = text(fd, "id");
  const path = `/admin/bookings/${id}`;
  const booking = await loadBooking(id, me.id);
  if (booking.status === "cancelled") back(path, "error", "Stornierte Buchungen können nicht geändert werden");

  const priced = await recomputeStoredBooking(booking);
  if (!priced.ok) back(path, "error", priced.error);
  const priceCents = priced.result.totalCents;
  if (priceCents === booking.priceCents && manualPriceOf(booking.priceBreakdown) === null) {
    back(path, "saved", "Preis ist bereits aktuell");
  }

  await db.booking.update({
    where: { id },
    data: {
      priceCents,
      discountCents: priced.result.discountCents,
      priceBreakdown: breakdownJson(priced.result, null),
    },
  });
  await log(me.id, id, "apply_price", {
    priceCents: { from: booking.priceCents, to: priceCents },
    manualPriceCents: { from: manualPriceOf(booking.priceBreakdown), to: null },
  });
  const diff = priceDifference(booking.priceCents, priceCents);
  const hint =
    booking.paid && diff.kind === "extra_payment" ? " – Nachzahlung kassieren"
    : booking.paid && diff.kind === "refund" ? " – Differenz erstatten"
    : "";
  back(path, "saved", `Neuer Preis ${formatEuro(priceCents)} € übernommen${hint}`);
}

// ───────── Cancel ─────────
export async function cancelBookingAction(fd: FormData) {
  const me = await requireOffice();
  const id = text(fd, "id");
  const path = `/admin/bookings/${id}`;
  const booking = await loadBooking(id, me.id);
  if (booking.status === "cancelled") back(path, "error", "Buchung ist bereits storniert");
  if (booking.transferStatus !== "expected") back(path, "error", "Das Fahrzeug ist bereits angekommen – Stornierung nicht möglich");

  const reason = text(fd, "reason");
  if (reason.length > 200) back(path, "error", "Grund: höchstens 200 Zeichen");

  const now = new Date();
  const policy = cancellationPolicy(booking.arrivalAt, now, booking.brand.freeCancelHours);
  const waived = fd.get("waive") === "on";
  const free = policy.free || waived;
  const outcome = cancellationOutcome({
    priceCents: booking.priceCents,
    paidCents: booking.paid ? booking.priceCents : 0,
    free,
  });

  // A refunded booking no longer counts as paid (revenue reports use the paid flag)
  const paid = free && outcome.refundCents > 0 ? false : booking.paid;
  await db.booking.update({
    where: { id },
    data: { status: "cancelled", cancelledAt: now, cancelFree: free, paid },
  });
  await log(me.id, id, "cancel", {
    status: { from: booking.status, to: "cancelled" },
    cancelFree: { from: null, to: free },
    ...(waived && !policy.free ? { waived: { from: null, to: true } } : {}),
    ...(paid !== booking.paid ? { paid: { from: booking.paid, to: paid } } : {}),
    refundCents: { from: null, to: outcome.refundCents },
    owedCents: { from: null, to: outcome.owedCents },
    ...(reason ? { reason: { from: null, to: reason } } : {}),
  });

  const online = booking.paymentMethod === "ONLINE" && outcome.refundCents > 0;
  const message = free
    ? outcome.refundCents > 0
      ? `Storniert (kostenlos). Rückzahlung: ${formatEuro(outcome.refundCents)} €${online ? " – Stripe-Erstattung bitte manuell veranlassen (automatisch ab Phase 3)" : ""}`
      : "Storniert (kostenlos)"
    : `Storniert nach Frist – keine Erstattung${outcome.owedCents > 0 ? `, offen: ${formatEuro(outcome.owedCents)} €` : ""}`;
  back(path, "saved", message);
}
