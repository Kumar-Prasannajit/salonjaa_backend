import { AdminCategoryRepository } from "@/modules/admin/admin-category.repository";
import { RequestMeta } from "@/modules/admin/admin.service";
import { AdminCategoryDTO, CreateCategoryInput, UpdateCategoryInput } from "@/modules/admin/admin-category.types";
import { ConflictError, NotFoundError } from "@/shared/errors";
import { serviceCategories } from "@/db/schema";

type CategoryRow = typeof serviceCategories.$inferSelect;

/**
 * Module 16 — new contract, not from ADMIN_CONTRACT.md (which explicitly excluded
 * category/coupon management). service_categories existed since Module 4 with zero write
 * consumers beyond npm run db:seed; this is its first real CRUD surface.
 */
export class AdminCategoryService {
  constructor(private readonly repo: AdminCategoryRepository = new AdminCategoryRepository()) {}

  async list(): Promise<AdminCategoryDTO[]> {
    const rows = await this.repo.listAll();
    return rows.map((r) => this.toDTO(r));
  }

  async create(adminUserId: string, input: CreateCategoryInput, meta: RequestMeta): Promise<AdminCategoryDTO> {
    const slug = input.slug ?? this.slugify(input.name);
    const existing = await this.repo.findBySlug(slug);
    if (existing) {
      throw new ConflictError("A category with this slug already exists");
    }
    const row = await this.repo.create({ name: input.name, slug, icon: input.icon ?? null });
    await this.logAction(adminUserId, row.id, "EDIT", null, row, meta, "Category created");
    return this.toDTO(row);
  }

  async update(adminUserId: string, id: string, input: UpdateCategoryInput, meta: RequestMeta): Promise<AdminCategoryDTO> {
    const existing = await this.requireCategory(id);
    if (input.slug && input.slug !== existing.slug) {
      const clash = await this.repo.findBySlug(input.slug, id);
      if (clash) {
        throw new ConflictError("A category with this slug already exists");
      }
    }
    const updated = await this.repo.update(id, input);
    await this.logAction(adminUserId, id, "EDIT", existing, updated, meta, "Category updated");
    return this.toDTO(updated!);
  }

  async remove(adminUserId: string, id: string, meta: RequestMeta): Promise<void> {
    const existing = await this.requireCategory(id);
    const updated = await this.repo.softDelete(id);
    await this.logAction(adminUserId, id, "EDIT", existing, updated, meta, "Category deleted");
  }

  private async requireCategory(id: string): Promise<CategoryRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundError("Category not found");
    }
    return row;
  }

  private slugify(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private async logAction(
    adminUserId: string,
    categoryId: string,
    action: "EDIT",
    oldValues: unknown,
    newValues: unknown,
    meta: RequestMeta,
    notes?: string
  ): Promise<void> {
    await this.repo.writeAuditLog({
      actorId: adminUserId,
      entityType: "service_category",
      entityId: categoryId,
      action: `category.${action.toLowerCase()}`,
      oldValues,
      newValues,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await this.repo.writeAdminAction({ adminUserId, entityType: "service_category", entityId: categoryId, action, notes });
  }

  private toDTO(row: CategoryRow): AdminCategoryDTO {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      icon: row.icon,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
