// Consent given in the public booking form. Wording is provisional until a lawyer has checked it
// (UWG §7, DSGVO). Bump TERMS_VERSION whenever the texts or the linked terms change.
export const TERMS_VERSION = "provisional-2026-11";

export type Consent = { terms: boolean; smsOptIn: boolean };

/** Checkboxes arrive as "on" or not at all. Terms are mandatory; SMS opt-in is never pre-ticked. */
export function readConsent(get: (name: string) => string): Consent {
  return { terms: get("termsAccepted") === "on", smsOptIn: get("smsOptIn") === "on" };
}

/**
 * SMS advertising needs the explicit opt-in of the person who owns the number. A visitor must not opt
 * somebody else in by typing their e-mail, so the opt-in is stored only when the customer record's
 * phone number is the number typed in this form.
 */
export function shouldStoreSmsOptIn(consent: Consent, customerPhone: string | null, formPhone: string): boolean {
  return consent.smsOptIn && customerPhone !== null && customerPhone === formPhone;
}
