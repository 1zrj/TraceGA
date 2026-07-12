export interface ApiResponse<T = any> {
  code: number
  data: T
  msg: string
}

export interface PaginatedResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface PaginationParams {
  page?: number
  pageSize?: number
}
