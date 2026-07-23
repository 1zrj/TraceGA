/// <reference types="jest" />

import 'reflect-metadata'
import { TrackController } from '../controllers/track.controller'
import { TrackService } from '../services/track.service'
import { TrackEventDto } from '../dto/track-event.dto'

jest.mock('@generated/prisma', () => ({ Prisma: { JsonNull: null } }), { virtual: true })
jest.mock('@/database/prisma.service', () => ({ PrismaService: class {} }), { virtual: true })

describe('TrackController', () => {
  const service = {
    trackEvent: jest.fn(),
    trackBatch: jest.fn(),
  }
  const controller = new TrackController(service as unknown as TrackService)
  const request = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest' },
  } as any
  const event: TrackEventDto = {
    eventType: 'custom',
    eventName: 'checkout_submit',
    appId: 'app_001',
  }

  beforeEach(() => jest.clearAllMocks())

  it('forwards a single event with request metadata', () => {
    controller.track(event, request)
    expect(service.trackEvent).toHaveBeenCalledWith(event, '127.0.0.1', 'jest')
  })

  it('forwards a wrapped batch with request metadata', () => {
    controller.trackBatch({ events: [event] }, request)
    expect(service.trackBatch).toHaveBeenCalledWith({ events: [event] }, '127.0.0.1', 'jest')
  })
})
