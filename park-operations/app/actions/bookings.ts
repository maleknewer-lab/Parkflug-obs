"use server";

// Booking admin actions (admin + dispo). Every action re-checks access on the server, validates all
// input, recalculates the price on the server and writes an ActivityLog entry.

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { allowedBrandIds, brandAllowed, requireOffice } from "@/lib/booking/auth";
import { generateUniqueBookingCode } from "@/lib/booking";
import { parseBookingForm } from "@/lib/booking/form";
import { breakdownJson, computeBookingPrice } from "@/lib/booking/server";
import { db } from "@/lib/db";

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
