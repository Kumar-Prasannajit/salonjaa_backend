export interface AdminCategoryDTO {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryInput {
  name: string;
  slug?: string;
  icon?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  icon?: string;
  status?: "ACTIVE" | "INACTIVE";
}
