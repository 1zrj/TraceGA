export interface ApiResponse<T = null> {
  code: number
  data: T
  msg: string
}

export interface PagedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export enum ErrorCode {
  SUCCESS = 0,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_ERROR = 500,
  EVENT_NOT_FOUND = 10001,
  EVENT_NAME_EXISTS = 10002,
  TRACK_VALIDATION_ERROR = 20001,
  TRACK_RATE_LIMIT = 20002,
  ANALYSIS_QUERY_ERROR = 30001,
  ALARM_RULE_NOT_FOUND = 40001,
  AI_SERVICE_ERROR = 50001,
}

export type AlarmLevel = 'low' | 'medium' | 'high' | 'critical'

export type AlarmStatus = 'pending' | 'resolved' | 'acknowledged'

export type TrendInterval = 'hour' | 'day' | 'week'

export interface Event {
  id: string
  eventName: string
  eventType: string
  category: string
  description?: string
  propertySchema?: Record<string, unknown>
  appId: string
  createdAt: string
  updatedAt: string
}

export interface EventEntity {
  id: string
  eventName: string
  eventType: string
  category: string
  description?: string
  propertySchema?: Record<string, unknown>
  appId: string
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface AlarmItem {
  id: string
  alarmType: string
  level: AlarmLevel
  message: string
  data: Record<string, unknown>
  status: AlarmStatus
  createdAt: string
  updatedAt: string
}

export interface TraceEvent {
  eventType: string
  appId: string
  userId?: string
  sessionId?: string
  properties?: Record<string, unknown>
  timestamp?: number
  ip?: string
  userAgent?: string
  source?: string
}

export interface AnalyticsOverview {
  pv: number
  uv: number
  rate: string
  startTime: string
  endTime: string
}

export interface TrendData {
  time: string
  pv: number
  uv: number
}

export interface AiAnalysisResult {
  conclusion: string
  suggestions: string[]
  data: Record<string, unknown>
}

export interface UserInfo {
  id: string
  username: string
  role: string
}

export interface FilterItem {
  key: string
  label: string
  type: 'input' | 'select' | 'date'
  options?: { value: string; label: string }[]
  placeholder?: string
}

export interface PageInfo {
  page: number
  pageSize: number
  total: number
}

export interface EventQueryDto {
  page?: number
  pageSize?: number
  eventType?: string
  appId?: string
  keyword?: string
}

export interface SummaryQueryDto {
  startTime: string
  endTime: string
  appId?: string
  eventType?: string
}

export interface TrendQueryDto {
  startTime: string
  endTime: string
  interval: TrendInterval
  appId?: string
  eventType?: string
}

export interface FilterQueryDto {
  startTime: string
  endTime: string
  filters: {
    key: string
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'like'
    value: unknown
  }[]
  groupBy?: string[]
  orderBy?: {
    field: string
    direction: 'ASC' | 'DESC'
  }
}

export interface AlarmQueryDto {
  page?: number
  pageSize?: number
  level?: AlarmLevel
  status?: AlarmStatus
  startTime?: string
  endTime?: string
}

export interface AiAnalyzeDto {
  prompt: string
  startTime?: string
  endTime?: string
  appId?: string
}

export interface LoginDto {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: UserInfo
}