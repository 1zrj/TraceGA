import request from '@/utils/request'
import type { Event, PagedResponse, EventQueryDto } from '@/types'

export const getEvents = (params: EventQueryDto) => {
  return request.get<PagedResponse<Event>>('/events', { params })
}

export const getEventById = (id: string) => {
  return request.get<Event>(`/events/${id}`)
}

export const createEvent = (data: {
  eventName: string
  eventType: string
  category: string
  description?: string
  propertySchema?: Record<string, unknown>
  appId: string
}) => {
  return request.post<{ id: string; createdAt: string }>('/events', data)
}

export const updateEvent = (id: string, data: {
  eventName?: string
  description?: string
  propertySchema?: Record<string, unknown>
}) => {
  return request.put<{ id: string; updatedAt: string }>(`/events/${id}`, data)
}

export const deleteEvent = (id: string) => {
  return request.delete<null>(`/events/${id}`)
}