import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb } from "./helpers/db";
import { authHeader, createTestUser } from "./helpers/auth";
import { createBookableBranch, tomorrowDateString } from "./helpers/fixtures";
import { ROLE_NAMES } from "@/shared/constants";

async function createWalkIn(fixture: Awaited<ReturnType<typeof createBookableBranch>>) {
  const res = await request(app)
    .post("/api/v1/salon-bookings/walk-in")
    .set(authHeader(fixture.owner.accessToken))
    .send({
      customerName: "Walk-in Customer",
      customerPhone: "+919876543210",
      services: [fixture.service.id],
      staffId: fixture.staffMember.id,
      bookingDate: tomorrowDateString(),
      slotId: "11:00-11:30",
    });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; bookingNumber: string; bookingStatus: string; paymentMethod: string };
}

describe("Module 23 — claim a walk-in / pay bill (LUZO comparison item 5a)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("a customer can claim a walk-in booking by its bookingNumber, linking it to their account", async () => {
    const fixture = await createBookableBranch();
    const walkIn = await createWalkIn(fixture);
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

    const res = await request(app)
      .post("/api/v1/bookings/claim")
      .set(authHeader(customer.accessToken))
      .send({ bookingNumber: walkIn.bookingNumber });
    expect(res.status).toBe(200);
    expect(res.body.data.customerId).toBe(customer.id);
    expect(res.body.data.bookingStatus).toBe("APPROVED");
    expect(res.body.data.paymentMethod).toBe("PAY_AT_SALON");

    const myBookings = await request(app).get("/api/v1/bookings/my-bookings").set(authHeader(customer.accessToken));
    expect(myBookings.body.data.some((b: { id: string }) => b.id === walkIn.id)).toBe(true);
  });

  it("claiming again (by the same or a different customer) 409s — one-time link", async () => {
    const fixture = await createBookableBranch();
    const walkIn = await createWalkIn(fixture);
    const first = await createTestUser([ROLE_NAMES.CUSTOMER]);
    const second = await createTestUser([ROLE_NAMES.CUSTOMER]);

    await request(app).post("/api/v1/bookings/claim").set(authHeader(first.accessToken)).send({ bookingNumber: walkIn.bookingNumber });

    const res = await request(app)
      .post("/api/v1/bookings/claim")
      .set(authHeader(second.accessToken))
      .send({ bookingNumber: walkIn.bookingNumber });
    expect(res.status).toBe(409);
  });

  it("an unknown bookingNumber 404s", async () => {
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);
    const res = await request(app)
      .post("/api/v1/bookings/claim")
      .set(authHeader(customer.accessToken))
      .send({ bookingNumber: "SLJ-DOESNOTEXIST-000000" });
    expect(res.status).toBe(404);
  });

  it("a regular (non-walk-in) booking's bookingNumber cannot be claimed — 404, not leaked", async () => {
    const fixture = await createBookableBranch();
    const bookingOwner = await createTestUser([ROLE_NAMES.CUSTOMER]);
    const created = await request(app)
      .post("/api/v1/bookings")
      .set(authHeader(bookingOwner.accessToken))
      .send({
        salonId: fixture.salon.id,
        branchId: fixture.branch.id,
        services: [fixture.service.id],
        bookingDate: tomorrowDateString(),
        slotId: "10:00-10:30",
      });
    const detail = await request(app).get(`/api/v1/bookings/${created.body.bookingId}`).set(authHeader(bookingOwner.accessToken));

    const claimer = await createTestUser([ROLE_NAMES.CUSTOMER]);
    const res = await request(app)
      .post("/api/v1/bookings/claim")
      .set(authHeader(claimer.accessToken))
      .send({ bookingNumber: detail.body.booking.bookingNumber });
    expect(res.status).toBe(404);
  });

  it("payOnline: true switches an unpaid claimed walk-in to ONLINE/AWAITING_PAYMENT, and payment then works through the existing flow", async () => {
    const fixture = await createBookableBranch();
    const walkIn = await createWalkIn(fixture);
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

    const claimRes = await request(app)
      .post("/api/v1/bookings/claim")
      .set(authHeader(customer.accessToken))
      .send({ bookingNumber: walkIn.bookingNumber, payOnline: true });
    expect(claimRes.status).toBe(200);
    expect(claimRes.body.data.bookingStatus).toBe("AWAITING_PAYMENT");
    expect(claimRes.body.data.paymentMethod).toBe("ONLINE");

    const order = await request(app)
      .post("/api/v1/payments/create-order")
      .set(authHeader(customer.accessToken))
      .send({ bookingId: walkIn.id });
    expect(order.status).toBe(201);
  });
});
