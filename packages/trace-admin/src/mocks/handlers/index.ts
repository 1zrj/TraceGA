import { eventHandlers } from './event'
import { analyticsHandlers } from './analytics'
import { aiHandlers } from './ai'

export const handlers = [...eventHandlers, ...analyticsHandlers, ...aiHandlers]