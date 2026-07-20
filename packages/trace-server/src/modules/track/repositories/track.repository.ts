import { Injectable } from '@nestjs/common';
import { Prisma } from '@/generated/prisma';
import { PrismaService } from '@/database/prisma.service';
import { TrackEvent } from '../entities/track.entity';

@Injectable()
export class TrackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insertEvent(event: TrackEvent, ip: string, userAgent: string): Promise<void> {
    await this.prisma.event_log.create({
      data: this.toEventLogCreateInput(event, ip, userAgent),
    });
  }

  async insertBatch(events: TrackEvent[], ip: string, userAgent: string): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await this.prisma.event_log.createMany({
      data: events.map(event => this.toEventLogCreateManyInput(event, ip, userAgent)),
    });
  }

  private toEventLogCreateInput(event: TrackEvent, ip: string, userAgent: string): Prisma.event_logCreateInput {
    return this.buildEventLogData(event, ip, userAgent);
  }

  private toEventLogCreateManyInput(event: TrackEvent, ip: string, userAgent: string): Prisma.event_logCreateManyInput {
    return this.buildEventLogData(event, ip, userAgent);
  }

  private buildEventLogData(event: TrackEvent, ip: string, userAgent: string) {
    return {
      project_id: event.appId,
      event_name: event.eventName,
      event_type: event.eventType,
      occurred_at: this.toOccurredAt(event.timestamp),
      uid: event.userId || null,
      session_id: event.sessionId || null,
      page_url: event.url || null,
      event_params: event.properties ?? Prisma.JsonNull,
      common_params: event.referrer ? { referrer: event.referrer } : Prisma.JsonNull,
      user_agent: userAgent || event.userAgent || null,
      ip: ip || null,
    };
  }

  private toOccurredAt(timestamp?: number): Date {
    return timestamp ? new Date(timestamp) : new Date();
  }
}
