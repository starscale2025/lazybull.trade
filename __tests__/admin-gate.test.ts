import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The admin allow-list is governable (threat model R-07): ADMIN_EMAILS replaces
// the list rather than being union'd into it, so the founder address can be
// revoked from env alone — while an unset env still admits the founder, which
// is the property that keeps an unconfigured deploy from locking its owner out.
// Revocation is the sharp edge of that design, so the layout gate is asserted
// on what it RENDERS: a denial has to name the address and ADMIN_EMAILS, or an
// operator who mis-set the var has no way to diagnose their own lockout.
// Also covers the audit trail's one hard contract: it can never throw or block
// the gate that emits it, and exactly one gate layer writes a record.

const h = vi.hoisted(() => ({
  session: null as { user?: { id?: string; email?: string | null } } | null,
  audit: vi.fn(),
  after: vi.fn((cb: () => unknown) => {
    void cb;
  }),
}));

vi.mock("@/lib/auth", () => ({ auth: async () => h.session }));
vi.mock("@/lib/db/audit", () => ({ auditAdminAccess: h.audit }));
vi.mock("next/server", () => ({ after: (cb: () => unknown) => h.after(cb) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { adminEmails, isAdmin } from "@/lib/admin";
import AdminLayout from "@/app/admin/layout";
import { __resetMongo } from "@/lib/mongo";

const FOUNDER = "shauryanegi099@gmail.com";

// Stands in for the cockpit itself: if it reaches the markup, the gate let the
// page render.
const COCKPIT = "cockpit-children-sentinel";
const renderLayout = async () =>
  renderToStaticMarkup(await AdminLayout({ children: COCKPIT }));

beforeEach(() => {
  delete process.env.ADMIN_EMAILS;
  h.session = null;
  h.audit.mockClear();
  h.after.mockClear();
  h.after.mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
  vi.restoreAllMocks();
});

describe("adminEmails — ADMIN_EMAILS is authoritative when set", () => {
  it("falls back to the founder when ADMIN_EMAILS is unset", () => {
    expect(adminEmails()).toEqual([FOUNDER]);
    expect(isAdmin(FOUNDER)).toBe(true);
  });

  it("treats blank and separator-only values as unset", () => {
    for (const v of ["", "   ", ",", " , ,"]) {
      process.env.ADMIN_EMAILS = v;
      expect(adminEmails()).toEqual([FOUNDER]);
    }
  });

  it("REPLACES the list when set — the founder is revocable from env", () => {
    process.env.ADMIN_EMAILS = "ops@lazybull.trade";
    expect(adminEmails()).toEqual(["ops@lazybull.trade"]);
    expect(isAdmin(FOUNDER)).toBe(false);
    expect(isAdmin("ops@lazybull.trade")).toBe(true);
  });

  it("normalizes case and whitespace, and de-dupes", () => {
    process.env.ADMIN_EMAILS = " Ops@Lazybull.Trade , ops@lazybull.trade ";
    expect(adminEmails()).toEqual(["ops@lazybull.trade"]);
    expect(isAdmin("OPS@LAZYBULL.TRADE")).toBe(true);
  });

  it("rejects anonymous and empty identities", () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin("")).toBe(false);
  });
});

describe("admin layout gate + audit", () => {
  it("sends anonymous visitors to sign-in without writing a record", async () => {
    await expect(renderLayout()).rejects.toThrow("REDIRECT:/auth/signin?callbackUrl=/admin");
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("denies a signed-in non-admin with a screen that names the fix, and records it once", async () => {
    process.env.ADMIN_EMAILS = "ops@lazybull.trade";
    h.session = { user: { id: "u1", email: "someone@else.com" } };
    const html = await renderLayout();
    expect(html).not.toContain(COCKPIT);
    expect(html).toContain("someone@else.com");
    expect(html).toContain("ADMIN_EMAILS");
    expect(h.audit).toHaveBeenCalledTimes(1);
    expect(h.audit).toHaveBeenCalledWith("denied-not-admin", "someone@else.com", "u1");
  });

  it("tells a revoked founder which address was rejected", async () => {
    process.env.ADMIN_EMAILS = "ops@lazybull.trade";
    h.session = { user: { id: "u2", email: FOUNDER } };
    const html = await renderLayout();
    expect(html).not.toContain(COCKPIT);
    expect(html).toContain(FOUNDER);
    expect(html).toContain("ADMIN_EMAILS");
  });

  it("admits an allow-listed admin and records the grant once", async () => {
    h.session = { user: { id: "u2", email: FOUNDER } };
    const html = await renderLayout();
    expect(html).toContain(COCKPIT);
    expect(html).not.toContain("ADMIN_EMAILS");
    expect(h.audit).toHaveBeenCalledTimes(1);
    expect(h.audit).toHaveBeenCalledWith("granted", FOUNDER, "u2");
  });

  it("denies a session carrying no email at all", async () => {
    h.session = { user: { id: "u3" } };
    const html = await renderLayout();
    expect(html).not.toContain(COCKPIT);
    expect(html).toContain("an account with no email");
    expect(h.audit).toHaveBeenCalledWith("denied-not-admin", null, "u3");
  });
});

describe("auditAdminAccess never breaks the gate", () => {
  // The real module, with `after` still mocked — the point is that neither
  // scheduling nor the deferred write can surface as an exception.
  const real = async () => await vi.importActual<typeof import("@/lib/db/audit")>("@/lib/db/audit");

  it("swallows a scheduler that throws (no request scope)", async () => {
    const { auditAdminAccess } = await real();
    h.after.mockImplementation(() => {
      throw new Error("after() called outside a request scope");
    });
    expect(() => auditAdminAccess("granted", FOUNDER, "u1")).not.toThrow();
  });

  it("returns before the write runs, and the write swallows a dead database", async () => {
    const { auditAdminAccess } = await real();
    let deferred: (() => unknown) | null = null;
    h.after.mockImplementation((cb: () => unknown) => {
      deferred = cb;
    });

    delete process.env.MONGODB_URI;
    __resetMongo();
    auditAdminAccess("granted", FOUNDER, "u1");

    // Nothing touched Mongo synchronously; the insert is the deferred callback.
    expect(deferred).toBeTypeOf("function");
    await expect((deferred as unknown as () => Promise<void>)()).resolves.toBeUndefined();
  });

  it("tolerates a non-ObjectId user id", async () => {
    const { auditAdminAccess } = await real();
    expect(() => auditAdminAccess("denied-not-admin", FOUNDER, "not-an-objectid")).not.toThrow();
    expect(() => auditAdminAccess("denied-not-admin", null, null)).not.toThrow();
  });
});
