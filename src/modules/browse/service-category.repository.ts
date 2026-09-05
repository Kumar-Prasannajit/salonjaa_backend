import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/config/database";
import { serviceCategories } from "@/db/schema";

export class ServiceCategoryRepository {
  async listActive() {
    return db
      .select({ id: serviceCategories.id, name: serviceCategories.name, icon: serviceCategories.icon })
      .from(serviceCategories)
      .where(and(eq(serviceCategories.status, "ACTIVE"), isNull(serviceCategories.deletedAt)))
      .orderBy(asc(serviceCategories.name));
  }
}
