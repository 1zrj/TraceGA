import { Injectable } from '@nestjs/common'
import { Prisma } from '@generated/prisma'
import { PrismaService } from '@/database/prisma.service'
import { TrackEvent, TrackEventDefinition } from '../entities/track.entity'

@Injectable()
export class TrackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findExistingProjects(appIds: string[]): Promise<Set<string>> {
    if (appIds.length === 0) {
      return new Set()
    }

    const projects = await this.prisma.project.findMany({
      where: { project_id: { in: [...new Set(appIds)] } },
      select: { project_id: true },
    })
    return new Set(projects.map(project => project.project_id))
  }

  async findActiveEventDefinitions(appIds: string[], eventNames: string[]): Promise<TrackEventDefinition[]> {
    if (appIds.length === 0 || eventNames.length === 0) {
      return []
    }

    const definitions = await this.prisma.event_definition.findMany({
      where: {
        project_id: { in: [...new Set(appIds)] },
        event_name: { in: [...new Set(eventNames)] },
        status: 1,
      },
      select: {
        project_id: true,
        event_name: true,
        event_type: true,
      },
    })

    return definitions.map(definition => ({
      appId: definition.project_id,
      eventName: definition.event_name,
      eventType: definition.event_type ?? '',
    }))
  }

  async insertEvent(event: TrackEvent, ip: string, userAgent: string): Promise<void> {
    await this.prisma.event_log.create({
      data: this.toEventLogCreateInput(event, ip, userAgent),
    })
  }

  async insertBatch(events: TrackEvent[], ip: string, userAgent: string): Promise<void> {
    if (events.length === 0) {
      return
    }

    await this.prisma.event_log.createMany({
      data: events.map(event => this.toEventLogCreateManyInput(event, ip, userAgent)),
    })
  }

  private toEventLogCreateInput(event: TrackEvent, ip: string, userAgent: string): Prisma.event_logCreateInput {
    return this.buildEventLogData(event, ip, userAgent)
  }

  private toEventLogCreateManyInput(event: TrackEvent, ip: string, userAgent: string): Prisma.event_logCreateManyInput {
    return this.buildEventLogData(event, ip, userAgent)
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
    }
  }

  private toOccurredAt(timestamp?: number): Date {
    return timestamp !== undefined ? new Date(timestamp) : new Date()
  }
}
