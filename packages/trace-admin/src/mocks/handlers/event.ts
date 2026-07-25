import { http, HttpResponse, type PathParams } from 'msw'
import { mockEvents } from '../data/mockData'

let nextId = 6

export const eventHandlers = [
  http.get('/api/events', ({ request }) => {
    const url = new URL(request.url)
    const keyword = url.searchParams.get('keyword')?.toLowerCase()
    const filtered = keyword
      ? mockEvents.filter(
          (e) =>
            e.eventName.toLowerCase().includes(keyword) ||
            e.eventType.toLowerCase().includes(keyword) ||
            e.category.toLowerCase().includes(keyword),
        )
      : mockEvents
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: {
        list: filtered,
        total: filtered.length,
      },
    })
  }),
  http.get('/api/events/:id', ({ params }: { params: PathParams }) => {
    const event = mockEvents.find((e) => e.id === params.id)
    if (event) {
      return HttpResponse.json({
        code: 200,
        message: 'success',
        data: event,
      })
    }
    return HttpResponse.json(
      {
        code: 404,
        message: 'Event not found',
        data: null,
      },
      { status: 404 },
    )
  }),
  http.post('/api/events', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const now = new Date().toISOString()
    const newEvent = {
      id: String(nextId++),
      eventName: body.eventName as string,
      eventType: body.eventType as string,
      category: body.category as string,
      description: (body.description as string) || '',
      propertySchema: body.propertySchema || {},
      appId: (body.appId as string) || 'app001',
      createdAt: now,
      updatedAt: now,
    }
    mockEvents.push(newEvent as (typeof mockEvents)[number])
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: { id: newEvent.id, createdAt: now },
    })
  }),
  http.put('/api/events/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const event = mockEvents.find((e) => e.id === params.id)
    if (event) {
      if (body.eventName) event.eventName = body.eventName as string
      if (body.eventType) event.eventType = body.eventType as string
      if (body.category) event.category = body.category as string
      if (body.description !== undefined) event.description = body.description as string
      if (body.propertySchema)
        event.propertySchema = body.propertySchema as (typeof mockEvents)[number]['propertySchema']
      event.updatedAt = new Date().toISOString()
      return HttpResponse.json({
        code: 200,
        message: 'success',
        data: { ...event },
      })
    }
    return HttpResponse.json(
      {
        code: 404,
        message: 'Event not found',
        data: null,
      },
      { status: 404 },
    )
  }),
  http.delete('/api/events/:id', ({ params }: { params: PathParams }) => {
    const index = mockEvents.findIndex((e) => e.id === params.id)
    if (index !== -1) {
      mockEvents.splice(index, 1)
      return HttpResponse.json({
        code: 200,
        message: 'success',
        data: null,
      })
    }
    return HttpResponse.json(
      {
        code: 404,
        message: 'Event not found',
        data: null,
      },
      { status: 404 },
    )
  }),
]
