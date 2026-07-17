import { http, HttpResponse, type PathParams } from 'msw'
import { mockEvents } from '../data/mockData'

export const eventHandlers = [
  http.get('/api/events', () => {
    return HttpResponse.json({
      code: 0,
      msg: 'success',
      data: {
        list: mockEvents,
        total: mockEvents.length,
      },
    })
  }),
  http.get('/api/events/:id', ({ params }: { params: PathParams }) => {
    const event = mockEvents.find((e) => e.id === params.id)
    if (event) {
      return HttpResponse.json({
        code: 0,
        msg: 'success',
        data: event,
      })
    }
    return HttpResponse.json(
      {
        code: 404,
        msg: 'Event not found',
        data: null,
      },
      { status: 404 },
    )
  }),
  http.post('/api/events', () => {
    return HttpResponse.json({
      code: 0,
      msg: 'success',
      data: {
        id: 'new-event-id',
      },
    })
  }),
  http.put('/api/events/:id', ({ params }: { params: PathParams }) => {
    const event = mockEvents.find((e) => e.id === params.id)
    if (event) {
      return HttpResponse.json({
        code: 0,
        msg: 'success',
        data: { ...event },
      })
    }
    return HttpResponse.json(
      {
        code: 404,
        msg: 'Event not found',
        data: null,
      },
      { status: 404 },
    )
  }),
  http.delete('/api/events/:id', ({ params }: { params: PathParams }) => {
    const event = mockEvents.find((e) => e.id === params.id)
    if (event) {
      return HttpResponse.json({
        code: 0,
        msg: 'success',
        data: null,
      })
    }
    return HttpResponse.json(
      {
        code: 404,
        msg: 'Event not found',
        data: null,
      },
      { status: 404 },
    )
  }),
]