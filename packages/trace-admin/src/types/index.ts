export interface Event {
  id: string
  name: string
  type: string
  timestamp: string
  properties: Record<string, unknown>
  userId?: string
  sessionId?: string
}

export interface PageInfo {
  page: number
  pageSize: number
  total: number
}

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface AnalyticsOverview {
  totalEvents: number
  totalUsers: number
  avgSessionDuration: number
  conversionRate: number
}

export interface EventTrend {
  time: string
  count: number
}

export interface TopEvent {
  name: string
  count: number
  percentage: number
}

/** 按事件类型分组的多日趋势数据 */
export interface EventTypeTrendItem {
  time: string
  type: string
  count: number
}

/** 通用分页请求参数 */
export interface PaginationParams {
  page: number
  pageSize: number
  sortField?: string
  sortOrder?: string
}

/** 通用筛选配置项 */
export interface FilterConfig {
  key: string
  label: string
  type: 'input' | 'select' | 'date' | 'dateRange'
  options?: { value: string; label: string }[]
  placeholder?: string
}

export interface FilterItem {
  key: string
  label: string
  type: 'input' | 'select' | 'date'
  options?: { value: string; label: string }[]
  placeholder?: string
}
