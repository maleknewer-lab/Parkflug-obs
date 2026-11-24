"use client";

import { useEffect, useRef, useState } from "react";

// Stripe Payment Element. Stripe.js is loaded from js.stripe.com (required by Stripe — card data never
// touches our server). The publishable key and client secret come from the server (brand → payment account).
type StripeElements = { create: (type: "payment") => { mount: (el: HTMLElement) => void }; };
type StripeJs = {
  elements: (o: { clientSecret: string; appearance?: { theme: string } }) => StripeElements;
  confirmPayment: (o: { elements: StripeElements; confirmParams: { return_url: string } }) => Promise<{ error?: { message?: string } }>;
};
declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeJs;
  }
}

function loadStripeJs(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Stripe) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.stripe.com/v3/"]');
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("Stripe.js konnte nicht geladen werden")));
    if (!existing) {
      s.src = "https://js.stripe.com/v3/";
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

export function PaymentForm({
  publishableKey,
  clientSecret,
  brandSlug,
  code,
  amountLabel,
}: {
  publishableKey: string;
  clientSecret: string;
  brandSlug: string;
  code: string;
  amountLabel: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<StripeJs | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadStripeJs()
      .then(() => {
        if (cancelled || !window.Stripe || !mountRef.current) return;
        const stripe = window.Stripe(publishableKey);
        const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const elements = stripe.elements({ clientSecret, appearance: { theme: dark ? "night" : "stripe" } });
        elements.create("payment").mount(mountRef.current);
        stripeRef.current = stripe;
        elementsRef.current = elements;
        setReady(true);
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [publishableKey, clientSecret]);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripeRef.current || !elementsRef.current) return;
    setBusy(true);
    setError(null);
    const { error: err } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      // The booking is confirmed by Stripe's webhook, not by this redirect
      confirmParams: { return_url: `${window.location.origin}/book/${brandSlug}/booked/${code}` },
    });
    // confirmPayment only returns when something went wrong (otherwise the browser is redirected)
    if (err) setError(err.message ?? "Die Zahlung ist fehlgeschlagen. Bitte versuchen Sie es erneut.");
    setBusy(false);
  }

  return (
    <form onSubmit={pay} className="pub-card">
      <div ref={mountRef} />
      {error && <div className="pub-error" role="alert">⚠ {error}</div>}
      <button type="submit" className="pub-btn" disabled={!ready || busy}>
        {busy ? "Zahlung läuft …" : `Jetzt ${amountLabel} bezahlen`}
      </button>
    </form>
  );
}
