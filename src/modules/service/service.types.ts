export interface CreateServiceInput {
  branchId: string;
  categoryId: string;
  name: string;
  durationMinutes: number;
  basePrice: number;
}

export interface UpdateServiceInput {
  categoryId?: string;
  name?: string;
  description?: string;
  durationMinutes?: number;
  basePrice?: number;
  imageUrl?: string;
}

export interface ServiceDTO {
  id: string;
  branchId: string;
  categoryId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  basePrice: number;
  imageUrl: string | null;
  status: string;
}
