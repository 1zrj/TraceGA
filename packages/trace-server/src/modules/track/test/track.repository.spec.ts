/// <reference types="jest" />

import 'reflect-metadata'
import { TrackRepository } from '../repositories/track.repository'
import { PrismaService } from '@/database/prisma.service'

jest.mock('@generated/prisma', () => ({ Prisma: { JsonNull: null } }), { virtual: true })
jest.mock('@/database/prisma.service', () => ({ PrismaService: class {} }), { virtual: true })

describe('TrackRepository', () => {
  const prisma = {
    project: { findMany: jest.fn() },
    event_definition: { findMany: jest.fn() },
    event_log: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
  }
  const repository = new TrackRepository(prisma as unknown as PrismaService)

  beforeEach(() => jest.clearAllMocks())

  it('loads projects and active event definitions in bulk', async () => {
    prisma.project.findMany.mockResolvedValue([{ project_id: 'app_001' }])
    prisma.event_definition.findMany.mockResolvedValue([
      {
        project_id: 'app_001',
        event_name: 'page_view',
        event_type: 'page_view',
      },
    ])

    await expect(repository.findExistingProjects(['app_001', 'app_001'])).resolves.toEqual(new Set(['app_001']))
    await expect(repository.findActiveEventDefinitions(['app_001'], ['page_view'])).resolves.toEqual([{ appId: 'app_001', eventName: 'page_view', eventType: 'page_view' }])
  })

  it('maps one event to event_log fields', async () => {
    await repository.insertEvent(
      {
        eventType: 'page_view',
        eventName: 'page_view',
        appId: 'app_001',
        userId: 'user_001',
        sessionId: 'session_001',
        properties: { title: 'Home' },
        timestamp: 1784390000000,
        url: 'https://example.com',
        referrer: 'https://search.example.com',
      },
      '127.0.0.1',
      'jest',
    )

    expect(prisma.event_log.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        project_id: 'app_001',
        event_name: 'page_view',
        event_type: 'page_view',
        uid: 'user_001',
        session_id: 'session_001',
        page_url: 'https://example.com',
        event_params: { title: 'Home' },
        common_params: { referrer: 'https://search.example.com' },
        ip: '127.0.0.1',
        user_agent: 'jest',
      }),
    })
  })

  it('uses one createMany call for a batch and skips an empty batch', async () => {
    const events = [
      { eventType: 'custom', eventName: 'event_one', appId: 'app_001' },
      { eventType: 'custom', eventName: 'event_two', appId: 'app_001' },
    ]
    await repository.insertBatch(events, '', '')
    await repository.insertBatch([], '', '')

    expect(prisma.event_log.createMany).toHaveBeenCalledTimes(1)
    expect(prisma.event_log.createMany.mock.calls[0][0].data).toHaveLength(2)
  })
})
