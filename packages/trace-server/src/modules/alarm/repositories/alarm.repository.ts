import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma';
import { PrismaService } from '../../../database/prisma.service';
import { Alarm } from '../entities/alarm.entity';
import { GetAlarmListDto } from '../dto/get-alarm-list.dto';
import { paginate, buildPaginationResult } from '../../../common/utils';

@Injectable()
export class AlarmRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetAlarmListDto) {
    const { page = 1, pageSize = 20, appId, keyword } = query;
    const { skip, take } = paginate(page, pageSize);

    const where: Prisma.alarmWhereInput = {
      status: 1,
      ...(appId && { project_id: appId }),
      ...(keyword && { event_name: { contains: keyword } }),
    };

    const [list, total] = await this.prisma.$transaction([
      this.prisma.alarm.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.alarm.count({ where }),
    ]);

    return buildPaginationResult(
      list.map(alarm => this.toAlarm(alarm)),
      total,
      page,
      pageSize,
    );
  }

  async findById(id: string): Promise<Alarm | null> {
    const alarm = await this.prisma.alarm.findUnique({
      where: { id: BigInt(id) },
    });
    return alarm ? this.toAlarm(alarm) : null;
  }

  private toAlarm(alarm: Prisma.alarmGetPayload<Record<string, never>>): Alarm {
    return {
      id: alarm.id.toString(),
      appId: alarm.project_id,
      eventName: alarm.event_name,
      threshold: alarm.threshold?.toNumber() ?? 0,
      operator: alarm.operator ?? '',
      notifyType: alarm.notify_type ?? '',
      status: alarm.status ?? 1,
      createdAt: alarm.created_at,
      updatedAt: alarm.updated_at,
    };
  }
}
