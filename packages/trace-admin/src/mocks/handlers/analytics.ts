import { http, HttpResponse } from 'msw'
import { mockOverview, mockEventTrend, mockTopEvents } from '../data/mockData'

export const analyticsHandlers = [
  http.get('/api/analysis/summary', () => {
    return HttpResponse.json({
      code: 0,
      msg: 'success',
      data: mockOverview,
    })
  }),
  http.get('/api/analysis/trend', () => {
    return HttpResponse.json({
      code: 0,
      msg: 'success',
      data: mockEventTrend,
    })
  }),
  http.get('/api/analytics/top-events', () => {
    return HttpResponse.json({
      code: 0,
      msg: 'success',
      data: mockTopEvents,
    })
  }),
  http.get('/api/analytics/conversion-rate', () => {
    return HttpResponse.json({
      code: 0,
      msg: 'success',
      data: { rate: 4.5 },
    })
  }),
]