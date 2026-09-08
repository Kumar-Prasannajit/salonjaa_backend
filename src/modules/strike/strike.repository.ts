import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/config/database";
import { customerStrikes } from "@/db/schema";
import { AddStrikeInput } from "@/modules/strike/strike.types";

export class StrikeRepository {
  async create(params: AddStrikeInput) {
    const [row] = await db
      .insert(customerStrikes)
      .values({
        customerId: params.customerId,
        bookingId: params.bookingId ?? null,
        type: params.type,
        notes: params.notes ?? null,
      })
      .returning();
    return row;
  }

  /** Live (non-removed) count, optionally scoped to one strike type. */
  async countActive(customerId: string, type?: "FAKE_BOOKING" | "NO_SHOW" | "ABUSIVE_CANCELLATION"): Promise<number> {
    const conditions = [eq(customerStrikes.customerId, customerId), isNull(customerStrikes.removedAt)];
    if (type) conditions.push(eq(customerStrikes.type, type));
    const rows = await db
      .select({ id: customerStrikes.id })
      .from(customerStrikes)
      .where(and(...conditions));
    return rows.length;
  }

  async listByCustomer(customerId: string) {
    return db
      .select()
      .from(customerStrikes)
      .where(eq(customerStrikes.customerId, customerId))
      .orderBy(desc(customerStrikes.createdAt));
  }

  async findById(strikeId: string) {
    const [row] = await db.select().from(customerStrikes).where(eq(customerStrikes.id, strikeId)).limit(1);
    return row ?? null;
  }

  async remove(strikeId: string, removedBy: string, removalReason: string) {
    const [row] = await db
      .update(customerStrikes)
      .set({ removedAt: new Date(), removedBy, removalReason })
      .where(eq(customerStrikes.id, strikeId))
      .returning();
    return row ?? null;
  }
}
