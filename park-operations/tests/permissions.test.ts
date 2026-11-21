import { describe, expect, it } from "vitest";
import { canAccess, canSeeRevenue, cashScope, isPublicPath, navFor, ROLE_HOME } from "@/lib/permissions";

describe("canAccess", () => {
  it("admin may open everything, including unknown admin routes", () => {
    for (const p of ["/admin", "/admin/staff", "/admin/invoices/2026-000001", "/admin/rates", "/driver", "/admin/new-thing"]) {
      expect(canAccess("admin", p)).toBe(true);
    }
  });

  it("dispo: office pages yes, money/pricing/staff pages no", () => {
    for (const p of ["/admin", "/admin/transfers", "/admin/bookings/KTOYG1199", "/admin/customers", "/admin/occupancy", "/admin/cash", "/driver"]) {
      expect(canAccess("dispo", p)).toBe(true);
    }
    for (const p of ["/admin/invoices", "/admin/reports", "/admin/rates", "/admin/staff", "/admin/marketing", "/admin/staff/123"]) {
      expect(canAccess("dispo", p)).toBe(false);
    }
  });

  it("fahrer: only transfers, driver app, cash, account", () => {
    for (const p of ["/admin/transfers", "/driver", "/driver/KTOYG1199", "/admin/cash", "/account"]) {
      expect(canAccess("fahrer", p)).toBe(true);
    }
    for (const p of ["/admin", "/admin/bookings", "/admin/customers", "/admin/invoices", "/admin/staff"]) {
      expect(canAccess("fahrer", p)).toBe(false);
    }
  });

  it("public pages are open to every role", () => {
    expect(canAccess("fahrer", "/book/parkflug")).toBe(true);
  });

  it("denies unknown admin routes for non-admins (deny by default)", () => {
    expect(canAccess("dispo", "/admin/something-new")).toBe(false);
    expect(canAccess("fahrer", "/admin/something-new")).toBe(false);
  });

  it("does not match on string prefix only (segment boundary)", () => {
    expect(canAccess("dispo", "/admin/staffing")).toBe(false); // unknown → admin only
    expect(canAccess("fahrer", "/driverx")).toBe(false);
  });

  it("ignores trailing slashes", () => {
    expect(canAccess("dispo", "/admin/bookings/")).toBe(true);
    expect(canAccess("dispo", "/admin/staff/")).toBe(false);
  });

  it("any logged-in user may open / and /api/* (handlers enforce roles themselves)", () => {
    expect(canAccess("fahrer", "/")).toBe(true);
    expect(canAccess("fahrer", "/api/bookings")).toBe(true);
  });
});

describe("home pages", () => {
  it("every role's home page is reachable by that role (no redirect loop)", () => {
    for (const role of ["admin", "dispo", "fahrer"] as const) {
      expect(canAccess(role, ROLE_HOME[role])).toBe(true);
    }
  });
});

describe("isPublicPath", () => {
  it("login, customer pages and webhooks are public", () => {
    for (const p of ["/login", "/logout", "/book/parkflug", "/manage/KTOYG1199", "/api/auth/callback/credentials", "/api/stripe/webhook"]) {
      expect(isPublicPath(p)).toBe(true);
    }
  });
  it("admin and driver areas are not public", () => {
    for (const p of ["/admin", "/driver", "/account", "/booking", "/login-help"]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});

describe("cash scope & revenue", () => {
  it("matches CLAUDE.md §3", () => {
    expect(cashScope("admin")).toBe("any-day");
    expect(cashScope("dispo")).toBe("today");
    expect(cashScope("fahrer")).toBe("own-today");
    expect(canSeeRevenue("admin")).toBe(true);
    expect(canSeeRevenue("dispo")).toBe(false);
    expect(canSeeRevenue("fahrer")).toBe(false);
  });
});

describe("navFor", () => {
  const keys = (r: "admin" | "dispo" | "fahrer") => navFor(r).map((i) => i.key);
  it("admin sees all items", () => expect(keys("admin")).toHaveLength(13));
  it("dispo sees the booking-page link, fahrer does not", () => {
    expect(keys("dispo")).toContain("buchen");
    expect(keys("fahrer")).not.toContain("buchen");
  });
  it("dispo does not see money/pricing/staff", () => {
    expect(keys("dispo")).not.toContain("rechnungen");
    expect(keys("dispo")).not.toContain("tarife");
    expect(keys("dispo")).not.toContain("mitarbeiter");
    expect(keys("dispo")).toContain("buchungen");
  });
  it("fahrer sees transfers, driver app, cash only", () => {
    expect(keys("fahrer").sort()).toEqual(["fahrer", "kasse", "transfers"]);
  });
});
