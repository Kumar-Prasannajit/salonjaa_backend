import { eq } from "drizzle-orm";
import { db } from "@/config/database";
import { notifications, users } from "@/db/schema";

export class NotificationRepository {
  async findUserEmail(userId: string): Promise<string | null> {
    const [row] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    return row?.email ?? null;
  }

  async create(params: { userId: string; type: "EMAIL"; eventType: string; subject: string; message: string }) {
    const [row] = await db
      .insert(notifications)
      .values({ ...params, status: "PENDING" })
      .returning();
    return row;
  }

  async findById(id: string) {
    const [row] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    return row ?? null;
  }

  async markSent(id: string) {
    await db.update(notifications).set({ status: "SENT", sentAt: new Date() }).where(eq(notifications.id, id));
  }

  async markFailed(id: string) {
    await db.update(notifications).set({ status: "FAILED" }).where(eq(notifications.id, id));
  }
}
