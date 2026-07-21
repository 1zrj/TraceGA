/// <reference types="jest" />

import 'reflect-metadata'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { TrackBatchDto } from '../dto/track-batch.dto'
import { TrackEventDto } from '../dto/track-event.dto'

describe('Track DTO validation', () => {
  const validEvent = {
    eventId: 'evt_001',
    eventType: 'custom',
    eventName: 'checkout_submit',
    appId: 'app_001',
    properties: { source: 'cart' },
    timestamp: 1784390000000,
  }

  it('accepts a valid event', async () => {
    const errors = await validate(plainToInstance(TrackEventDto, validEvent))
    expect(errors).toHaveLength(0)
  })

  it('rejects empty identifiers and non-snake-case event names', async () => {
    const dto = plainToInstance(TrackEventDto, {
      ...validEvent,
      appId: '',
      eventName: 'Checkout Submit',
    })
    const errors = await validate(dto)
    expect(errors.map(error => error.property)).toEqual(expect.arrayContaining(['appId', 'eventName']))
  })

  it('rejects an unsupported event type', async () => {
    const errors = await validate(plainToInstance(TrackEventDto, { ...validEvent, eventType: 'unknown' }))
    expect(errors.some(error => error.property === 'eventType')).toBe(true)
  })

  it('requires a batch to contain between one and twenty events', async () => {
    const emptyErrors = await validate(plainToInstance(TrackBatchDto, { events: [] }))
    const oversizedErrors = await validate(plainToInstance(TrackBatchDto, { events: Array.from({ length: 21 }, () => validEvent) }))

    expect(emptyErrors.some(error => error.property === 'events')).toBe(true)
    expect(oversizedErrors.some(error => error.property === 'events')).toBe(true)
  })
})
