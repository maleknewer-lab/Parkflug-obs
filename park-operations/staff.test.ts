import { describe, expect, it } from "vitest";
import { createStaffSchema, generatePassword } from "@/lib/staff";

describe("staff helpers", () => {
  it("generates long enough, different passwords", () => {
    const a = generatePassword();
    expect(a.length).toBeGreaterThanOrEqual(10);
    expect(a).not.toBe(generatePassword());
  });
  it("normalises email and accepts empty password", () => {
    const r = createStaffSchema.parse({ name: "Ali", email: " ALI@Firma.de ", role: "fahrer", password: "" });
    expect(r.email).toBe("ali@firma.de");
  });
  it("rejects short password and unknown role", () => {
    expect(createStaffSchema.safeParse({ name: "Ali", email: "a@b.de", role: "fahrer", password: "short" }).success).toBe(false);
    expect(createStaffSchema.safeParse({ name: "Ali", email: "a@b.de", role: "boss", password: "" }).success).toBe(false);
  });
});
