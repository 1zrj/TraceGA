/// <reference types="jest" />

import 'reflect-metadata'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { TrackService } from '../services/track.service'
import { TrackRepository } from '../repositories/track.repository'
import { EventProcessorFactory } from '../processors/event.processor'
import { TrackEventDto } from '../dto/track-event.dto'
import { JsonSchemaValidator } from '../validators/json-schema.validator'

jest.mock('@generated/prisma', () => ({ Prisma: { JsonNull: null } }), { virtual: true })
jest.mock('@/database/prisma.service', () => ({ PrismaService: class {} }), { virtual: true })

describe('TrackService', () => {
  const repository = {
    findExistingProjects: jest.fn(),
    findActiveEventDefinitions: jest.fn(),
    insertEvent: jest.fn(),
    insertBatch: jest.fn(),
  }
  const processorFactory = {
    getProcessor: jest.fn(),
  }
  const processor = {
    process: jest.fn(event => ({ ...event, processed: true })),
  }
  const jsonSchemaValidator = {
    validate: jest.fn(),
  }
  const service = new TrackService(
    repository as unknown as TrackRepository,
    processorFactory as unknown as EventProcessorFactory,
    jsonSchemaValidator as unknown as JsonSchemaValidator,
  )
  const event: TrackEventDto = {
    eventId: 'evt_001',
    eventType: 'custom',
    eventName: 'checkout_submit',
    appId: 'app_001',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    repository.findExistingProjects.mockResolvedValue(new Set(['app_001']))
    repository.findActiveEventDefinitions.mockResolvedValue([{ appId: 'app_001', eventName: 'checkout_submit', eventType: 'custom' }])
    processorFactory.getProcessor.mockReturnValue(processor)
  })

  it('validates, processes and inserts one event', async () => {
    await expect(service.trackEvent(event, '127.0.0.1', 'jest')).resolves.toEqual({
      eventId: 'evt_001',
      received: true,
    })
    expect(repository.insertEvent).toHaveBeenCalledWith(expect.objectContaining({ processed: true }), '127.0.0.1', 'jest')
    expect(jsonSchemaValidator.validate).toHaveBeenCalledWith({}, undefined)
  })

  it('rejects an unknown project before processing', async () => {
    repository.findExistingProjects.mockResolvedValue(new Set())
    await expect(service.trackEvent(event, '', '')).rejects.toBeInstanceOf(NotFoundException)
    expect(repository.insertEvent).not.toHaveBeenCalled()
  })

  it('rejects an event type that differs from its definition', async () => {
    repository.findActiveEventDefinitions.mockResolvedValue([{ appId: 'app_001', eventName: 'checkout_submit', eventType: 'click' }])
    await expect(service.trackEvent(event, '', '')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('returns partial success and inserts valid batch events once', async () => {
    const result = await service.trackBatch(
      {
        events: [event, { ...event }, { ...event, eventId: 'evt_002', eventName: 'missing_event' }],
      },
      '127.0.0.1',
      'jest',
    )

    expect(result).toEqual({
      successCount: 1,
      failedCount: 2,
      failures: [
        { index: 1, eventId: 'evt_001', reason: 'duplicated eventId in batch' },
        { index: 2, eventId: 'evt_002', reason: 'eventName does not exist or is disabled' },
      ],
    })
    expect(repository.insertBatch).toHaveBeenCalledTimes(1)
    expect(repository.insertBatch.mock.calls[0][0]).toHaveLength(1)
  })

  it('does not hide a database batch failure', async () => {
    repository.insertBatch.mockRejectedValueOnce(new Error('database unavailable'))
    await expect(service.trackBatch({ events: [event] }, '', '')).rejects.toThrow('database unavailable')
  })

  it('returns a schema validation failure as a failed batch item', async () => {
    repository.findActiveEventDefinitions.mockResolvedValue([
      {
        appId: 'app_001',
        eventName: 'checkout_submit',
        eventType: 'custom',
        propertySchema: { type: 'object' },
      },
    ])
    jsonSchemaValidator.validate.mockImplementationOnce(() => {
      throw new BadRequestException('properties do not match param_schema')
    })

    await expect(service.trackBatch({ events: [event] }, '', '')).resolves.toEqual({
      successCount: 0,
      failedCount: 1,
      failures: [{ index: 0, eventId: 'evt_001', reason: 'properties do not match param_schema' }],
    })
  })
})
