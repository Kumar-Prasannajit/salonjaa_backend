import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/config/database";
import { salonOwnerProfiles, salons } from "@/db/schema";
import { CreateSalonInput, UpdateSalonInput } from "@/modules/salon/salon.types";

export class SalonRepository {
  async findOwnerProfileByUserId(userId: string) {
    const [profile] = await db
      .select()
      .from(salonOwnerProfiles)
      .where(and(eq(salonOwnerProfiles.userId, userId), isNull(salonOwnerProfiles.deletedAt)))
      .limit(1);
    return profile ?? null;
  }

  async createOwnerProfile(userId: string, businessName?: string, gstNumber?: string, panNumber?: string) {
    const [profile] = await db
      .insert(salonOwnerProfiles)
      .values({ userId, businessName, gstNumber, panNumber })
      .returning();
    return profile;
  }

  async createSalon(ownerProfileId: string, input: CreateSalonInput) {
    const [salon] = await db
      .insert(salons)
      .values({
        ownerProfileId,
        name: input.name,
        description: input.description,
      })
      .returning();
    return salon;
  }

  async listByOwnerProfile(ownerProfileId: string) {
    return db
      .select({ id: salons.id, name: salons.name })
      .from(salons)
      .where(and(eq(salons.ownerProfileId, ownerProfileId), isNull(salons.deletedAt)));
  }

  async findOwnedById(ownerProfileId: string, salonId: string) {
    const [salon] = await db
      .select()
      .from(salons)
      .where(and(eq(salons.id, salonId), eq(salons.ownerProfileId, ownerProfileId), isNull(salons.deletedAt)))
      .limit(1);
    return salon ?? null;
  }

  /** Resolves the owning user's ID from a salonId — used by Notification to address the owner. */
  async findOwnerUserIdBySalonId(salonId: string): Promise<string | null> {
    const [row] = await db
      .select({ userId: salonOwnerProfiles.userId })
      .from(salons)
      .innerJoin(salonOwnerProfiles, eq(salons.ownerProfileId, salonOwnerProfiles.id))
      .where(eq(salons.id, salonId))
      .limit(1);
    return row?.userId ?? null;
  }

  async findById(salonId: string) {
    const [salon] = await db
      .select()
      .from(salons)
      .where(and(eq(salons.id, salonId), isNull(salons.deletedAt)))
      .limit(1);
    return salon ?? null;
  }

  async update(salonId: string, input: UpdateSalonInput) {
    const [salon] = await db
      .update(salons)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(salons.id, salonId))
      .returning();
    return salon;
  }

  async softDelete(salonId: string) {
    await db.update(salons).set({ deletedAt: new Date() }).where(eq(salons.id, salonId));
  }
}
