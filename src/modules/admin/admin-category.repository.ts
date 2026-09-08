import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/config/database";
import { serviceCategories, auditLogs, adminActions } from "@/db/schema";

interface AuditLogParams {
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValues: unknown;
  newValues: unknown;
  ipAddress?: string;
  userAgent?: string;
}

interface AdminActionParams {
  adminUserId: string;
  entityType: string;
  entityId: string;
  action: "APPROVE" | "REJECT" | "SUSPEND" | "REMOVE_STRIKE" | "REFUND" | "EDIT";
  notes?: string;
}

// Own repository, same "admin queries its own resource directly" precedent as admin-refund.*
// — service_categories previously had zero writers outside npm run db:seed (Module 4).
export class AdminCategoryRepository {
  async listAll() {
    return db.select().from(serviceCategories).where(isNull(serviceCategories.deletedAt)).orderBy(asc(serviceCategories.name));
  }

  async findById(id: string) {
    const [row] = await db
      .select()
      .from(serviceCategories)
      .where(and(eq(serviceCategories.id, id), isNull(serviceCategories.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string, excludeId?: string) {
    const conditions = [eq(serviceCategories.slug, slug), isNull(serviceCategories.deletedAt)];
    if (excludeId) conditions.push(ne(serviceCategories.id, excludeId));
    const [row] = await db
      .select()
      .from(serviceCategories)
      .where(and(...conditions))
      .limit(1);
    return row ?? null;
  }

  async create(params: { name: string; slug: string; icon: string | null }) {
    const [row] = await db.insert(serviceCategories).values(params).returning();
    return row;
  }

  async update(id: string, params: Partial<{ name: string; slug: string; icon: string | null; status: "ACTIVE" | "INACTIVE" }>) {
    const [row] = await db
      .update(serviceCategories)
      .set({ ...params, updatedAt: new Date() })
      .where(eq(serviceCategories.id, id))
      .returning();
    return row ?? null;
  }

  async softDelete(id: string) {
    const [row] = await db
      .update(serviceCategories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(serviceCategories.id, id))
      .returning();
    return row ?? null;
  }

  async writeAuditLog(params: AuditLogParams): Promise<void> {
    await db.insert(auditLogs).values(params);
  }

  async writeAdminAction(params: AdminActionParams): Promise<void> {
    await db.insert(adminActions).values(params);
  }
}
