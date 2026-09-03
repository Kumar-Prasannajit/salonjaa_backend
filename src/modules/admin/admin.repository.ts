import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/config/database";
import { salons, salonOwnerProfiles, auditLogs, adminActions } from "@/db/schema";

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

export class AdminRepository {
  async listSalons(verificationStatus?: string) {
    const conditions = [isNull(salons.deletedAt), isNull(salonOwnerProfiles.deletedAt)];
    if (verificationStatus) {
      conditions.push(eq(salons.verificationStatus, verificationStatus as never));
    }
    return db
      .select({ salon: salons, ownerProfile: salonOwnerProfiles })
      .from(salons)
      .innerJoin(salonOwnerProfiles, eq(salons.ownerProfileId, salonOwnerProfiles.id))
      .where(and(...conditions))
      .orderBy(desc(salons.createdAt));
  }

  async findSalonById(salonId: string) {
    const [row] = await db
      .select({ salon: salons, ownerProfile: salonOwnerProfiles })
      .from(salons)
      .innerJoin(salonOwnerProfiles, eq(salons.ownerProfileId, salonOwnerProfiles.id))
      .where(and(eq(salons.id, salonId), isNull(salons.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async updateVerification(salonId: string, verificationStatus: "VERIFIED" | "REJECTED", verificationReason: string | null) {
    const [row] = await db
      .update(salons)
      .set({ verificationStatus, verificationReason, updatedAt: new Date() })
      .where(eq(salons.id, salonId))
      .returning();
    return row;
  }

  async updateStatus(salonId: string, status: "ACTIVE" | "SUSPENDED") {
    const [row] = await db
      .update(salons)
      .set({ status, updatedAt: new Date() })
      .where(eq(salons.id, salonId))
      .returning();
    return row;
  }

  async writeAuditLog(params: AuditLogParams): Promise<void> {
    await db.insert(auditLogs).values({
      actorId: params.actorId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      oldValues: params.oldValues,
      newValues: params.newValues,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  async writeAdminAction(params: AdminActionParams): Promise<void> {
    await db.insert(adminActions).values(params);
  }
}
