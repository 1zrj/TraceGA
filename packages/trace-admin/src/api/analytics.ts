import request from '@/utils/request'
import type { AnalyticsOverview, EventTrend, TopEvent } from '@/types'

export const getOverview = (params: {
  startTime?: string
  endTime?: string
}) => {
  return request.get<AnalyticsOverview>('/analytics/overview', { params })
}

export const getEventTrend = (params: {
  startTime?: string
  endTime?: string
  interval?: 'hour' | 'day' | 'week'
}) => {
  return request.get<EventTrend[]>('/analytics/event-trend', { params })
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