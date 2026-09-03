export interface AdminSalonDTO {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  coverImage: string | null;
  status: string;
  verificationStatus: string;
  verificationReason: string | null;
  ownerProfile: {
    id: string;
    userId: string;
    businessName: string | null;
    gstNumber: string | null;
    panNumber: string | null;
    kycStatus: string;
  };
  createdAt: string;
}
