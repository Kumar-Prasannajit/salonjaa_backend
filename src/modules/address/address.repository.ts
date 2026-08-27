import { and, eq } from "drizzle-orm";
import { db } from "@/config/database";
import { userAddresses } from "@/db/schema";
import { CreateAddressInput, UpdateAddressInput } from "@/modules/address/address.types";

export class AddressRepository {
  async list(userId: string) {
    return db.select().from(userAddresses).where(eq(userAddresses.userId, userId)).orderBy(userAddresses.createdAt);
  }

  async findOwned(userId: string, addressId: string) {
    const [row] = await db
      .select()
      .from(userAddresses)
      .where(and(eq(userAddresses.id, addressId), eq(userAddresses.userId, userId)))
      .limit(1);
    return row ?? null;
  }

  async create(userId: string, input: CreateAddressInput) {
    const [row] = await db
      .insert(userAddresses)
      .values({ userId, ...input })
      .returning();
    return row;
  }

  async update(addressId: string, input: UpdateAddressInput) {
    const [row] = await db
      .update(userAddresses)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(userAddresses.id, addressId))
      .returning();
    return row;
  }

  async delete(addressId: string) {
    await db.delete(userAddresses).where(eq(userAddresses.id, addressId));
  }

  async clearDefaultForUser(userId: string) {
    await db.update(userAddresses).set({ isDefault: false }).where(eq(userAddresses.userId, userId));
  }
}
