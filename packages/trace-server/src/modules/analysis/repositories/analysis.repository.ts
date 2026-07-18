import { Injectable } from '@nestjs/common'
import { Prisma } from '@generated/prisma'
import { PrismaService } from '../../../database/prisma.service'
import {
  AnalysisSummaryDto,
  AnalysisTrendDto,
  AnalysisFilterDto,
  AnalyticsOverviewDto,
  AnalyticsTrendDto,
  AnalyticsEventTypeTrendDto,
  AnalyticsTopEventsDto,
} from '../dto/analysis.dto'

@Injectable()
export class AnalysisRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(query: AnalysisSummaryDto) {
    const { appId, startTime, endTime } = query

    const where: Prisma.event_logWhereInput = this.buildEventLogWhere(appId, startTime, endTime)

    const [pvResult, uvSubquery, eventNames] = await this.prisma.$transaction([
      this.prisma.event_log.count({ where }),
      this.prisma.event_log.findMany({
        where,
        select: { uid: true },
        distinct: ['uid'],
      }),
      this.prisma.event_log.findMany({
        where,
        select: { event_name: true },
        distinct: ['event_name'],
      }),
    ])

    const uv = uvSubquery.length
    const eventCount = eventNames.length

    return {
      pv: pvResult,
      uv,
      eventCount,
    }
  }

  async getTrend(query: AnalysisTrendDto) {
    const { appId, eventType, startTime, endTime, interval = 'day' } = query

    const where = this.buildEventLogWhere(appId, startTime, endTime)

    if (eventType) {
      where.event_type = eventType
    }

    const logs = await this.prisma.event_log.findMany({
      where,
      select: {
        created_at: true,
        uid: true,
      },
    })

    // 统一日期格式
    const fmt = interval === 'hour' ? 'yyyy-MM-dd HH:00:00' : 'yyyy-MM-dd'
    const map = new Map<string, { pv: number; uv: Set<string> }>()

    for (const log of logs) {
      let key: string
      const d = new Date(log.created_at)
      if (interval === 'hour') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00:00`
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }

      if (!map.has(key)) {
        map.set(key, { pv: 0, uv: new Set() })
      }
      const entry = map.get(key)!
      entry.pv++
      entry.uv.add(log.uid)
    }

    return Array.from(map.entries())
      .map(([date, { pv, uv }]) => ({ time: date, pv, uv: uv.size }))
      .sort((a, b) => a.time.localeCompare(b.time))
  }

  async getFiltered(query: AnalysisFilterDto) {
    const { appId, eventTypes, startTime, endTime } = query

    const result = await this.prisma.$queryRaw`
      SELECT 
        event_name,
        event_type,
        COUNT(*) as count
      FROM event_log
      ${this.buildRawWhere(appId, startTime, endTime)}
      ${eventTypes && eventTypes.length > 0 ? `AND event_type IN (${eventTypes.map(() => '?').join(', ')})` : ''}
      GROUP BY event_name, event_type
      ORDER BY count DESC
      LIMIT 100
    `

    return result as Array<{ event_name: string; event_type: string; count: number }>
  }

  async getOverview(query: AnalyticsOverviewDto) {
    const where = this.buildEventLogWhere(query.appId, query.startTime, query.endTime)

    const [totalEvents, totalUsers] = await this.prisma.$transaction([
      this.prisma.event_log.count({ where }),
      this.prisma.event_log.findMany({
        where,
        select: { uid: true },
        distinct: ['uid'],
      }),
    ])

    return {
      totalEvents,
      totalUsers: totalUsers.length,
      avgSessionDuration: 0,
      conversionRate: totalEvents > 0 ? totalUsers.length / totalEvents : 0,
    }
  }

  async getEventTrend(query: AnalyticsTrendDto) {
    const { appId, startTime, endTime, interval = 'day' } = query
    const dateFormat = interval === 'hour' ? '%Y-%m-%d %H:00:00' : '%Y-%m-%d'

    const result = await this.prisma.$queryRaw`
      SELECT 
        DATE_FORMAT(created_at, ${dateFormat}) as time,
        COUNT(*) as count
      FROM event_log
      ${this.buildRawWhere(appId, startTime, endTime)}
      GROUP BY time
      ORDER BY time ASC
    `

    return result as Array<{ time: string; count: number }>
  }

  async getEventTypeTrend(query: AnalyticsEventTypeTrendDto) {
    const { appId, startTime, endTime, interval = 'day' } = query

    const where = this.buildEventLogWhere(appId, startTime, endTime)

    const logs = await this.prisma.event_log.findMany({
      where,
      select: { created_at: true, event_type: true },
    })

    // 在 JS 中按时间 + 事件类型分组聚合
    const map = new Map<string, Map<string, number>>()

    for (const log of logs) {
      const d = new Date(log.created_at!)
      const timeKey =
        interval === 'hour'
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00:00`
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const type = log.event_type ?? 'unknown'

      if (!map.has(timeKey)) map.set(timeKey, new Map())
      const typeMap = map.get(timeKey)!
      typeMap.set(type, (typeMap.get(type) ?? 0) + 1)
    }

    const result: Array<{ time: string; type: string; count: number }> = []
    for (const [time, typeMap] of map) {
      for (const [type, count] of typeMap) {
        result.push({ time, type, count })
      }
    }

    return result.sort(
      (a, b) => a.time.localeCompare(b.time) || a.type.localeCompare(b.type),
    )
  }

  async getTopEvents(query: AnalyticsTopEventsDto) {
    const { appId, startTime, endTime, limit = 10 } = query
    const where = this.buildEventLogWhere(appId, startTime, endTime)

    const totalEvents = await this.prisma.event_log.count({ where })

    const raw = await this.prisma.event_log.groupBy({
      by: ['event_name'],
      where,
      _count: { event_name: true },
      orderBy: { _count: { event_name: 'desc' } },
      take: limit,
    })

    return raw.map((item) => ({
      name: item.event_name,
      count: item._count.event_name,
      percentage: totalEvents > 0 ? Number((item._count.event_name / totalEvents * 100).toFixed(2)) : 0,
    }))
  }

  async getConversionRate(query: AnalyticsOverviewDto) {
    const where = this.buildEventLogWhere(query.appId, query.startTime, query.endTime)

    const [totalEvents, totalUsers] = await this.prisma.$transaction([
      this.prisma.event_log.count({ where }),
      this.prisma.event_log.findMany({
        where,
        select: { uid: true },
        distinct: ['uid'],
      }),
    ])

    return { rate: totalEvents > 0 ? Number((totalUsers.length / totalEvents * 100).toFixed(2)) : 0 }
  }

  private buildEventLogWhere(
    appId?: string,
    startTime?: string,
    endTime?: string,
  ): Prisma.event_logWhereInput {
    const where: Prisma.event_logWhereInput = {}

    if (appId) {
      where.project_id = appId
    }

    const dateFilter: Prisma.DateTimeFilter = {}
    if (startTime) {
      dateFilter.gte = new Date(startTime)
    }
    if (endTime) {
      dateFilter.lte = new Date(endTime)
    }
    if (Object.keys(dateFilter).length > 0) {
      where.created_at = dateFilter
    }

    return where
  }

  private buildRawWhere(
    appId?: string,
    startTime?: string,
    endTime?: string,
    eventType?: string,
  ) {
    const conditions: string[] = []

    if (appId) {
      conditions.push(`project_id = '${appId}'`)
    }

    if (startTime) {
      conditions.push(`created_at >= '${startTime}'`)
    }

    if (endTime) {
      conditions.push(`created_at <= '${endTime}'`)
    }

    if (eventType) {
      conditions.push(`event_type = '${eventType}'`)
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  }
}