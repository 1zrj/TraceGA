import request from '@/utils/request'
import type {
  AnalyticsOverview,
  AnalysisSummary,
  AnalysisSummaryDto,
  AnalysisTrendItem,
  AnalysisTrendDto,
  AnalysisFilterDto,
  AnalysisFilterItem,
  EventTrend,
  TopEvent,
  EventTypeTrendItem,
  ErrorEventItem,
} from '@/types'

/** 获取分析概览（首页 PV/UV/人均访问次数） */
export const getSummary = (params?: AnalysisSummaryDto) => {
  return request.get<AnalysisSummary>('/analysis/summary', { params })
}

/** 获取趋势数据 */
export const getAnalysisTrend = (params?: AnalysisTrendDto) => {
  return request.get<AnalysisTrendItem[]>('/analysis/trend', { params })
}

/** 筛选查询 */
export const postAnalysisFilter = (data: AnalysisFilterDto) => {
  return request.post<AnalysisFilterItem[]>('/analysis/filter', data)
}

export const getOverview = (params: { startTime?: string; endTime?: string }) => {
  return request.get<AnalyticsOverview>('/analytics/overview', { params })
}

export const getEventTrend = (params: {
  startTime?: string
  endTime?: string
  interval?: 'hour' | 'day' | 'week'
}) => {
  return request.get<EventTrend[]>('/analytics/event-trend', { params })
}

export const getTopEvents = (params: { limit?: number; startTime?: string; endTime?: string }) => {
  return request.get<TopEvent[]>('/analytics/top-events', { params })
}

export const getConversionRate = (params: { startTime?: string; endTime?: string }) => {
  return request.get<{ rate: number }>('/analytics/conversion-rate', { params })
}

/** 获取按事件类型分组的多日趋势数据 */
export const getEventTypeTrend = (params: { startTime?: string; endTime?: string }) => {
  return request.get<EventTypeTrendItem[]>('/analytics/event-type-trend', { params })
}

/** 获取错误事件列表 */
export const getErrorEvents = (params?: { startTime?: string; endTime?: string }) => {
  return request.get<ErrorEventItem[]>('/analytics/error-events', { params })
}

/** 获取错误事件按日聚合趋势 */
export const getErrorTrend = (params?: { startTime?: string; endTime?: string }) => {
  return request.get<EventTrend[]>('/analytics/error-trend', { params })
}
