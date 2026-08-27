import { and, eq, gt } from "drizzle-orm";
import { db } from "@/config/database";
import { users, roles, userRoles, refreshTokens, emailOtps } from "@/db/schema";
import type { OtpPurpose } from "@/shared/constants";

export class AuthRepository {
  // ---- Users & roles ----

  async findUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user ?? null;
  }

  async findUserById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  }

  async getUserRoleNames(userId: string): Promise<string[]> {
    const rows = await db
      .select({ name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));
    return rows.map((r) => r.name);
  }

  async createUserWithDefaultRole(email: string, roleName: string) {
    return db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ email, emailVerified: true }).returning();

      const [role] = await tx.select().from(roles).where(eq(roles.name, roleName as never)).limit(1);
      if (!role) {
        throw new Error(`Role ${roleName} is not seeded`);
      }
      await tx.insert(userRoles).values({ userId: user.id, roleId: role.id });
      return user;
    });
  }

  async markEmailVerified(userId: string) {
    await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  // ---- OTP ----

  async findActiveOtp(email: string, purpose: OtpPurpose) {
    const [otp] = await db
      .select()
      .from(emailOtps)
      .where(and(eq(emailOtps.email, email), eq(emailOtps.purpose, purpose as never), eq(emailOtps.status, "ACTIVE")))
      .limit(1);
    return otp ?? null;
  }

  async invalidateActiveOtps(email: string, purpose: OtpPurpose) {
    await db
      .update(emailOtps)
      .set({ status: "EXPIRED" })
      .where(and(eq(emailOtps.email, email), eq(emailOtps.purpose, purpose as never), eq(emailOtps.status, "ACTIVE")));
  }

  async createOtp(email: string, purpose: OtpPurpose, otpHash: string, expiresAt: Date) {
    const [otp] = await db
      .insert(emailOtps)
      .values({ email, purpose: purpose as never, otpHash, expiresAt, status: "ACTIVE" })
      .returning();
    return otp;
  }

  async getOtpById(otpId: string) {
    const [otp] = await db.select().from(emailOtps).where(eq(emailOtps.id, otpId)).limit(1);
    return otp ?? null;
  }

  async bumpOtpAttempts(otpId: string, attempts: number) {
    await db.update(emailOtps).set({ attempts }).where(eq(emailOtps.id, otpId));
  }

  async markOtpVerified(otpId: string) {
    await db.update(emailOtps).set({ status: "VERIFIED", verifiedAt: new Date() }).where(eq(emailOtps.id, otpId));
  }

  // ---- Refresh tokens ----

  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    const [row] = await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt }).returning();
    return row;
  }

  async findActiveRefreshTokenById(id: string) {
    const [row] = await db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.id, id), gt(refreshTokens.expiresAt, new Date())))
      .limit(1);
    return row && !row.revokedAt ? row : null;
  }

  async revokeRefreshToken(id: string) {
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, id));
  }

  async setRefreshTokenHash(id: string, tokenHash: string) {
    await db.update(refreshTokens).set({ tokenHash }).where(eq(refreshTokens.id, id));
  }
}
