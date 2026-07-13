import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/database/prisma.service'
import { Prisma } from '@/generated/prisma/client'
import { GetEventsDto } from '../dto/get-events.dto'
import { CreateEventDto } from '../dto/create-event.dto'
import { UpdateEventDto } from '../dto/update-event.dto'
import { paginate, buildPaginationResult } from '@/common/utils'

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
      list.map((event) => ({ ...event, id: event.id.toString() })),
      total,
      page,
      pageSize,
    )
  }

  async findById(id: string) {
    const event = await this.prisma.event_definition.findFirst({
      where: { id: BigInt(id), status: 1 },
    })
    return event ? { ...event, id: event.id.toString() } : null
  }

  create(data: CreateEventDto) {
    return this.prisma.event_definition.create({
      data: {
        project_id: data.appId,
        event_name: data.eventName,
        event_type: data.eventType,
        event_desc: data.description,
        param_schema: data.propertySchema as Prisma.InputJsonValue,
      },
    })
  }

  update(id: string, data: UpdateEventDto) {
    return this.prisma.event_definition.update({
      where: { id: BigInt(id) },
      data: {
        ...(data.appId !== undefined && { project_id: data.appId }),
        ...(data.eventName !== undefined && { event_name: data.eventName }),
        ...(data.eventType !== undefined && { event_type: data.eventType }),
        ...(data.description !== undefined && { event_desc: data.description }),
        ...(data.propertySchema !== undefined && {
          param_schema: data.propertySchema as Prisma.InputJsonValue,
        }),
        updated_at: new Date(),
      },
    })
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.event_definition.update({
      where: { id: BigInt(id) },
      data: { status: 0, updated_at: new Date() },
    })
  }
}
