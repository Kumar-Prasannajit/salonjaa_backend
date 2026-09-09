import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb } from "./helpers/db";
import { authHeader, createTestUser } from "./helpers/auth";
import { createBookableBranch, tomorrowDateString } from "./helpers/fixtures";
import { db } from "@/config/database";
import { wallets } from "@/db/schema";
import { env } from "@/config/env";
import { ROLE_NAMES } from "@/shared/constants";

function computeSignature(orderId: string, paymentId: string): string {
  return crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

/** Seeds a wallet balance directly (same "direct DB setup for a dependency, not the thing
 * under test" precedent as tests/helpers/fixtures.ts) rather than round-tripping through the
 * refund-approval flow for every test that just needs *some* balance to spend from. */
async function seedWalletBalance(userId: string, balance: number): Promise<void> {
  await db.insert(wallets).values({ userId, balance });
}

describe("Module 20 — general customer wallet", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("GET /wallet reports a 0 balance and an empty ledger for a customer with no wallet activity yet", async () => {
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

    const balanceRes = await request(app).get("/api/v1/wallet").set(authHeader(customer.accessToken));
    expect(balanceRes.status).toBe(200);
    expect(balanceRes.body.data.balance).toBe(0);

    const txnRes = await request(app).get("/api/v1/wallet/transactions").set(authHeader(customer.accessToken));
    expect(txnRes.status).toBe(200);
    expect(txnRes.body.data).toEqual([]);
  });

  it("an admin-approved refund credits the customer's wallet instead of just marking the decision", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);
    const admin = await createTestUser([ROLE_NAMES.ADMIN]);

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

    const orderRes = await request(app).post("/api/v1/payments/create-order").set(authHeader(customer.accessToken)).send({ bookingId });
    const paymentId = "pay_wallet_refund1";
    const signature = computeSignature(orderRes.body.orderId, paymentId);
    await request(app)
      .post("/api/v1/payments/verify")
      .set(authHeader(customer.accessToken))
      .send({ orderId: orderRes.body.orderId, paymentId, signature });

    await request(app).post(`/api/v1/bookings/${bookingId}/cancel`).set(authHeader(customer.accessToken)).send({});

    const refundRes = await request(app).post("/api/v1/payments/refund-request").set(authHeader(customer.accessToken)).send({ bookingId, reason: "Test refund" });
    expect(refundRes.status).toBe(201);

    const approveRes = await request(app)
      .post(`/api/v1/admin/refunds/${refundRes.body.data.id}/approve`)
      .set(authHeader(admin.accessToken))
      .send({});
    expect(approveRes.status).toBe(200);

    const balanceRes = await request(app).get("/api/v1/wallet").set(authHeader(customer.accessToken));
    expect(balanceRes.body.data.balance).toBeCloseTo(200, 5);

    const txnRes = await request(app).get("/api/v1/wallet/transactions").set(authHeader(customer.accessToken));
    expect(txnRes.body.data).toHaveLength(1);
    expect(txnRes.body.data[0].type).toBe("CREDIT");
    expect(txnRes.body.data[0].reason).toBe("REFUND_APPROVED");
    expect(txnRes.body.data[0].amount).toBeCloseTo(200, 5);
  });

  it("POST /bookings with paymentMethod WALLET debits the wallet immediately, and rejects with 422 (no booking created) when the balance is insufficient", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

    // Insufficient balance first — the Haircut fixture costs 200.
    await seedWalletBalance(customer.id, 100);
    const insufficientRes = await request(app)
      .post("/api/v1/bookings")
      .set(authHeader(customer.accessToken))
      .send({
        salonId: fixture.salon.id,
        branchId: fixture.branch.id,
        services: [fixture.service.id],
        bookingDate: tomorrowDateString(),
        slotId: "10:00-10:30",
        paymentMethod: "WALLET",
      });
    expect(insufficientRes.status).toBe(422);

    const myBookingsAfterFailure = await request(app).get("/api/v1/bookings/my-bookings").set(authHeader(customer.accessToken));
    expect(myBookingsAfterFailure.body.data).toHaveLength(0);

    const stillUnchangedBalance = await request(app).get("/api/v1/wallet").set(authHeader(customer.accessToken));
    expect(stillUnchangedBalance.body.data.balance).toBeCloseTo(100, 5);

    // Top up and retry — should succeed and debit exactly the booking's total.
    await db.update(wallets).set({ balance: 300 }).where(eq(wallets.userId, customer.id));
    const createRes = await request(app)
      .post("/api/v1/bookings")
      .set(authHeader(customer.accessToken))
      .send({
        salonId: fixture.salon.id,
        branchId: fixture.branch.id,
        services: [fixture.service.id],
        bookingDate: tomorrowDateString(),
        slotId: "10:00-10:30",
        paymentMethod: "WALLET",
      });
    expect(createRes.status).toBe(201);

    const balanceAfterSpend = await request(app).get("/api/v1/wallet").set(authHeader(customer.accessToken));
    expect(balanceAfterSpend.body.data.balance).toBeCloseTo(100, 5); // 300 - 200

    const detail = await request(app).get(`/api/v1/bookings/${createRes.body.bookingId}`).set(authHeader(customer.accessToken));
    expect(detail.body.booking.paymentMethod).toBe("WALLET");
    expect(detail.body.booking.bookingStatus).toBe("PENDING");
    expect(detail.body.booking.requiresAdvancePayment).toBe(false); // paid in full upfront, same as ONLINE
  });

  it("rejecting a WALLET-paid booking refunds the spend back to the wallet in full", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);
    await seedWalletBalance(customer.id, 200);

    const createRes = await request(app)
      .post("/api/v1/bookings")
      .set(authHeader(customer.accessToken))
      .send({
        salonId: fixture.salon.id,
        branchId: fixture.branch.id,
        services: [fixture.service.id],
        bookingDate: tomorrowDateString(),
        slotId: "10:00-10:30",
        paymentMethod: "WALLET",
      });
    expect(createRes.status).toBe(201);

    const afterSpend = await request(app).get("/api/v1/wallet").set(authHeader(customer.accessToken));
    expect(afterSpend.body.data.balance).toBeCloseTo(0, 5);

    const rejectRes = await request(app)
      .post(`/api/v1/salon-bookings/${createRes.body.bookingId}/reject`)
      .set(authHeader(fixture.owner.accessToken))
      .send({ reason: "No availability" });
    expect(rejectRes.status).toBe(200);

    const afterRefund = await request(app).get("/api/v1/wallet").set(authHeader(customer.accessToken));
    expect(afterRefund.body.data.balance).toBeCloseTo(200, 5);

    const txnRes = await request(app).get("/api/v1/wallet/transactions").set(authHeader(customer.accessToken));
    expect(txnRes.body.data).toHaveLength(2); // DEBIT at creation, CREDIT at refund
    expect(txnRes.body.data[0].type).toBe("CREDIT"); // most recent first
    expect(txnRes.body.data[0].reason).toBe("BOOKING_REFUND");
  });

  it("cancelling a WALLET-paid booking (outside the cancellation cutoff) refunds the spend back to the wallet", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);
    await seedWalletBalance(customer.id, 200);

    const createRes = await request(app)
      .post("/api/v1/bookings")
      .set(authHeader(customer.accessToken))
      .send({
        salonId: fixture.salon.id,
        branchId: fixture.branch.id,
        services: [fixture.service.id],
        bookingDate: tomorrowDateString(),
        slotId: "10:00-10:30",
        paymentMethod: "WALLET",
      });
    expect(createRes.status).toBe(201);

    const cancelRes = await request(app)
      .post(`/api/v1/bookings/${createRes.body.bookingId}/cancel`)
      .set(authHeader(customer.accessToken))
      .send({});
    expect(cancelRes.status).toBe(200);

    const afterRefund = await request(app).get("/api/v1/wallet").set(authHeader(customer.accessToken));
    expect(afterRefund.body.data.balance).toBeCloseTo(200, 5);
  });
});
