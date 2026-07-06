import { http, HttpResponse } from 'msw'
import { mockOverview, mockEventTrend, mockTopEvents } from '../data/mockData'

export const analyticsHandlers = [
  http.get('/api/analytics/overview', () => {
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: mockOverview,
    })
  }),
  http.get('/api/analytics/event-trend', () => {
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: mockEventTrend,
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
]