/// <reference types="jest" />

import 'reflect-metadata';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TrackController } from '../controllers/track.controller';
import { TrackService } from '../services/track.service';
import { TrackEventDto } from '../dto/track-event.dto';

jest.mock('@generated/prisma', () => ({ Prisma: { JsonNull: null } }), { virtual: true });
jest.mock('@/database/prisma.service', () => ({ PrismaService: class {} }), { virtual: true });

describe('TrackController', () => {
  const service = {
    trackEvent: jest.fn(),
    trackBatch: jest.fn(),
  };
  const controller = new TrackController(service as unknown as TrackService);
  const event: TrackEventDto = {
    eventType: 'custom',
    eventName: 'checkout_submit',
    appId: 'app_001',
  };

  beforeEach(() => jest.clearAllMocks());

  describe('track() - 单条上报', () => {
    it('forwards a single event with request metadata（ip + user-agent）', () => {
      const request = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      } as any;

      controller.track(event, request);

      expect(service.trackEvent).toHaveBeenCalledWith(event, '127.0.0.1', 'jest');
    });

    it('falls back to x-forwarded-for when req.ip is not available', () => {
      const request = {
        ip: undefined,
        headers: { 'x-forwarded-for': '192.168.1.1', 'user-agent': 'jest' },
      } as any;

      controller.track(event, request);

      expect(service.trackEvent).toHaveBeenCalledWith(event, '192.168.1.1', 'jest');
    });

    it('handles missing user-agent with empty string', () => {
      const request = {
        ip: '10.0.0.1',
        headers: {},
      } as any;

      controller.track(event, request);

      expect(service.trackEvent).toHaveBeenCalledWith(event, '10.0.0.1', '');
    });

    it('returns the service result directly（{ eventId, received: true }）', () => {
      service.trackEvent.mockReturnValue({ eventId: 'evt_001', received: true });
      const request = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      } as any;

      const result = controller.track(event, request);

      expect(result).toEqual({ eventId: 'evt_001', received: true });
    });

    it('propagates service exceptions（如 appId 不存在）', () => {
      service.trackEvent.mockRejectedValue(new NotFoundException('project not found'));
      const request = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      } as any;

      expect(controller.track(event, request)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('trackBatch() - 批量上报', () => {
    it('forwards a wrapped batch with request metadata', () => {
      const request = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      } as any;

      controller.trackBatch({ events: [event] }, request);

      expect(service.trackBatch).toHaveBeenCalledWith({ events: [event] }, '127.0.0.1', 'jest');
    });

    it('returns batch result（successCount / failedCount）', () => {
      service.trackBatch.mockReturnValue({ successCount: 1, failedCount: 0, failures: [] });
      const request = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      } as any;

      const result = controller.trackBatch({ events: [event] }, request);

      expect(result).toEqual({ successCount: 1, failedCount: 0, failures: [] });
    });

    it('propagates batch service exceptions', () => {
      service.trackBatch.mockRejectedValue(new BadRequestException('batch validation failed'));
      const request = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      } as any;

      expect(controller.trackBatch({ events: [event] }, request)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
