/// <reference types="jest" />

import { BadRequestException } from '@nestjs/common'
import { ClickEventProcessor, ErrorEventProcessor, PageViewProcessor, PerformanceEventProcessor, WhiteScreenProcessor } from '../processors/event.processor'
import { TrackEvent } from '../entities/track.entity'

describe('Track event processors', () => {
  const event: TrackEvent = {
    eventType: 'custom',
    eventName: 'checkout_submit',
    appId: 'app_001',
  }

  it('trims fields and masks sensitive properties', () => {
    const result = new PageViewProcessor().process({
      ...event,
      eventType: 'page_view',
      eventName: ' page_view ',
      appId: ' app_001 ',
      url: ' https://example.com/page ',
      properties: {
        title: ' Home ',
        password: 'plain-text',
        nested: { token: 'secret' },
      },
    })

    expect(result.eventName).toBe('page_view')
    expect(result.appId).toBe('app_001')
    expect(result.url).toBe('https://example.com/page')
    expect(result.properties).toEqual({
      title: 'Home',
      password: '[REDACTED]',
      nested: { token: '[REDACTED]' },
    })
  })

  it('requires a url for page views', () => {
    expect(() => new PageViewProcessor().process({ ...event, eventType: 'page_view' })).toThrow(BadRequestException)
  })

  it('requires an element identifier for clicks', () => {
    const processor = new ClickEventProcessor()
    expect(() => processor.process({ ...event, eventType: 'click', properties: {} })).toThrow(BadRequestException)
    expect(
      processor.process({
        ...event,
        eventType: 'click',
        properties: { buttonName: 'Submit' },
      }).properties,
    ).toEqual({ buttonName: 'Submit' })
  })

  it('validates error, performance and white-screen properties', () => {
    expect(() => new ErrorEventProcessor().process({ ...event, eventType: 'error' })).toThrow(BadRequestException)
    expect(() =>
      new PerformanceEventProcessor().process({
        ...event,
        eventType: 'performance',
        properties: { loadTime: -1 },
      }),
    ).toThrow(BadRequestException)
    expect(() =>
      new WhiteScreenProcessor().process({
        ...event,
        eventType: 'white_screen',
        properties: { blankDuration: 1000 },
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects deeply nested property objects and oversized payloads', () => {
    const processor = new PageViewProcessor()
    const nested = { a: { b: { c: { d: { e: { f: 'too deep' } } } } } }

    expect(() =>
      processor.process({
        ...event,
        eventType: 'page_view',
        url: 'https://example.com',
        properties: nested,
      }),
    ).toThrow(BadRequestException)
    expect(() =>
      processor.process({
        ...event,
        eventType: 'page_view',
        url: 'https://example.com',
        properties: Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`key_${index}`, 'x'.repeat(512)])),
      }),
    ).toThrow('properties must not exceed 10 KB')
  })
})
