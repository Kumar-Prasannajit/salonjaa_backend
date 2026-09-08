import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb } from "./helpers/db";
import { authHeader, createTestUser } from "./helpers/auth";
import { ROLE_NAMES } from "@/shared/constants";

/**
 * TRD §15's "authorization matrix tests" — a representative sample (not exhaustive) across
 * role-gated endpoints: no token -> 401, wrong role -> 403, right role -> passes the gate
 * (further ownership/business-rule checks are covered by each module's own test file).
 */
describe("Authorization matrix", () => {
  beforeEach(async () => {
    await resetDb();
  });

  const cases: { method: "get" | "post"; path: string; requiredRole: string; body?: object }[] = [
    { method: "post", path: "/api/v1/salons", requiredRole: ROLE_NAMES.SALON_OWNER, body: { name: "X" } },
    { method: "post", path: "/api/v1/bookings", requiredRole: ROLE_NAMES.CUSTOMER, body: {} },
    { method: "get", path: "/api/v1/admin/salons", requiredRole: ROLE_NAMES.ADMIN },
    { method: "get", path: "/api/v1/admin/coupons", requiredRole: ROLE_NAMES.ADMIN },
    { method: "get", path: "/api/v1/admin/categories", requiredRole: ROLE_NAMES.ADMIN },
    { method: "get", path: "/api/v1/admin/settlements", requiredRole: ROLE_NAMES.ADMIN },
    { method: "get", path: "/api/v1/admin/reports/overview", requiredRole: ROLE_NAMES.ADMIN },
    { method: "get", path: "/api/v1/promotions", requiredRole: ROLE_NAMES.SALON_OWNER },
  ];

  for (const c of cases) {
    it(`${c.method.toUpperCase()} ${c.path} — 401 with no token`, async () => {
      const res = c.method === "get" ? await request(app).get(c.path) : await request(app).post(c.path).send(c.body ?? {});
      expect(res.status).toBe(401);
    });

    it(`${c.method.toUpperCase()} ${c.path} — 403 for an authenticated user without ${c.requiredRole}`, async () => {
      // Every account is at least CUSTOMER (matches real signup) — pick a role that's
      // guaranteed wrong for whatever this endpoint requires.
      const wrongRole = c.requiredRole === ROLE_NAMES.CUSTOMER ? ROLE_NAMES.SALON_OWNER : ROLE_NAMES.CUSTOMER;
      const user = await createTestUser([wrongRole as never]);
      const res =
        c.method === "get"
          ? await request(app).get(c.path).set(authHeader(user.accessToken))
          : await request(app).post(c.path).set(authHeader(user.accessToken)).send(c.body ?? {});
      expect(res.status).toBe(403);
    });
  }

  it("GET /users/me — any authenticated role passes (no role restriction), 401 with none", async () => {
    const unauthed = await request(app).get("/api/v1/users/me");
    expect(unauthed.status).toBe(401);

    const user = await createTestUser([ROLE_NAMES.CUSTOMER]);
    const authed = await request(app).get("/api/v1/users/me").set(authHeader(user.accessToken));
    expect(authed.status).toBe(200);
  });

  it("public endpoints need no auth at all", async () => {
    const res = await request(app).get("/api/v1/service-categories");
    expect(res.status).toBe(200);
    const promoRes = await request(app).get("/api/v1/public/promotions");
    expect(promoRes.status).toBe(200);
  });
});
