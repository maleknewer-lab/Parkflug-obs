import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { optionalStaff } from "@/lib/staff-optional";
import { PublicHeader } from "../_components/public-header";

// Header for every public page of a brand (price/booking, payment, confirmation).
export default async function BrandLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ brand: string }>;
}) {
  const { brand: slug } = await params;
  const brand = await db.brand.findFirst({ where: { slug, active: true }, select: { name: true } });
  if (!brand) notFound();
  const staff = await optionalStaff();
  return (
    <>
      <PublicHeader brandName={brand.name} staff={staff} />
      {children}
    </>
  );
}
