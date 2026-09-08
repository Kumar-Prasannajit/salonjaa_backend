import { eq } from "drizzle-orm";
import { db } from "@/config/database";
import { users, roles, userRoles } from "@/db/schema";
import { signAccessToken } from "@/config/jwt";
import { ROLE_NAMES, RoleName } from "@/shared/constants";

let counter = 0;

/**
 * Creates a real user row (+ role grants) directly in the test DB and signs a real access
 * token for it, bypassing the OTP ceremony entirely — the OTP flow itself is exercised for
 * real in tests/auth.test.ts (reading the code back from the notifications table, the same
 * way a real inbox would show it). Every other test just needs "a logged-in user with these
 * roles," same as this project's own db:grant-role dev script does for manual testing.
 */
export async function createTestUser(rolesToGrant: RoleName[] = [ROLE_NAMES.CUSTOMER]): Promise<{
  id: string;
  email: string;
  accessToken: string;
  roles: RoleName[];
}> {
  counter += 1;
  const email = `test-user-${Date.now()}-${counter}@example.test`;
  const [user] = await db.insert(users).values({ email, emailVerified: true, fullName: "Test User", status: "ACTIVE" }).returning();

  for (const roleName of rolesToGrant) {
    const [role] = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1);
    if (!role) {
      throw new Error(`Role ${roleName} not seeded — check tests/global-setup.ts`);
    }
    await db.insert(userRoles).values({ userId: user.id, roleId: role.id });
  }

  const accessToken = signAccessToken({ sub: user.id, roles: rolesToGrant, jti: `test-${user.id}-${Date.now()}` });
  return { id: user.id, email, accessToken, roles: rolesToGrant };
}

export function authHeader(accessToken: string): { Authorization: string } {
  return { Authorization: `Bearer ${accessToken}` };
}
