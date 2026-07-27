import { eventHandlers } from './event'
import { analyticsHandlers } from './analytics'
import { authHandlers } from './auth'

export const handlers = [...eventHandlers, ...analyticsHandlers, ...authHandlers]
