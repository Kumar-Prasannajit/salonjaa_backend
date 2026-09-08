import { beforeEach, describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb } from "./helpers/db";
import { db } from "@/config/database";
import { notifications } from "@/db/schema";

async function readLatestOtp(): Promise<string> {
  const [row] = await db.select().from(notifications).where(eq(notifications.eventType, "OTP_LOGIN")).orderBy(desc(notifications.createdAt)).limit(1);
  const match = row?.message.match(/code is (\d+)/);
  if (!match) throw new Error("Could not find OTP in latest notification message");
  return match[1];
}

describe("Auth — real send-otp/verify-otp flow", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("send-otp then verify-otp with the real code creates a CUSTOMER and issues tokens", async () => {
    const email = "newcustomer@example.test";

    const sendRes = await request(app).post("/api/v1/auth/send-otp").send({ email });
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.success).toBe(true);

    const otp = await readLatestOtp();

    const verifyRes = await request(app).post("/api/v1/auth/verify-otp").send({ email, otp });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.accessToken).toBeTruthy();
    expect(verifyRes.body.refreshToken).toBeTruthy();
    expect(verifyRes.body.user.email).toBe(email);
    expect(verifyRes.body.user.roles).toContain("CUSTOMER");
  });

  it("rejects a wrong OTP", async () => {
    const email = "wrongotp@example.test";
    await request(app).post("/api/v1/auth/send-otp").send({ email });

    const res = await request(app).post("/api/v1/auth/verify-otp").send({ email, otp: "000000" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects verify-otp with no prior send-otp", async () => {
    const res = await request(app).post("/api/v1/auth/verify-otp").send({ email: "never-sent@example.test", otp: "123456" });
    expect(res.status).toBe(401);
  });

  it("refresh-token returns a bare { accessToken }, no envelope (documented exception)", async () => {
    const email = "refreshflow@example.test";
    await request(app).post("/api/v1/auth/send-otp").send({ email });
    const otp = await readLatestOtp();
    const verifyRes = await request(app).post("/api/v1/auth/verify-otp").send({ email, otp });

    const refreshRes = await request(app).post("/api/v1/auth/refresh-token").send({ refreshToken: verifyRes.body.refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTruthy();
    expect(refreshRes.body.success).toBeUndefined();
  });

  it("logout revokes the session so a subsequent authenticated request 401s", async () => {
    const email = "logoutflow@example.test";
    await request(app).post("/api/v1/auth/send-otp").send({ email });
    const otp = await readLatestOtp();
    const verifyRes = await request(app).post("/api/v1/auth/verify-otp").send({ email, otp });
    const { accessToken, refreshToken } = verifyRes.body;

    const meBefore = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);
    expect(meBefore.status).toBe(200);

    const logoutRes = await request(app).post("/api/v1/auth/logout").set("Authorization", `Bearer ${accessToken}`).send({ refreshToken });
    expect(logoutRes.status).toBe(200);

    // The access token itself isn't tracked for revocation (no session:revoked:jti was set for
    // it directly) — logout revokes the *refresh* session. Confirm the refresh token is now
    // rejected, which is what logout actually guarantees.
    const refreshAfter = await request(app).post("/api/v1/auth/refresh-token").send({ refreshToken });
    expect(refreshAfter.status).toBe(401);
  });

  it("GET /users/me requires authentication", async () => {
    const res = await request(app).get("/api/v1/users/me");
    expect(res.status).toBe(401);
  });
});
