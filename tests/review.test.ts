import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb } from "./helpers/db";
import { authHeader, createTestUser } from "./helpers/auth";
import { createBookableBranch, tomorrowDateString } from "./helpers/fixtures";
import { db } from "@/config/database";
import { bookings } from "@/db/schema";
import { ROLE_NAMES } from "@/shared/constants";

/** Creates a COMPLETED, reviewable booking — direct DB write to reach COMPLETED, same
 * "bypass the HTTP flow for hard-to-reach state" precedent as fixtures.ts's verifySalon. */
async function createCompletedBooking(fixture: Awaited<ReturnType<typeof createBookableBranch>>) {
  const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);
  const createRes = await request(app)
    .post("/api/v1/bookings")
    .set(authHeader(customer.accessToken))
    .send({
      salonId: fixture.salon.id,
      branchId: fixture.branch.id,
      services: [fixture.service.id],
      staffId: fixture.staffMember.id,
      bookingDate: tomorrowDateString(),
      slotId: "10:00-10:30",
      paymentMethod: "PAY_AT_SALON",
    });
  const bookingId = createRes.body.bookingId;
  await request(app).post(`/api/v1/salon-bookings/${bookingId}/approve`).set(authHeader(fixture.owner.accessToken)).send({});
  await db.update(bookings).set({ bookingStatus: "COMPLETED" }).where(eq(bookings.id, bookingId));
  return { customer, bookingId };
}

describe("Reviews — replies visible through the list endpoints", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("a reply posted via POST /reviews/:reviewId/reply shows up through GET /reviews/salon/:salonId, not just getDetail", async () => {
    const fixture = await createBookableBranch();
    const { customer, bookingId } = await createCompletedBooking(fixture);

    const reviewRes = await request(app)
      .post("/api/v1/reviews")
      .set(authHeader(customer.accessToken))
      .send({
        bookingId,
        overallRating: 5,
        review: "Great cut",
        serviceRating: 5,
        staffRating: 5,
        hygieneRating: 5,
        ambienceRating: 5,
        productRating: 5,
      });
    expect(reviewRes.status).toBe(201);
    const reviewId = reviewRes.body.data.id;
    expect(reviewRes.body.data.reply).toBeNull();

    const replyRes = await request(app)
      .post(`/api/v1/reviews/${reviewId}/reply`)
      .set(authHeader(fixture.owner.accessToken))
      .send({ message: "Thanks for visiting!" });
    expect(replyRes.status).toBe(201);
    expect(replyRes.body.data.reply?.message).toBe("Thanks for visiting!");

    const salonList = await request(app).get(`/api/v1/reviews/salon/${fixture.salon.id}`);
    expect(salonList.status).toBe(200);
    const listed = salonList.body.data.find((r: { id: string }) => r.id === reviewId);
    expect(listed).toBeTruthy();
    expect(listed.reply?.message).toBe("Thanks for visiting!");

    const staffList = await request(app).get(`/api/v1/reviews/staff/${fixture.staffMember.id}`);
    expect(staffList.body.data.find((r: { id: string }) => r.id === reviewId)?.reply?.message).toBe("Thanks for visiting!");

    const serviceList = await request(app).get(`/api/v1/reviews/service/${fixture.service.id}`);
    expect(serviceList.body.data.find((r: { id: string }) => r.id === reviewId)?.reply?.message).toBe("Thanks for visiting!");
  });
});
