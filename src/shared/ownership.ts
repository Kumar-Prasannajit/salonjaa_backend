import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/config/database";
import { salonOwnerProfiles } from "@/db/schema";

/** Returns the caller's active owner-profile id, or null if they have none yet. */
export async function getActiveOwnerProfileId(userId: string): Promise<string | null> {
  const [profile] = await db
    .select({ id: salonOwnerProfiles.id })
    .from(salonOwnerProfiles)
    .where(and(eq(salonOwnerProfiles.userId, userId), isNull(salonOwnerProfiles.deletedAt)))
    .limit(1);
  return profile?.id ?? null;
}
