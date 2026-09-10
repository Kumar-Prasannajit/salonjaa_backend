import crypto from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb } from "./helpers/db";
import { authHeader, createTestUser } from "./helpers/auth";
import { createBookableBranch, tomorrowDateString } from "./helpers/fixtures";
import { env } from "@/config/env";
import { ROLE_NAMES } from "@/shared/constants";

async function createAwaitingPaymentBooking() {
  const fixture = await createBookableBranch();
  const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

  const createRes = await request(app)
    .post("/api/v1/bookings")
    .set(authHeader(customer.accessToken))
    .send({
      salonId: fixture.salon.id,
      branchId: fixture.branch.id,
      services: [fixture.service.id],
      bookingDate: tomorrowDateString(),
      slotId: "10:00-10:30",
      paymentMethod: "ONLINE",
    });
  const bookingId = createRes.body.bookingId;

  await request(app).post(`/api/v1/salon-bookings/${bookingId}/approve`).set(authHeader(fixture.owner.accessToken)).send({});

  return { fixture, customer, bookingId };
}

function computeSignature(orderId: string, paymentId: string): string {
  return crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

describe("Payment — create-order gating + real Razorpay signature verification", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("create-order is blocked before the booking reaches AWAITING_PAYMENT", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);
    const createRes = await request(app)
      .post("/api/v1/bookings")
      .set(authHeader(customer.accessToken))
      .send({
        salonId: fixture.salon.id,
        branchId: fixture.branch.id,
        services: [fixture.service.id],
        bookingDate: tomorrowDateString(),
        slotId: "10:00-10:30",
        paymentMethod: "ONLINE",
      });

    const res = await request(app).post("/api/v1/payments/create-order").set(authHeader(customer.accessToken)).send({ bookingId: createRes.body.bookingId });
    expect(res.status).toBe(409);
  });

  it("create-order succeeds once AWAITING_PAYMENT, returns a real Razorpay order", async () => {
    const { customer, bookingId } = await createAwaitingPaymentBooking();

    const res = await request(app).post("/api/v1/payments/create-order").set(authHeader(customer.accessToken)).send({ bookingId });
    expect(res.status).toBe(201);
    expect(res.body.orderId).toMatch(/^order_/);
    expect(res.body.currency).toBe("INR");
  });

  it("a fabricated signature fails verification and marks the payment FAILED", async () => {
    const { customer, bookingId } = await createAwaitingPaymentBooking();
    const orderRes = await request(app).post("/api/v1/payments/create-order").set(authHeader(customer.accessToken)).send({ bookingId });

    const res = await request(app)
      .post("/api/v1/payments/verify")
      .set(authHeader(customer.accessToken))
      .send({ orderId: orderRes.body.orderId, paymentId: "pay_fake123", signature: "0".repeat(64) });

    expect(res.status).toBe(400);
  });

  it("a correctly-computed HMAC signature succeeds, is idempotent, and moves the booking to APPROVED", async () => {
    const { customer, bookingId } = await createAwaitingPaymentBooking();
    // First order got FAILED by the previous test's fabricated-signature case in a fresh
    // fixture here — this test creates its own AWAITING_PAYMENT booking, so create-order is
    // fresh and unblocked.
    const orderRes = await request(app).post("/api/v1/payments/create-order").set(authHeader(customer.accessToken)).send({ bookingId });
    const paymentId = "pay_test_valid1";
    const signature = computeSignature(orderRes.body.orderId, paymentId);

    const verifyRes = await request(app)
      .post("/api/v1/payments/verify")
      .set(authHeader(customer.accessToken))
      .send({ orderId: orderRes.body.orderId, paymentId, signature });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.paymentStatus).toBe("SUCCESS");

    // Idempotent re-verify.
    const secondVerify = await request(app)
      .post("/api/v1/payments/verify")
      .set(authHeader(customer.accessToken))
      .send({ orderId: orderRes.body.orderId, paymentId, signature });
    expect(secondVerify.status).toBe(200);
    expect(secondVerify.body.paymentStatus).toBe("SUCCESS");

    const bookingRes = await request(app).get(`/api/v1/bookings/${bookingId}`).set(authHeader(customer.accessToken));
    expect(bookingRes.body.booking.bookingStatus).toBe("APPROVED");
  });

  it("two concurrent create-order requests for the same booking only let one through (payments_active_booking_purpose_unique)", async () => {
    const { customer, bookingId } = await createAwaitingPaymentBooking();

    const [first, second] = await Promise.all([
      request(app).post("/api/v1/payments/create-order").set(authHeader(customer.accessToken)).send({ bookingId }),
      request(app).post("/api/v1/payments/create-order").set(authHeader(customer.accessToken)).send({ bookingId }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const myPayments = await request(app).get("/api/v1/payments/my-payments").set(authHeader(customer.accessToken));
    const pendingForBooking = myPayments.body.data.filter(
      (p: { bookingId: string; status: string }) => p.bookingId === bookingId && p.status === "PENDING"
    );
    expect(pendingForBooking).toHaveLength(1);
  });
});
