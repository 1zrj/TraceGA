export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function paginate(
  page: number = 1,
  pageSize: number = 20,
): { skip: number; take: number } {
  const skip = (page - 1) * pageSize
  const take = pageSize
  return { skip, take }
}

export function buildPaginationResult<T>(
  list: T[],
  total: number,
  page: number,
  pageSize: number,
) {
  return {
    list,
    total,
    page,
    pageSize,
  }
}
