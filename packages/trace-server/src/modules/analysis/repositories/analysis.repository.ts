import { Injectable } from '@nestjs/common'
import { ClickHouseService } from '@/database/clickhouse.service'
import { AnalysisSummaryDto, AnalysisTrendDto, AnalysisFilterDto } from '../dto/analysis.dto'

@Injectable()
export class AnalysisRepository {
  constructor(private readonly clickHouseService: ClickHouseService) {}

  async getSummary(query: AnalysisSummaryDto) {
    const { appId, startTime, endTime } = query

    let whereClause = '1=1'
    const params: Record<string, any> = {}

    if (appId) {
      whereClause += ' AND app_id = {appId:String}'
      params.appId = appId
    }

    if (startTime) {
      whereClause += ' AND timestamp >= {startTime:DateTime}'
      params.startTime = startTime
    }

    if (endTime) {
      whereClause += ' AND timestamp <= {endTime:DateTime}'
      params.endTime = endTime
    }

    const pvQuery = `
      SELECT count() as pv
      FROM events
      WHERE ${whereClause}
    `

    const uvQuery = `
      SELECT uniq(user_id) as uv
      FROM events
      WHERE ${whereClause}
    `

    const eventCountQuery = `
      SELECT count(DISTINCT event_name) as event_count
      FROM events
      WHERE ${whereClause}
    `

    const [pvResult, uvResult, eventCountResult] = await Promise.all([
      this.clickHouseService.query(pvQuery, params),
      this.clickHouseService.query(uvQuery, params),
      this.clickHouseService.query(eventCountQuery, params),
    ])

    return {
      pv: pvResult[0]?.pv || 0,
      uv: uvResult[0]?.uv || 0,
      eventCount: eventCountResult[0]?.event_count || 0,
    }
  }

  async getTrend(query: AnalysisTrendDto) {
    const { appId, eventType, startTime, endTime, interval = 'day' } = query

    let whereClause = '1=1'
    const params: Record<string, any> = {}

    if (appId) {
      whereClause += ' AND app_id = {appId:String}'
      params.appId = appId
    }

    if (eventType) {
      whereClause += ' AND event_type = {eventType:String}'
      params.eventType = eventType
    }

    if (startTime) {
      whereClause += ' AND timestamp >= {startTime:DateTime}'
      params.startTime = startTime
    }

    if (endTime) {
      whereClause += ' AND timestamp <= {endTime:DateTime}'
      params.endTime = endTime
    }

    let timeFormat = '%Y-%m-%d'
    if (interval === 'hour') {
      timeFormat = '%Y-%m-%d %H:00:00'
    } else if (interval === 'week') {
      timeFormat = '%Y-%m-%d'
    }

    const queryStr = `
      SELECT
        formatDateTime(timestamp, '${timeFormat}') as date,
        count() as pv,
        uniq(user_id) as uv
      FROM events
      WHERE ${whereClause}
      GROUP BY date
      ORDER BY date ASC
    `

    return this.clickHouseService.query(queryStr, params)
  }

  async getFiltered(query: AnalysisFilterDto) {
    const { appId, eventTypes, startTime, endTime } = query

    let whereClause = '1=1'
    const params: Record<string, any> = {}

    if (appId) {
      whereClause += ' AND app_id = {appId:String}'
      params.appId = appId
    }

    if (eventTypes && eventTypes.length > 0) {
      whereClause += ' AND event_type IN ({eventTypes:Array(String)})'
      params.eventTypes = eventTypes
    }

    if (startTime) {
      whereClause += ' AND timestamp >= {startTime:DateTime}'
      params.startTime = startTime
    }

    if (endTime) {
      whereClause += ' AND timestamp <= {endTime:DateTime}'
      params.endTime = endTime
    }

    const queryStr = `
      SELECT
        event_name,
        event_type,
        count() as count
      FROM events
      WHERE ${whereClause}
      GROUP BY event_name, event_type
      ORDER BY count DESC
      LIMIT 100
    `

    return this.clickHouseService.query(queryStr, params)
  }
}
