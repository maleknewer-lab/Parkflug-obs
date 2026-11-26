import { redirect } from "next/navigation";

// The booking is now one page (/book/<brand>). Old links to the two-step checkout land there.
export default async function CheckoutRedirect({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  redirect(`/book/${brand}`);
}
