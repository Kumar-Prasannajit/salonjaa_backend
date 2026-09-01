import { SalonRepository } from "@/modules/salon/salon.repository";
import { CreateSalonInput, SalonDTO, SalonListItemDTO, UpdateSalonInput } from "@/modules/salon/salon.types";
import { NotFoundError } from "@/shared/errors";

export class SalonService {
  constructor(private readonly repo: SalonRepository = new SalonRepository()) {}

  async createSalon(userId: string, input: CreateSalonInput): Promise<SalonDTO> {
    // Find-or-create the caller's owner profile. A user may register several salons
    // under one owner profile, so only the first registration creates the profile row;
    // businessName/gstNumber/panNumber supplied on later salon creations are ignored
    // here (owner-profile edits are out of scope until an Admin/profile endpoint exists).
    let profile = await this.repo.findOwnerProfileByUserId(userId);
    if (!profile) {
      profile = await this.repo.createOwnerProfile(userId, input.businessName, input.gstNumber, input.panNumber);
    }

    const salon = await this.repo.createSalon(profile.id, input);
    return this.toDTO(salon);
  }

  async listMySalons(userId: string): Promise<SalonListItemDTO[]> {
    const profile = await this.repo.findOwnerProfileByUserId(userId);
    if (!profile) return [];
    return this.repo.listByOwnerProfile(profile.id);
  }

  async getMySalon(userId: string, salonId: string): Promise<SalonDTO> {
    const salon = await this.assertOwned(userId, salonId);
    return this.toDTO(salon);
  }

  async updateMySalon(userId: string, salonId: string, input: UpdateSalonInput): Promise<SalonDTO> {
    await this.assertOwned(userId, salonId);
    const updated = await this.repo.update(salonId, input);
    return this.toDTO(updated);
  }

  async deleteMySalon(userId: string, salonId: string): Promise<void> {
    await this.assertOwned(userId, salonId);
    await this.repo.softDelete(salonId);
  }

  /** Used by other modules (Branch, Staff, Service) to verify ownership before mutating child resources. */
  async assertOwned(userId: string, salonId: string) {
    const profile = await this.repo.findOwnerProfileByUserId(userId);
    if (!profile) {
      throw new NotFoundError("Salon not found");
    }
    const salon = await this.repo.findOwnedById(profile.id, salonId);
    if (!salon) {
      throw new NotFoundError("Salon not found");
    }
    return salon;
  }

  private toDTO(salon: {
    id: string;
    name: string;
    description: string | null;
    logo: string | null;
    coverImage: string | null;
    status: string;
    verificationStatus: string;
    verificationReason: string | null;
    createdAt: Date;
  }): SalonDTO {
    return {
      id: salon.id,
      name: salon.name,
      description: salon.description,
      logo: salon.logo,
      coverImage: salon.coverImage,
      status: salon.status,
      verificationStatus: salon.verificationStatus,
      verificationReason: salon.verificationReason,
      createdAt: salon.createdAt.toISOString(),
    };
  }
}
