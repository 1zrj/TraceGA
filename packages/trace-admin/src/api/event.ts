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
  return request.get<GetEventsResponse>('/events', { params })
}

export const getEventById = (id: string) => {
  return request.get<Event>(`/events/${id}`)
}

export const createEvent = (data: Record<string, unknown>) => {
  return request.post<Event>('/events', data)
}

export const updateEvent = (id: string, data: Record<string, unknown>) => {
  return request.put<Event>(`/events/${id}`, data)
}

export const deleteEvent = (id: string) => {
  return request.delete<void>(`/events/${id}`)
}