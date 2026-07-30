import { eventHandlers } from './event'
import { analyticsHandlers } from './analytics'
import { authHandlers } from './auth'
import { alarmHandlers } from './alarm'

export const handlers = [...eventHandlers, ...analyticsHandlers, ...authHandlers, ...alarmHandlers]
