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

export interface EventEntity {
  id: string
  eventName: string
  eventType: string
  category: string
  description?: string
  propertySchema?: Record<string, unknown>
  appId: string
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

export interface AlarmEntity {
  id: string
  alarmType: string
  level: AlarmLevel
  message: string
  data?: Record<string, unknown>
  status: AlarmStatus
  createdAt: Date
  updatedAt: Date
}

export interface TraceEventEntity {
  eventId: string
  eventType: string
  appId: string
  userId?: string
  sessionId?: string
  properties?: Record<string, unknown>
  timestamp: Date
  ip?: string
  userAgent?: string
  source?: string
}

export interface TrackEventDto {
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

export interface CreateEventDto {
  eventName: string
  eventType: string
  category: string
  description?: string
  propertySchema?: Record<string, unknown>
  appId: string
}

export interface UpdateEventDto {
  eventName?: string
  description?: string
  propertySchema?: Record<string, unknown>
}

export interface EventQueryDto {
  page?: number
  pageSize?: number
  eventType?: string
  appId?: string
  keyword?: string
}

export interface AnalyticsSummary {
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

export interface UserInfo {
  id: string
  username: string
  role: string
}