import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma';
import { PrismaService } from '../../../database/prisma.service';
import { Alarm } from '../entities/alarm.entity';
import { AlarmRecord } from '../entities/alarm-record.entity';
import { GetAlarmListDto } from '../dto/get-alarm-list.dto';
import { paginate, buildPaginationResult } from '../../../common/utils';

const TREND_CONFIG: Record<string, { minutes: number; label: string }> = {
  '15m': { minutes: 15, label: '15分钟' },
  '1h': { minutes: 60, label: '1小时' },
  '4h': { minutes: 240, label: '4小时' },
  '1d': { minutes: 1440, label: '1天' },
  '7d': { minutes: 10080, label: '7天' },
};

@Injectable()
export class AlarmRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 告警规则列表（原有实现保留，供规则管理使用） */
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

  /** 告警记录列表（页面实际使用） */
  async findRecords(query: GetAlarmListDto) {
    const { page = 1, pageSize = 20, appId, keyword, level, status, startTime, endTime } = query;
    const { skip, take } = paginate(page, pageSize);

    const where: Prisma.alarm_recordWhereInput = {
      ...(appId && { project_id: appId }),
      ...(level && { level }),
      ...(status && { status }),
      ...(startTime && { created_at: { gte: new Date(startTime) } }),
      ...(endTime && { created_at: { lte: new Date(endTime) } }),
      ...(keyword && {
        OR: [{ name: { contains: keyword } }, { alarm_type: { contains: keyword } }, { rule: { contains: keyword } }],
      }),
    };

    const [list, total] = await this.prisma.$transaction([
      this.prisma.alarm_record.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.alarm_record.count({ where }),
    ]);

    return buildPaginationResult(
      list.map(record => this.toAlarmRecord(record)),
      total,
      page,
      pageSize,
    );
  }

  /** 告警记录详情 */
  async findRecordById(id: string): Promise<AlarmRecord | null> {
    const record = await this.prisma.alarm_record.findUnique({
      where: { id: BigInt(id) },
    });
    return record ? this.toAlarmRecord(record) : null;
  }

  /** 告警记录趋势：按 timeRange 聚合出 [time, count] 序列 */
  async findTrend(timeRange: string): Promise<Array<{ time: string; count: number }>> {
    const cfg = TREND_CONFIG[timeRange] ?? TREND_CONFIG['1d'];
    const since = new Date(Date.now() - cfg.minutes * 60 * 1000);

    const rows = await this.prisma.alarm_record.findMany({
      where: { created_at: { gte: since } },
      select: { created_at: true },
    });

    // 按小时/天分桶聚合
    const bucketMs = cfg.minutes <= 240 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const buckets = new Map<string, number>();

    for (const row of rows) {
      if (!row.created_at) continue;
      const t = row.created_at.getTime();
      const key = Math.floor(t / bucketMs) * bucketMs;
      const label = this.formatBucketTime(new Date(key));
      buckets.set(label, (buckets.get(label) ?? 0) + 1);
    }

    // 补全时间段内每个桶（含 0 值），保证趋势连续
    const result: Array<{ time: string; count: number }> = [];
    const now = Date.now();
    const start = Math.floor(since.getTime() / bucketMs) * bucketMs;
    for (let ts = start; ts <= now; ts += bucketMs) {
      const label = this.formatBucketTime(new Date(ts));
      result.push({ time: label, count: buckets.get(label) ?? 0 });
    }
    return result;
  }

  /** 更新告警记录状态 */
  async updateRecordStatus(id: string, status: string, remark?: string): Promise<AlarmRecord | null> {
    const existing = await this.prisma.alarm_record.findUnique({
      where: { id: BigInt(id) },
    });
    if (!existing) {
      return null;
    }

    const updated = await this.prisma.alarm_record.update({
      where: { id: BigInt(id) },
      data: {
        status,
        ...(remark !== undefined && { remark }),
        updated_at: new Date(),
      },
    });
    return this.toAlarmRecord(updated);
  }

  async findById(id: string): Promise<Alarm | null> {
    const alarm = await this.prisma.alarm.findUnique({
      where: { id: BigInt(id) },
    });
    return alarm ? this.toAlarm(alarm) : null;
  }

  /** 创建告警规则 */
  async createRule(data: { projectId: string; eventName: string; threshold: number; operator: string; notifyType?: string; webhookUrl?: string; status?: number }): Promise<Alarm> {
    const created = await this.prisma.alarm.create({
      data: {
        project_id: data.projectId,
        event_name: data.eventName,
        threshold: data.threshold,
        operator: data.operator,
        notify_type: data.notifyType ?? '',
        webhook_url: data.webhookUrl ?? null,
        status: data.status ?? 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return this.toAlarm(created);
  }

  /** 更新告警规则 */
  async updateRule(
    id: string,
    data: {
      projectId?: string;
      eventName?: string;
      threshold?: number;
      operator?: string;
      notifyType?: string;
      webhookUrl?: string;
      status?: number;
    },
  ): Promise<Alarm | null> {
    const existing = await this.prisma.alarm.findUnique({
      where: { id: BigInt(id) },
    });
    if (!existing) {
      return null;
    }

    const updated = await this.prisma.alarm.update({
      where: { id: BigInt(id) },
      data: {
        ...(data.projectId !== undefined && { project_id: data.projectId }),
        ...(data.eventName !== undefined && { event_name: data.eventName }),
        ...(data.threshold !== undefined && { threshold: data.threshold }),
        ...(data.operator !== undefined && { operator: data.operator }),
        ...(data.notifyType !== undefined && { notify_type: data.notifyType }),
        ...(data.webhookUrl !== undefined && { webhook_url: data.webhookUrl }),
        ...(data.status !== undefined && { status: data.status }),
        updated_at: new Date(),
      },
    });
    return this.toAlarm(updated);
  }

  /** 删除告警规则（软删除：status=0，不再参与定时任务扫描） */
  async removeRule(id: string): Promise<boolean> {
    const existing = await this.prisma.alarm.findUnique({
      where: { id: BigInt(id) },
    });
    if (!existing) {
      return false;
    }

    await this.prisma.alarm.update({
      where: { id: BigInt(id) },
      data: { status: 0, updated_at: new Date() },
    });
    return true;
  }

  /** 查询所有启用中的告警规则（status=1），供定时任务扫描 */
  async findActiveRules(): Promise<Array<{ id: string; projectId: string; eventName: string; threshold: number; operator: string; notifyType: string; webhookUrl: string }>> {
    const rules = await this.prisma.alarm.findMany({
      where: { status: 1 },
    });
    return rules.map(rule => ({
      id: rule.id.toString(),
      projectId: rule.project_id,
      eventName: rule.event_name,
      threshold: rule.threshold?.toNumber() ?? 0,
      operator: rule.operator ?? 'gt',
      notifyType: rule.notify_type ?? '',
      webhookUrl: rule.webhook_url ?? '',
    }));
  }

  /** 统计窗口期内某项目某事件的发生次数 */
  async countEvents(projectId: string, eventName: string, since: Date): Promise<number> {
    return this.prisma.event_log.count({
      where: {
        project_id: projectId,
        event_name: eventName,
        created_at: { gte: since },
      },
    });
  }

  /** 查询是否存在仍未解决的告警记录（pending/processing），用于防重复触发 */
  async findOpenRecord(projectId: string, eventName: string): Promise<AlarmRecord | null> {
    const record = await this.prisma.alarm_record.findFirst({
      where: {
        project_id: projectId,
        event_name: eventName,
        status: { in: ['pending', 'processing'] },
      },
      orderBy: { created_at: 'desc' },
    });
    return record ? this.toAlarmRecord(record) : null;
  }

  /** 创建告警记录（定时任务触发后写入） */
  async createRecord(data: {
    projectId: string;
    eventName: string;
    name: string;
    type: string;
    level: string;
    rule: string;
    message: string;
    recordData: Prisma.InputJsonValue;
  }): Promise<AlarmRecord> {
    const created = await this.prisma.alarm_record.create({
      data: {
        project_id: data.projectId,
        event_name: data.eventName,
        name: data.name,
        alarm_type: data.type,
        level: data.level,
        status: 'pending',
        rule: data.rule,
        message: data.message,
        data: data.recordData,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return this.toAlarmRecord(created);
  }

  private toAlarm(alarm: Prisma.alarmGetPayload<Record<string, never>>): Alarm {
    return {
      id: alarm.id.toString(),
      appId: alarm.project_id,
      eventName: alarm.event_name,
      threshold: alarm.threshold?.toNumber() ?? 0,
      operator: alarm.operator ?? '',
      notifyType: alarm.notify_type ?? '',
      webhookUrl: alarm.webhook_url ?? '',
      status: alarm.status ?? 1,
      createdAt: alarm.created_at,
      updatedAt: alarm.updated_at,
    };
  }

  private toAlarmRecord(record: Prisma.alarm_recordGetPayload<Record<string, never>>): AlarmRecord {
    return {
      id: record.id.toString(),
      appId: record.project_id,
      eventName: record.event_name,
      name: record.name,
      type: record.alarm_type ?? '',
      level: record.level,
      status: record.status,
      rule: record.rule ?? '',
      message: record.message ?? '',
      data: (record.data as Record<string, unknown> | null) ?? null,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private formatBucketTime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:00`;
  }
}
