import { eventHandlers } from './event'
import { analyticsHandlers } from './analytics'
import { aiHandlers } from './ai'
import { authHandlers } from './auth'

export const handlers = [...eventHandlers, ...analyticsHandlers, ...aiHandlers, ...authHandlers]
