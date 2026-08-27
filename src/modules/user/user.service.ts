import { UserRepository } from "@/modules/user/user.repository";
import { UpdateProfileInput, UserProfileDTO } from "@/modules/user/user.types";
import { NotFoundError } from "@/shared/errors";

export class UserService {
  constructor(private readonly repo: UserRepository = new UserRepository()) {}

  async getProfile(userId: string): Promise<UserProfileDTO> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return this.toDTO(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfileDTO> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    const updated = await this.repo.updateProfile(userId, input);
    return this.toDTO(updated);
  }

  private toDTO(user: {
    id: string;
    fullName: string | null;
    email: string;
    phone: string | null;
    gender: string | null;
    dob: string | null;
    profileImage: string | null;
  }): UserProfileDTO {
    return {
      id: user.id,
      name: user.fullName,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      dob: user.dob,
      profileImage: user.profileImage,
    };
  }
}
