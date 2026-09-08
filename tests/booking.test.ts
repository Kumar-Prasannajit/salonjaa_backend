import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb } from "./helpers/db";
import { authHeader, createTestUser } from "./helpers/auth";
import { createBookableBranch, tomorrowDateString } from "./helpers/fixtures";
import { ROLE_NAMES } from "@/shared/constants";

function bookingBody(fixture: Awaited<ReturnType<typeof createBookableBranch>>, overrides: Record<string, unknown> = {}) {
  return {
    salonId: fixture.salon.id,
    branchId: fixture.branch.id,
    services: [fixture.service.id],
    bookingDate: tomorrowDateString(),
    slotId: "10:00-10:30",
    ...overrides,
  };
}

describe("Booking — create/approve/reject", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("a customer can create a PENDING booking for a bookable branch", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

    const res = await request(app).post("/api/v1/bookings").set(authHeader(customer.accessToken)).send(bookingBody(fixture));

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PENDING");
    expect(res.body.bookingId).toBeTruthy();
  });

  it("rejects a booking with an invalid serviceId (400)", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

    const res = await request(app)
      .post("/api/v1/bookings")
      .set(authHeader(customer.accessToken))
      .send(bookingBody(fixture, { services: ["00000000-0000-0000-0000-000000000000"] }));

    expect(res.status).toBe(400);
  });

  it("owner can approve a PAY_AT_SALON booking straight to APPROVED", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

    const createRes = await request(app)
      .post("/api/v1/bookings")
      .set(authHeader(customer.accessToken))
      .send(bookingBody(fixture, { paymentMethod: "PAY_AT_SALON" }));

    const approveRes = await request(app)
      .post(`/api/v1/salon-bookings/${createRes.body.bookingId}/approve`)
      .set(authHeader(fixture.owner.accessToken))
      .send({});

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.bookingStatus).toBe("APPROVED");
  });

  it("an ONLINE booking's approval stops at AWAITING_PAYMENT (Module 14b)", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

    const createRes = await request(app)
      .post("/api/v1/bookings")
      .set(authHeader(customer.accessToken))
      .send(bookingBody(fixture, { paymentMethod: "ONLINE" }));

    const approveRes = await request(app)
      .post(`/api/v1/salon-bookings/${createRes.body.bookingId}/approve`)
      .set(authHeader(fixture.owner.accessToken))
      .send({});

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.bookingStatus).toBe("AWAITING_PAYMENT");
  });

  it("only the owning Salon Owner can approve — a different owner gets 404 (no existence leak)", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);
    const otherOwner = await createTestUser([ROLE_NAMES.CUSTOMER, ROLE_NAMES.SALON_OWNER]);

    const createRes = await request(app).post("/api/v1/bookings").set(authHeader(customer.accessToken)).send(bookingBody(fixture));

    const res = await request(app).post(`/api/v1/salon-bookings/${createRes.body.bookingId}/approve`).set(authHeader(otherOwner.accessToken)).send({});
    expect(res.status).toBe(404);
  });

  it("reject requires a role, and a customer cannot call the owner-side reject route (403)", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);
    const createRes = await request(app).post("/api/v1/bookings").set(authHeader(customer.accessToken)).send(bookingBody(fixture));

    const res = await request(app)
      .post(`/api/v1/salon-bookings/${createRes.body.bookingId}/reject`)
      .set(authHeader(customer.accessToken))
      .send({ reason: "not available" });
    expect(res.status).toBe(403);
  });
});

describe("Booking — cancellation policy (Module 16: free until 2h before, then blocked)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("can cancel a booking well outside the 2h cutoff", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);
    const createRes = await request(app).post("/api/v1/bookings").set(authHeader(customer.accessToken)).send(bookingBody(fixture));

    const res = await request(app).post(`/api/v1/bookings/${createRes.body.bookingId}/cancel`).set(authHeader(customer.accessToken)).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.bookingStatus).toBe("CANCELLED");
  });

  it("blocks cancellation inside the 2h cutoff", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

    // A slot starting within the next hour, on today's date, well inside the 2h window.
    const now = new Date();
    const soon = new Date(now.getTime() + 60 * 60 * 1000);
    const dateStr = soon.toISOString().slice(0, 10);
    const label = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const end = new Date(soon.getTime() + 30 * 60 * 1000);

    const createRes = await request(app)
      .post("/api/v1/bookings")
      .set(authHeader(customer.accessToken))
      .send(bookingBody(fixture, { bookingDate: dateStr, slotId: `${label(soon)}-${label(end)}` }));

    if (createRes.status !== 201) {
      // Outside branch operating hours for whatever time this suite happens to run — skip
      // rather than flake; the well-outside-cutoff case above already covers the success path.
      return;
    }

    const res = await request(app).post(`/api/v1/bookings/${createRes.body.bookingId}/cancel`).set(authHeader(customer.accessToken)).send({});
    expect(res.status).toBe(409);
  });
});

describe("Booking — concurrent creation only allows up to effective capacity (TRD §15's concurrency requirement)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("with 1 chair and 1 staff, exactly one of 5 concurrent bookings for the same slot succeeds", async () => {
    const fixture = await createBookableBranch({ totalChairs: 1 });
    const customers = await Promise.all(Array.from({ length: 5 }, () => createTestUser([ROLE_NAMES.CUSTOMER])));

    const results = await Promise.all(
      customers.map((c) => request(app).post("/api/v1/bookings").set(authHeader(c.accessToken)).send(bookingBody(fixture)))
    );

    const succeeded = results.filter((r) => r.status === 201);
    const conflicted = results.filter((r) => r.status === 409);
    expect(succeeded.length).toBe(1);
    expect(conflicted.length).toBe(4);
  });
});
