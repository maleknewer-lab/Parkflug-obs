-- Phase 2: per-rate overrides, booking price breakdown, cancellation fields, indexes.

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN "returningDiscountPct" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Rate"
  ADD COLUMN "kidsCountAsPerson" BOOLEAN,
  ADD COLUMN "seatsEnabled" BOOLEAN,
  ADD COLUMN "oversizeSurchargePct" INTEGER;

-- AlterTable
ALTER TABLE "Booking"
  ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "priceBreakdown" JSONB,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelFree" BOOLEAN;

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "ActivityLog_bookingId_idx" ON "ActivityLog"("bookingId");

-- One base price table (seasonId IS NULL) per rate. Prisma cannot express this; added by hand.
CREATE UNIQUE INDEX "PriceTable_rateId_base_key" ON "PriceTable"("rateId") WHERE "seasonId" IS NULL;
