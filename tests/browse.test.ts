import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb } from "./helpers/db";
import { createBookableBranch } from "./helpers/fixtures";

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
