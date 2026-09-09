import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb } from "./helpers/db";
import { createBookableBranch } from "./helpers/fixtures";
import { authHeader } from "./helpers/auth";

describe("Public Browse — salonId filter + branch phone (COMPETITOR_COMPARISON_LUZO.md)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("GET /public/branches?salonId= closes the 'View Branches' gap", async () => {
    const a = await createBookableBranch();
    const b = await createBookableBranch();

    const filtered = await request(app).get(`/api/v1/public/branches?salonId=${a.salon.id}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].branchId).toBe(a.branch.id);
    expect(filtered.body.some((row: { branchId: string }) => row.branchId === b.branch.id)).toBe(false);
  });

  it("GET /public/branches/:branchId includes phone (closes the 'Contact'/'Call Salon' gap)", async () => {
    const { branch } = await createBookableBranch();
    const res = await request(app).get(`/api/v1/public/branches/${branch.id}`);
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe("+919999999999");
  });
});

describe("Module 21 — price tier + gender-served tags on listing cards (LUZO comparison item 2)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("buckets a branch's average active-service price into the confirmed ₹/₹₹/₹₹₹ cutoffs and surfaces genderServed", async () => {
    const low = await createBookableBranch({ basePrice: 200, genderServed: "MEN" });
    const mid = await createBookableBranch({ basePrice: 500 });
    const high = await createBookableBranch({ basePrice: 1000, genderServed: "WOMEN" });

    const res = await request(app).get("/api/v1/public/branches");
    expect(res.status).toBe(200);
    const byId = (id: string) => res.body.find((r: { branchId: string }) => r.branchId === id);

    expect(byId(low.branch.id).priceTier).toBe("₹");
    expect(byId(low.branch.id).genderServed).toBe("MEN");
    expect(byId(mid.branch.id).priceTier).toBe("₹₹");
    expect(byId(mid.branch.id).genderServed).toBe("UNISEX");
    expect(byId(high.branch.id).priceTier).toBe("₹₹₹");
    expect(byId(high.branch.id).genderServed).toBe("WOMEN");
  });

  it("GET /public/branches/:branchId also carries priceTier and genderServed", async () => {
    const { branch } = await createBookableBranch({ basePrice: 900, genderServed: "MEN" });
    const res = await request(app).get(`/api/v1/public/branches/${branch.id}`);
    expect(res.status).toBe(200);
    expect(res.body.priceTier).toBe("₹₹₹");
    expect(res.body.genderServed).toBe("MEN");
  });
});

describe("Module 22 — offer banners on listing cards (LUZO comparison item 3)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("only an owner-flagged featured, active, in-range promotion appears as activePromotion", async () => {
    const { owner, branch } = await createBookableBranch();
    const now = Date.now();
    const inRange = { startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 60 * 60 * 1000).toISOString() };

    // Not featured — must NOT appear as the banner.
    await request(app)
      .post("/api/v1/promotions")
      .set(authHeader(owner.accessToken))
      .send({ title: "Unfeatured Offer", branchIds: [branch.id], ...inRange });

    // Featured — must appear.
    const featured = await request(app)
      .post("/api/v1/promotions")
      .set(authHeader(owner.accessToken))
      .send({ title: "Flat 40% OFF", bannerImageUrl: "https://example.test/banner.png", branchIds: [branch.id], featured: true, ...inRange });
    expect(featured.status).toBe(201);

    const res = await request(app).get(`/api/v1/public/branches?salonId=${branch.salonId}`);
    expect(res.status).toBe(200);
    expect(res.body[0].activePromotion).toEqual({ title: "Flat 40% OFF", bannerImageUrl: "https://example.test/banner.png" });
  });

  it("a branch with no featured promotion shows activePromotion: null", async () => {
    const { branch } = await createBookableBranch();
    const res = await request(app).get(`/api/v1/public/branches?salonId=${branch.salonId}`);
    expect(res.status).toBe(200);
    expect(res.body[0].activePromotion).toBeNull();
  });
});
