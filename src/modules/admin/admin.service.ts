import { AdminRepository } from "@/modules/admin/admin.repository";
import { SalonService } from "@/modules/salon/salon.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { AdminSalonDTO } from "@/modules/admin/admin.types";
import { NotFoundError } from "@/shared/errors";
import { salons, salonOwnerProfiles } from "@/db/schema";

type SalonRow = typeof salons.$inferSelect;
type OwnerProfileRow = typeof salonOwnerProfiles.$inferSelect;

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export class AdminService {
  constructor(
    private readonly repo: AdminRepository = new AdminRepository(),
    private readonly salonService: SalonService = new SalonService(),
    private readonly notificationService: NotificationService = new NotificationService()
  ) {}

  async listSalons(status?: string): Promise<AdminSalonDTO[]> {
    const rows = await this.repo.listSalons(status);
    return rows.map((r) => this.toDTO(r.salon, r.ownerProfile));
  }

  async getSalon(salonId: string): Promise<AdminSalonDTO> {
    const row = await this.repo.findSalonById(salonId);
    if (!row) {
      throw new NotFoundError("Salon not found");
    }
    return this.toDTO(row.salon, row.ownerProfile);
  }

  async verifySalon(adminUserId: string, salonId: string, meta: RequestMeta): Promise<AdminSalonDTO> {
    const existing = await this.requireSalon(salonId);
    const updated = await this.repo.updateVerification(salonId, "VERIFIED", null);

    await this.logAction(adminUserId, salonId, "APPROVE", existing.salon, updated, meta, "Salon verified");
    await this.notifyOwner(salonId, "SALON_VERIFIED", { salonName: existing.salon.name });

    return this.toDTO(updated, existing.ownerProfile);
  }

  async rejectSalon(adminUserId: string, salonId: string, reason: string, meta: RequestMeta): Promise<AdminSalonDTO> {
    const existing = await this.requireSalon(salonId);
    const updated = await this.repo.updateVerification(salonId, "REJECTED", reason);

    await this.logAction(adminUserId, salonId, "REJECT", existing.salon, updated, meta, reason);
    await this.notifyOwner(salonId, "SALON_REJECTED", { salonName: existing.salon.name, reason });

    return this.toDTO(updated, existing.ownerProfile);
  }

  async suspendSalon(adminUserId: string, salonId: string, reason: string, meta: RequestMeta): Promise<AdminSalonDTO> {
    const existing = await this.requireSalon(salonId);
    const updated = await this.repo.updateStatus(salonId, "SUSPENDED");

    await this.logAction(adminUserId, salonId, "SUSPEND", existing.salon, updated, meta, reason);
    await this.notifyOwner(salonId, "SALON_SUSPENDED", { salonName: existing.salon.name, reason });

    return this.toDTO(updated, existing.ownerProfile);
  }

  async reactivateSalon(adminUserId: string, salonId: string, meta: RequestMeta): Promise<AdminSalonDTO> {
    const existing = await this.requireSalon(salonId);
    const updated = await this.repo.updateStatus(salonId, "ACTIVE");

    await this.logAction(adminUserId, salonId, "EDIT", existing.salon, updated, meta, "Salon reactivated");
    await this.notifyOwner(salonId, "SALON_REACTIVATED", { salonName: existing.salon.name });

    return this.toDTO(updated, existing.ownerProfile);
  }

  private async requireSalon(salonId: string) {
    const existing = await this.repo.findSalonById(salonId);
    if (!existing) {
      throw new NotFoundError("Salon not found");
    }
    return existing;
  }

  private async logAction(
    adminUserId: string,
    salonId: string,
    action: "APPROVE" | "REJECT" | "SUSPEND" | "EDIT",
    oldValues: unknown,
    newValues: unknown,
    meta: RequestMeta,
    notes?: string
  ): Promise<void> {
    await this.repo.writeAuditLog({
      actorId: adminUserId,
      entityType: "salon",
      entityId: salonId,
      action: `salon.${action.toLowerCase()}`,
      oldValues,
      newValues,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await this.repo.writeAdminAction({
      adminUserId,
      entityType: "salon",
      entityId: salonId,
      action,
      notes,
    });
  }

  private async notifyOwner(salonId: string, eventType: Parameters<NotificationService["notify"]>[0]["eventType"], data: Record<string, string>): Promise<void> {
    const ownerUserId = await this.salonService.findOwnerUserId(salonId);
    if (ownerUserId) {
      await this.notificationService.notify({ userId: ownerUserId, eventType, data });
    }
  }

  private toDTO(salon: SalonRow, ownerProfile: OwnerProfileRow): AdminSalonDTO {
    return {
      id: salon.id,
      name: salon.name,
      description: salon.description,
      logo: salon.logo,
      coverImage: salon.coverImage,
      status: salon.status,
      verificationStatus: salon.verificationStatus,
      verificationReason: salon.verificationReason,
      ownerProfile: {
        id: ownerProfile.id,
        userId: ownerProfile.userId,
        businessName: ownerProfile.businessName,
        gstNumber: ownerProfile.gstNumber,
        panNumber: ownerProfile.panNumber,
        kycStatus: ownerProfile.kycStatus,
      },
      createdAt: salon.createdAt.toISOString(),
    };
  }
}
