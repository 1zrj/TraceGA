import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from '../repositories/event.repository';
import { PrismaService } from '../../../database/prisma.service';
import { GetEventsDto } from '../dto/get-events.dto';
import { CreateEventDto } from '../dto/create-event.dto';
import { UpdateEventDto } from '../dto/update-event.dto';

@Injectable()
export class EventService {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly prisma: PrismaService,
  ) {}

  findAll(query: GetEventsDto) {
    return this.eventRepository.findAll(query);
  }

  async findById(id: string) {
    const event = await this.eventRepository.findById(id);
    if (!event) throw new NotFoundException('事件不存在');
    return event;
  }

  async create(data: CreateEventDto) {
    // 如果 project 不存在则自动创建
    const existing = await this.prisma.project.findUnique({
      where: { project_id: data.appId },
    });
    if (!existing) {
      await this.prisma.project.create({
        data: {
          project_id: data.appId,
          project_name: data.appId,
          owner: 'admin',
        },
      });
    }

    // 检查同项目下是否已存在同名事件
    const dup = await this.prisma.event_definition.findFirst({
      where: { project_id: data.appId, event_name: data.eventName },
    });
    if (dup) {
      throw new ConflictException('同一项目下已存在同名事件');
    }

    const event = await this.eventRepository.create(data);
    return { id: event.id.toString(), createdAt: event.createdAt };
  }

  async update(id: string, data: UpdateEventDto) {
    await this.findById(id);
    const event = await this.eventRepository.update(id, data);
    return { id: event.id.toString(), updatedAt: event.updatedAt };
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.eventRepository.softDelete(id);
  }
}
