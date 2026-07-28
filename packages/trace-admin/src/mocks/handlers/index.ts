import { eventHandlers } from './event'
import { analyticsHandlers } from './analytics'

export const handlers = [...eventHandlers, ...analyticsHandlers]