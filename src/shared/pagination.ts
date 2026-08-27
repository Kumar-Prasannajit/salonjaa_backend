import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/shared/constants";

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const rawLimit = Number.parseInt(String(query.limit ?? String(DEFAULT_PAGE_SIZE)), 10) || DEFAULT_PAGE_SIZE;
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, rawLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function toPaginatedResult<T>(items: T[], total: number, params: PaginationParams): PaginatedResult<T> {
  return {
    items,
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}
