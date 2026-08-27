import { AddressRepository } from "@/modules/address/address.repository";
import { AddressDTO, CreateAddressInput, UpdateAddressInput } from "@/modules/address/address.types";
import { NotFoundError } from "@/shared/errors";

export class AddressService {
  constructor(private readonly repo: AddressRepository = new AddressRepository()) {}

  async list(userId: string): Promise<AddressDTO[]> {
    const rows = await this.repo.list(userId);
    return rows.map(this.toDTO);
  }

  async create(userId: string, input: CreateAddressInput): Promise<AddressDTO> {
    if (input.isDefault) {
      await this.repo.clearDefaultForUser(userId);
    }
    const row = await this.repo.create(userId, input);
    return this.toDTO(row);
  }

  async update(userId: string, addressId: string, input: UpdateAddressInput): Promise<AddressDTO> {
    await this.assertOwned(userId, addressId);
    if (input.isDefault) {
      await this.repo.clearDefaultForUser(userId);
    }
    const row = await this.repo.update(addressId, input);
    return this.toDTO(row);
  }

  async remove(userId: string, addressId: string): Promise<void> {
    await this.assertOwned(userId, addressId);
    await this.repo.delete(addressId);
  }

  private async assertOwned(userId: string, addressId: string) {
    const existing = await this.repo.findOwned(userId, addressId);
    if (!existing) {
      // Distinguish "doesn't exist" from "exists but not yours" only via NotFound to avoid
      // leaking existence of other users' address IDs.
      throw new NotFoundError("Address not found");
    }
    return existing;
  }

  private toDTO(row: {
    id: string;
    label: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    latitude: number | null;
    longitude: number | null;
    isDefault: boolean;
  }): AddressDTO {
    return {
      id: row.id,
      label: row.label,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      city: row.city,
      state: row.state,
      postalCode: row.postalCode,
      latitude: row.latitude,
      longitude: row.longitude,
      isDefault: row.isDefault,
    };
  }
}
