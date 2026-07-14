import { Injectable } from '@nestjs/common'
import { Repository } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { TrackEntity } from '../../track/entities/track.entity'
import { AnalysisSummaryDto, AnalysisTrendDto, AnalysisFilterDto } from '../dto/analysis.dto'

@Injectable()
export class AnalysisRepository {
  constructor(
    @InjectRepository(TrackEntity)
    private readonly trackRepository: Repository<TrackEntity>,
  ) {}

  async getSummary(query: AnalysisSummaryDto) {
    const { appId, startTime, endTime } = query

    const queryBuilder = this.trackRepository
      .createQueryBuilder('t')
      .select('COUNT(*)', 'pv')
      .addSelect('COUNT(DISTINCT t.userId)', 'uv')
      .addSelect('COUNT(DISTINCT t.eventName)', 'eventCount')

    this.applyFilters(queryBuilder, appId, startTime, endTime)

    const result = await queryBuilder.getRawOne()

    return {
      pv: Number(result?.pv) || 0,
      uv: Number(result?.uv) || 0,
      eventCount: Number(result?.eventCount) || 0,
    }
  }

  async getTrend(query: AnalysisTrendDto) {
    const { appId, eventType, startTime, endTime, interval = 'day' } = query

    let dateFormat = '%Y-%m-%d'
    if (interval === 'hour') {
      dateFormat = '%Y-%m-%d %H:00:00'
    }

    const queryBuilder = this.trackRepository
      .createQueryBuilder('t')
      .select(`DATE_FORMAT(t.timestamp, '${dateFormat}')`, 'date')
      .addSelect('COUNT(*)', 'pv')
      .addSelect('COUNT(DISTINCT t.userId)', 'uv')

    this.applyFilters(queryBuilder, appId, startTime, endTime)

    if (eventType) {
      queryBuilder.andWhere('t.eventType = :eventType', { eventType })
    }

    queryBuilder.groupBy('date').orderBy('date', 'ASC')

    return queryBuilder.getRawMany()
  }

  async getFiltered(query: AnalysisFilterDto) {
    const { appId, eventTypes, startTime, endTime } = query

    const queryBuilder = this.trackRepository
      .createQueryBuilder('t')
      .select('t.eventName', 'event_name')
      .addSelect('t.eventType', 'event_type')
      .addSelect('COUNT(*)', 'count')

    this.applyFilters(queryBuilder, appId, startTime, endTime)

    if (eventTypes && eventTypes.length > 0) {
      queryBuilder.andWhere('t.eventType IN (:...eventTypes)', { eventTypes })
    }

    queryBuilder.groupBy('t.eventName, t.eventType').orderBy('count', 'DESC').limit(100)

    return queryBuilder.getRawMany()
  }

  private applyFilters(
    queryBuilder: ReturnType<typeof this.trackRepository.createQueryBuilder>,
    appId?: string,
    startTime?: string,
    endTime?: string,
  ) {
    if (appId) {
      queryBuilder.where('t.appId = :appId', { appId })
    }

    if (startTime) {
      queryBuilder.andWhere('t.timestamp >= :startTime', { startTime })
    }

    if (endTime) {
      queryBuilder.andWhere('t.timestamp <= :endTime', { endTime })
    }
  }
}