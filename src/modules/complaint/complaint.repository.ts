import { db } from "@/config/database";
import { complaints } from "@/db/schema";

export class ComplaintRepository {
  async create(filedByUserId: string, input: { type: string; referenceId?: string; description: string }) {
    const [row] = await db
      .insert(complaints)
      .values({
        filedByUserId,
        type: input.type as never,
        referenceId: input.referenceId,
        description: input.description,
      })
      .returning();
    return row;
  }
}
