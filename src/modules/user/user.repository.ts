import { eq } from "drizzle-orm";
import { db } from "@/config/database";
import { users } from "@/db/schema";
import { UpdateProfileInput } from "@/modules/user/user.types";

export class UserRepository {
  async findById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  }

  async updateProfile(id: string, input: UpdateProfileInput) {
    const [updated] = await db
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }
}
