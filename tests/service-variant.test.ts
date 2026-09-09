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

describe("Module 22 — service variants (LUZO comparison item 1)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("owner CRUD: create, list, update, and soft-delete a variant", async () => {
    const { owner, service } = await createBookableBranch();

    const created = await request(app)
      .post(`/api/v1/services/${service.id}/variants`)
      .set(authHeader(owner.accessToken))
      .send({ name: "Diamond", price: 1499 });
    expect(created.status).toBe(201);
    expect(created.body.data.price).toBe(1499);
    const variantId = created.body.data.id;

    const list = await request(app).get(`/api/v1/services/${service.id}/variants`).set(authHeader(owner.accessToken));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const updated = await request(app)
      .patch(`/api/v1/services/${service.id}/variants/${variantId}`)
      .set(authHeader(owner.accessToken))
      .send({ price: 1599 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.price).toBe(1599);

    const removed = await request(app)
      .delete(`/api/v1/services/${service.id}/variants/${variantId}`)
      .set(authHeader(owner.accessToken));
    expect(removed.status).toBe(204);

    const listAfter = await request(app).get(`/api/v1/services/${service.id}/variants`).set(authHeader(owner.accessToken));
    expect(listAfter.body.data).toHaveLength(0);
  });

  it("GET /public/branches/:branchId surfaces active variants on the service", async () => {
    const { owner, branch, service } = await createBookableBranch();
    await request(app)
      .post(`/api/v1/services/${service.id}/variants`)
      .set(authHeader(owner.accessToken))
      .send({ name: "Papaya", price: 999 });

    const res = await request(app).get(`/api/v1/public/branches/${branch.id}`);
    expect(res.status).toBe(200);
    const svc = res.body.services.find((s: { id: string }) => s.id === service.id);
    expect(svc.variants).toHaveLength(1);
    expect(svc.variants[0]).toMatchObject({ name: "Papaya", price: 999 });
  });

  it("a service with an active variant requires variantId — 400 with a bare serviceId", async () => {
    const fixture = await createBookableBranch();
    await request(app)
      .post(`/api/v1/services/${fixture.service.id}/variants`)
      .set(authHeader(fixture.owner.accessToken))
      .send({ name: "Papaya", price: 999 });
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

    const res = await request(app).post("/api/v1/bookings").set(authHeader(customer.accessToken)).send(bookingBody(fixture));
    expect(res.status).toBe(400);
  });

  it("booking with a valid {serviceId, variantId} charges the variant price and snapshots variantName", async () => {
    const fixture = await createBookableBranch({ basePrice: 200 });
    const variant = await request(app)
      .post(`/api/v1/services/${fixture.service.id}/variants`)
      .set(authHeader(fixture.owner.accessToken))
      .send({ name: "Diamond", price: 1499 });
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

    const res = await request(app)
      .post("/api/v1/bookings")
      .set(authHeader(customer.accessToken))
      .send(bookingBody(fixture, { services: [{ serviceId: fixture.service.id, variantId: variant.body.data.id }] }));
    expect(res.status).toBe(201);

    const detail = await request(app).get(`/api/v1/bookings/${res.body.bookingId}`).set(authHeader(customer.accessToken));
    expect(detail.body.booking.services[0].variantId).toBe(variant.body.data.id);
    expect(detail.body.booking.services[0].variantName).toBe("Diamond");
    expect(detail.body.booking.services[0].price).toBe(1499);
    expect(detail.body.booking.totalAmount).toBe(1499);
  });

  it("rejects an unknown/foreign variantId for the service (400)", async () => {
    const fixture = await createBookableBranch();
    await request(app)
      .post(`/api/v1/services/${fixture.service.id}/variants`)
      .set(authHeader(fixture.owner.accessToken))
      .send({ name: "Papaya", price: 999 });
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

    const res = await request(app)
      .post("/api/v1/bookings")
      .set(authHeader(customer.accessToken))
      .send(bookingBody(fixture, { services: [{ serviceId: fixture.service.id, variantId: "00000000-0000-0000-0000-000000000000" }] }));
    expect(res.status).toBe(400);
  });

  it("rejects a variantId on a service that has no variants (400)", async () => {
    const fixture = await createBookableBranch();
    const otherFixture = await createBookableBranch();
    const strayVariant = await request(app)
      .post(`/api/v1/services/${otherFixture.service.id}/variants`)
      .set(authHeader(otherFixture.owner.accessToken))
      .send({ name: "Papaya", price: 999 });
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

    const res = await request(app)
      .post("/api/v1/bookings")
      .set(authHeader(customer.accessToken))
      .send(bookingBody(fixture, { services: [{ serviceId: fixture.service.id, variantId: strayVariant.body.data.id }] }));
    expect(res.status).toBe(400);
  });

  it("a service with no variants still books fine with a bare serviceId (backward compatible)", async () => {
    const fixture = await createBookableBranch({ basePrice: 300 });
    const customer = await createTestUser([ROLE_NAMES.CUSTOMER]);

    const res = await request(app).post("/api/v1/bookings").set(authHeader(customer.accessToken)).send(bookingBody(fixture));
    expect(res.status).toBe(201);
  });
});
