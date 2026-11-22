-- One base price table (seasonId IS NULL) per rate. Prisma cannot express this in schema.prisma.
-- Idempotent: runs on every deploy right after `prisma db push`.
CREATE UNIQUE INDEX IF NOT EXISTS "PriceTable_rateId_base_key"
ON "PriceTable"("rateId") WHERE "seasonId" IS NULL;
