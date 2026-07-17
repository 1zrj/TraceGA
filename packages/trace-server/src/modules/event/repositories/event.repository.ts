import { Injectable } from '@nestjs/common'
import { Prisma } from '@generated/prisma'
import { PrismaService } from '../../../database/prisma.service'
import { Event } from '../entities/event.entity'
import { GetEventsDto } from '../dto/get-events.dto'
import { CreateEventDto } from '../dto/create-event.dto'
import { UpdateEventDto } from '../dto/update-event.dto'
import { paginate, buildPaginationResult } from '../../../common/utils'

@Injectable()
export class EventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetEventsDto) {
    const { page, pageSize, eventType, appId, keyword } = query
    const { skip, take } = paginate(page, pageSize)

    const where: Prisma.event_definitionWhereInput = {
      status: 1,
      ...(eventType && { event_type: eventType }),
      ...(appId && { project_id: appId }),
      ...(keyword && { event_name: { contains: keyword } }),
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.event_definition.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.event_definition.count({ where }),
    ])

    return buildPaginationResult(
      list.map((event) => this.toEvent(event)),
      total,
      page,
      pageSize,
    )
  }

  async findById(id: string): Promise<Event | null> {
    const event = await this.prisma.event_definition.findUnique({
      where: { id: BigInt(id) },
    })
    return event ? this.toEvent(event) : null
  }

  async create(data: CreateEventDto): Promise<Event> {
    const event = await this.prisma.event_definition.create({
      data: {
        event_name: data.eventName,
        event_type: data.eventType,
        event_desc: data.description,
        param_schema: data.propertySchema ?? Prisma.JsonNull,
        project_id: data.appId,
        status: 1,
      },
    })
    return this.toEvent(event)
  }

  async update(id: string, data: UpdateEventDto): Promise<Event | null> {
    const event = await this.prisma.event_definition.update({
      where: { id: BigInt(id) },
      data: {
        ...(data.eventName && { event_name: data.eventName }),
        ...(data.eventType && { event_type: data.eventType }),
        ...(data.description !== undefined && {
          event_desc: data.description,
        }),
        ...(data.propertySchema !== undefined && {
          param_schema: data.propertySchema,
        }),
        ...(data.appId && { project_id: data.appId }),
      },
    })
    return this.toEvent(event)
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.event_definition.update({
      where: { id: BigInt(id) },
      data: { status: 0 },
    })
  }

  private toEvent(event: Prisma.event_definitionGetPayload<{}>): Event {
    return {
      id: event.id.toString(),
      eventName: event.event_name,
      eventType: event.event_type ?? '',
      category: event.event_type ?? '',
      description: event.event_desc,
      propertySchema: event.param_schema as Record<string, any>,
      appId: event.project_id,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
      deletedAt: event.status === 0 ? event.updated_at : null,
    }
  }
}
