import request from '@/utils/request'
import type {
  AnalyticsOverview,
  TrendData,
  SummaryQueryDto,
  TrendQueryDto,
  FilterQueryDto,
  TopEvent,
  EventTypeTrendItem,
} from '@/types'

export const getSummary = (params: SummaryQueryDto) => {
  return request.get<AnalyticsOverview>('/analysis/summary', { params })
}

export const getTrend = (params: TrendQueryDto) => {
  return request.get<TrendData[]>('/analysis/trend', { params })
}

export const filterData = (data: FilterQueryDto) => {
  return request.post<{ list: unknown[]; total: number }>('/analysis/filter', data)
}

export const getTopEvents = (params: {
  limit?: number
  startTime?: string
  endTime?: string
}) => {
  return request.get<TopEvent[]>('/analytics/top-events', { params })
}

export const getConversionRate = (params: {
  startTime?: string
  endTime?: string
}) => {
  return request.get<{ rate: number }>('/analytics/conversion-rate', { params })
}

/** 获取按事件类型分组的多日趋势数据 */
export const getEventTypeTrend = (params: {
  startTime?: string
  endTime?: string
}) => {
  return request.get<EventTypeTrendItem[]>('/analytics/event-type-trend', { params })
}