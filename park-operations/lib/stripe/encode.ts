// Stripe's REST API takes application/x-www-form-urlencoded with bracket notation:
// { metadata: { bookingCode: "A" }, items: ["x"] } → metadata[bookingCode]=A&items[0]=x

export type StripeParams = { [key: string]: string | number | boolean | null | undefined | StripeParams | StripeParams[] | (string | number)[] };

export function encodeStripeParams(params: StripeParams, prefix = ""): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === "object") parts.push(encodeStripeParams(item as StripeParams, `${name}[${i}]`));
        else parts.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof value === "object") {
      const inner = encodeStripeParams(value, name);
      if (inner) parts.push(inner);
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}
