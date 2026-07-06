import request from '@/utils/request'
import type { Event } from '@/types'

interface GetEventsResponse {
  list: Event[]
  total: number
}

export const getEvents = (params: {
  page?: number
  pageSize?: number
  keyword?: string
  startTime?: string
  endTime?: string
}) => {
  return request.get<{ data: GetEventsResponse }>('/api/events', { params })
}

export const getEventById = (id: string) => {
  return request.get<{ data: Event }>(`/api/events/${id}`)
}

export const createEvent = (data: Record<string, unknown>) => {
  return request.post<{ data: Event }>('/api/events', data)
}

export const updateEvent = (id: string, data: Record<string, unknown>) => {
  return request.put<{ data: Event }>(`/api/events/${id}`, data)
}

export const deleteEvent = (id: string) => {
  return request.delete<{ data: void }>(`/api/events/${id}`)
}