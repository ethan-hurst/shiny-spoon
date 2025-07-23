export interface ApiResponse<T> {
  data: T | null
  error: ApiError | null
  count?: number
}

export interface ApiError {
  message: string
  code: string
  details?: unknown
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}