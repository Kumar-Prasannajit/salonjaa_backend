export interface CreateSalonInput {
  name: string;
  description?: string;
  businessName?: string;
  gstNumber?: string;
  panNumber?: string;
}

export interface UpdateSalonInput {
  name?: string;
  description?: string;
  logo?: string;
  coverImage?: string;
}

export interface SalonDTO {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  coverImage: string | null;
  status: string;
  verificationStatus: string;
  verificationReason: string | null;
  createdAt: string;
}

export interface SalonListItemDTO {
  id: string;
  name: string;
}
