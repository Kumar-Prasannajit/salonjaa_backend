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

// Module 22 — docs/NEXT_SESSION_PLAN.md item 1. Price-only override (decided with the user);
// duration always matches the base service. Owner CRUD under /services/:id/variants, same
// sub-resource pattern as staff assignment above.
export interface CreateVariantInput {
  name: string;
  price: number;
}

export interface UpdateVariantInput {
  name?: string;
  price?: number;
  status?: "ACTIVE" | "INACTIVE";
}

export interface ServiceVariantDTO {
  id: string;
  branchServiceId: string;
  name: string;
  price: number;
  status: string;
}
