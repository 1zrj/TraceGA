import { http, HttpResponse } from 'msw'
import { mockTopEvents, mockEventTypeTrend } from '../data/mockData'

/** Dashboard 概览模拟数据 */
const mockAnalyticsOverview = {
  totalEvents: 12580,
  totalUsers: 3250,
  avgSessionDuration: 245,
  conversionRate: 4.5,
}

/** Dashboard 事件趋势模拟数据（time/count 格式） */
const mockEventTrendData = [
  { time: '01-09', count: 1200 },
  { time: '01-10', count: 1500 },
  { time: '01-11', count: 1300 },
  { time: '01-12', count: 1800 },
  { time: '01-13', count: 2100 },
  { time: '01-14', count: 1900 },
  { time: '01-15', count: 2200 },
]

export const analyticsHandlers = [
  http.get('/api/analysis/summary', () => {
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: {
        pv: 12580,
        uv: 3250,
        rate: '4.5',
        startTime: '2024-01-08T00:00:00.000Z',
        endTime: '2024-01-15T23:59:59.000Z',
        eventCount: 12580,
      },
    })
  }),
  http.get('/api/analysis/trend', () => {
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: [
        { time: '01-09', pv: 1200, uv: 320 },
        { time: '01-10', pv: 1500, uv: 380 },
        { time: '01-11', pv: 1300, uv: 350 },
        { time: '01-12', pv: 1800, uv: 420 },
        { time: '01-13', pv: 2100, uv: 480 },
        { time: '01-14', pv: 1900, uv: 450 },
        { time: '01-15', pv: 2200, uv: 510 },
      ],
    })
  }),
  http.get('/api/analytics/overview', () => {
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: mockAnalyticsOverview,
    })
  }),
  http.get('/api/analytics/event-trend', () => {
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: mockEventTrendData,
    })
  }),
  http.get('/api/analytics/top-events', () => {
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: mockTopEvents,
    })
  }),
  http.get('/api/analytics/conversion-rate', () => {
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: { rate: 4.5 },
    })
  }),
  http.get('/api/analytics/event-type-trend', () => {
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: mockEventTypeTrend,
    })
  }),
]
