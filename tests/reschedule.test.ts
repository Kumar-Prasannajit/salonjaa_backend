import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb } from "./helpers/db";
import { authHeader, createTestUser } from "./helpers/auth";
import { createBookableBranch, tomorrowDateString } from "./helpers/fixtures";
import { ROLE_NAMES } from "@/shared/constants";

async function createApprovedBooking(fixture: Awaited<ReturnType<typeof createBookableBranch>>, customerToken: string) {
  const createRes = await request(app)
    .post("/api/v1/bookings")
    .set(authHeader(customerToken))
    .send({
      salonId: fixture.salon.id,
      branchId: fixture.branch.id,
      services: [fixture.service.id],
      bookingDate: tomorrowDateString(),
      slotId: "10:00-10:30",
      paymentMethod: "PAY_AT_SALON",
    });
  const bookingId = createRes.body.bookingId;
  await request(app).post(`/api/v1/salon-bookings/${bookingId}/approve`).set(authHeader(fixture.owner.accessToken)).send({});
  return bookingId;
}

describe("Module 15 — customer response to a salon-proposed reschedule", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("customer can accept a SALON-initiated reschedule via the same approve-reschedule endpoint owners use", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);
    const bookingId = await createApprovedBooking(fixture, customer.accessToken);

    const proposeRes = await request(app)
      .post(`/api/v1/salon-bookings/${bookingId}/propose-reschedule`)
      .set(authHeader(fixture.owner.accessToken))
      .send({ bookingDate: tomorrowDateString(), slotId: "11:00-11:30" });
    expect(proposeRes.status).toBe(201);
    expect(proposeRes.body.data.requestedBy).toBe("SALON");

    // The owner cannot accept their own proposal via this endpoint — only the customer can.
    const ownerTriesToApprove = await request(app).post(`/api/v1/bookings/${bookingId}/approve-reschedule`).set(authHeader(fixture.owner.accessToken)).send({});
    expect(ownerTriesToApprove.status).toBe(404);

    const customerApproves = await request(app).post(`/api/v1/bookings/${bookingId}/approve-reschedule`).set(authHeader(customer.accessToken)).send({});
    expect(customerApproves.status).toBe(200);
    const newStart = new Date(customerApproves.body.data.scheduledStart);
    expect(newStart.getHours()).toBe(11);
  });

  it("customer can reject a SALON-initiated reschedule; the original schedule stays unchanged", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);
    const bookingId = await createApprovedBooking(fixture, customer.accessToken);

    await request(app)
      .post(`/api/v1/salon-bookings/${bookingId}/propose-reschedule`)
      .set(authHeader(fixture.owner.accessToken))
      .send({ bookingDate: tomorrowDateString(), slotId: "11:00-11:30" });

    const rejectRes = await request(app)
      .post(`/api/v1/bookings/${bookingId}/reject-reschedule`)
      .set(authHeader(customer.accessToken))
      .send({ reason: "Doesn't work for me" });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe("REJECTED");

    const detail = await request(app).get(`/api/v1/bookings/${bookingId}`).set(authHeader(customer.accessToken));
    expect(new Date(detail.body.booking.scheduledStart).getHours()).toBe(10);
  });

  it("owner still approves a CUSTOMER-initiated reschedule request (existing behavior unchanged)", async () => {
    const fixture = await createBookableBranch();
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);
    const bookingId = await createApprovedBooking(fixture, customer.accessToken);

    await request(app)
      .post(`/api/v1/bookings/${bookingId}/reschedule-request`)
      .set(authHeader(customer.accessToken))
      .send({ bookingDate: tomorrowDateString(), slotId: "11:00-11:30" });

    // The customer cannot approve their own request via this endpoint — only the owner can.
    const customerTriesToApprove = await request(app).post(`/api/v1/bookings/${bookingId}/approve-reschedule`).set(authHeader(customer.accessToken)).send({});
    expect(customerTriesToApprove.status).toBe(404);

    const ownerApproves = await request(app).post(`/api/v1/bookings/${bookingId}/approve-reschedule`).set(authHeader(fixture.owner.accessToken)).send({});
    expect(ownerApproves.status).toBe(200);
    expect(new Date(ownerApproves.body.data.scheduledStart).getHours()).toBe(11);
  });
});
