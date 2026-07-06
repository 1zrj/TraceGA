import { create } from 'zustand'
import type { Event } from '@/types'

interface EventState {
  events: Event[]
  selectedEvent: Event | null
  setEvents: (events: Event[]) => void
  addEvent: (event: Event) => void
  updateEvent: (id: string, updates: Partial<Event>) => void
  deleteEvent: (id: string) => void
  selectEvent: (event: Event | null) => void
}

export const useEventStore = create<EventState>((set) => ({
  events: [],
  selectedEvent: null,
  setEvents: (events) => set({ events }),
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  updateEvent: (id, updates) =>
    set((state) => ({
      events: state.events.map((event) =>
        event.id === id ? { ...event, ...updates } : event,
      ),
    })),
  deleteEvent: (id) =>
    set((state) => ({
      events: state.events.filter((event) => event.id !== id),
    })),
  selectEvent: (event) => set({ selectedEvent: event }),
}))