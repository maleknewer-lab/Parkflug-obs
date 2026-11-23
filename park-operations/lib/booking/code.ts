import { randomInt } from "node:crypto";

// Booking code: 9 characters = 5 letters + 4 digits (like KTOYG1199). Used in the QR code,
// the customer's manage link and at the driver's check-in.
// Generated codes skip look-alike characters (letters I, O and digit 0) so they survive
// being read out over the phone. Validation stays loose (any 9 letters/digits) so older or
// imported codes still work.

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O
const DIGITS = "123456789"; // no 0

export type RandomInt = (maxExclusive: number) => number;

export function generateBookingCode(rand: RandomInt = (n) => randomInt(n)): string {
  let code = "";
  for (let i = 0; i < 5; i++) code += LETTERS[rand(LETTERS.length)];
  for (let i = 0; i < 4; i++) code += DIGITS[rand(DIGITS.length)];
  return code;
}

/** Trim, upper-case, drop spaces and dashes ("ktoyg 1199" → "KTOYG1199"). */
export function normalizeBookingCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function isValidBookingCode(code: string): boolean {
  return /^[A-Z0-9]{9}$/.test(code);
}

/** Retries until `exists` says the code is free (the DB unique index stays the final guard). */
export async function generateUniqueBookingCode(
  exists: (code: string) => Promise<boolean>,
  maxAttempts = 10,
  rand?: RandomInt,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateBookingCode(rand);
    if (!(await exists(code))) return code;
  }
  throw new Error("Could not generate a unique booking code");
}
