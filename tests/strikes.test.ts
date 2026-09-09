import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb } from "./helpers/db";
import { authHeader, createTestUser } from "./helpers/auth";
import { createBookableBranch, tomorrowDateString } from "./helpers/fixtures";
import { db } from "@/config/database";
import { bookings, wallets, walletTransactions } from "@/db/schema";
import { ROLE_NAMES } from "@/shared/constants";

/** Creates + approves a PAY_AT_SALON booking, then pushes it into the past directly in the DB
 * (bypassing real-clock dependence — see comment in the test file this lives in) so
 * POST /salon-bookings/:id/no-show's "at/after scheduledStart" rule is satisfiable regardless
 * of what wall-clock time the suite happens to run at. */
async function createAndNoShow(fixtureAndCustomer: { fixture: Awaited<ReturnType<typeof createBookableBranch>>; customer: { accessToken: string } }) {
  const { fixture, customer } = fixtureAndCustomer;
  const createRes = await request(app)
    .post("/api/v1/bookings")
    .set(authHeader(customer.accessToken))
    .send({
      salonId: fixture.salon.id,
      branchId: fixture.branch.id,
      services: [fixture.service.id],
      bookingDate: tomorrowDateString(),
      slotId: "10:00-10:30",
      paymentMethod: "PAY_AT_SALON",
    });
  expect(createRes.status).toBe(201);
  const bookingId = createRes.body.bookingId;

  const approveRes = await request(app).post(`/api/v1/salon-bookings/${bookingId}/approve`).set(authHeader(fixture.owner.accessToken)).send({});
  expect(approveRes.status).toBe(200);
  expect(approveRes.body.data.bookingStatus).toBe("APPROVED");

  const past = new Date(Date.now() - 60 * 60 * 1000);
  await db.update(bookings).set({ scheduledStart: past, scheduledEnd: past }).where(eq(bookings.id, bookingId));

  const noShowRes = await request(app).post(`/api/v1/salon-bookings/${bookingId}/no-show`).set(authHeader(fixture.owner.accessToken)).send({});
  expect(noShowRes.status).toBe(200);
  expect(noShowRes.body.data.bookingStatus).toBe("NO_SHOW");
  return bookingId;
}

describe("Module 16 — customer strikes / advance payment / NO_SHOW", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("owner marking NO_SHOW records a strike visible on the admin strikes endpoint", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);
    const admin = await createTestUser([ROLE_NAMES.ADMIN]);

    await createAndNoShow({ fixture, customer });

    const strikesRes = await request(app).get(`/api/v1/admin/customers/${customer.id}/strikes`).set(authHeader(admin.accessToken));
    expect(strikesRes.status).toBe(200);
    expect(strikesRes.body.data.activeNoShowCount).toBe(1);
    expect(strikesRes.body.data.advancePaymentRequired).toBe(false);
  });

  it("owner cannot mark no-show before scheduledStart has passed", async () => {
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
        paymentMethod: "PAY_AT_SALON",
      });
    await request(app).post(`/api/v1/salon-bookings/${createRes.body.bookingId}/approve`).set(authHeader(fixture.owner.accessToken)).send({});

    const res = await request(app).post(`/api/v1/salon-bookings/${createRes.body.bookingId}/no-show`).set(authHeader(fixture.owner.accessToken)).send({});
    expect(res.status).toBe(400);
  });

  it("4th lifetime NO_SHOW strike requires a 10% advance deposit on the next PAY_AT_SALON booking, blocking approval until it's paid", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

    for (let i = 0; i < 4; i++) {
      await createAndNoShow({ fixture, customer });
    }

    const createRes = await request(app)
      .post("/api/v1/bookings")
      .set(authHeader(customer.accessToken))
      .send({
        salonId: fixture.salon.id,
        branchId: fixture.branch.id,
        services: [fixture.service.id],
        bookingDate: tomorrowDateString(),
        slotId: "10:00-10:30",
        paymentMethod: "PAY_AT_SALON",
      });
    expect(createRes.status).toBe(201);
    const bookingId = createRes.body.bookingId;

    const detail = await request(app).get(`/api/v1/bookings/${bookingId}`).set(authHeader(customer.accessToken));
    expect(detail.body.booking.requiresAdvancePayment).toBe(true);
    expect(detail.body.booking.advanceAmount).toBeCloseTo(20, 5); // 10% of a 200 haircut

    // Owner cannot approve yet — advance hasn't been paid.
    const blockedApprove = await request(app).post(`/api/v1/salon-bookings/${bookingId}/approve`).set(authHeader(fixture.owner.accessToken)).send({});
    expect(blockedApprove.status).toBe(409);

    // Pay the advance via the same create-order/verify endpoints (purpose ADVANCE).
    const orderRes = await request(app).post("/api/v1/payments/create-order").set(authHeader(customer.accessToken)).send({ bookingId });
    expect(orderRes.status).toBe(201);
    expect(orderRes.body.amount).toBeCloseTo(20, 5);

    const crypto = await import("node:crypto");
    const { env } = await import("@/config/env");
    const paymentId = "pay_advance_test1";
    const signature = crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${orderRes.body.orderId}|${paymentId}`).digest("hex");
    const verifyRes = await request(app)
      .post("/api/v1/payments/verify")
      .set(authHeader(customer.accessToken))
      .send({ orderId: orderRes.body.orderId, paymentId, signature });
    expect(verifyRes.status).toBe(200);

    // Now the owner can approve — PAY_AT_SALON still goes straight to APPROVED (no
    // AWAITING_PAYMENT step; only the 10% advance was collected online).
    const approveRes = await request(app).post(`/api/v1/salon-bookings/${bookingId}/approve`).set(authHeader(fixture.owner.accessToken)).send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.bookingStatus).toBe("APPROVED");

    // Cancelling it (outside the 2h cutoff) forfeits the advance to the customer's wallet
    // instead of refunding it (Module 20 — replaces Module 16's original forfeiture-coupon
    // mechanism).
    const cancelRes = await request(app).post(`/api/v1/bookings/${bookingId}/cancel`).set(authHeader(customer.accessToken)).send({});
    expect(cancelRes.status).toBe(200);

    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, customer.id));
    expect(wallet).toBeTruthy();
    expect(wallet.balance).toBeCloseTo(20, 5);

    const [txn] = await db.select().from(walletTransactions).where(eq(walletTransactions.walletId, wallet.id));
    expect(txn.type).toBe("CREDIT");
    expect(txn.reason).toBe("ADVANCE_FORFEITURE");
    expect(txn.amount).toBeCloseTo(20, 5);
  });

  it("choosing ONLINE payment skips the advance-payment requirement even when restricted (full payment already covers it)", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);
    for (let i = 0; i < 4; i++) {
      await createAndNoShow({ fixture, customer });
    }

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
    expect(createRes.status).toBe(201);

    const detail = await request(app).get(`/api/v1/bookings/${createRes.body.bookingId}`).set(authHeader(customer.accessToken));
    expect(detail.body.booking.requiresAdvancePayment).toBe(false);
    expect(detail.body.booking.advanceAmount).toBeNull();
  });
});
