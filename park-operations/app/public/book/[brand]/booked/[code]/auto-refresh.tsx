"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// While an online payment is being confirmed by Stripe (usually a few seconds), re-read the page.
export function AutoRefresh({ everyMs = 3000, maxTries = 20 }: { everyMs?: number; maxTries?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      n++;
      router.refresh();
      if (n >= maxTries) clearInterval(t);
    }, everyMs);
    return () => clearInterval(t);
  }, [router, everyMs, maxTries]);
  return null;
}
