import { Injectable } from '@nestjs/common'
import { AnalysisRepository } from '../repositories/analysis.repository'
import {
  AnalysisSummaryDto,
  AnalysisTrendDto,
  AnalysisFilterDto,
  AnalyticsOverviewDto,
  AnalyticsTrendDto,
  AnalyticsTopEventsDto,
} from '../dto/analysis.dto'

@Injectable()
export class AnalysisService {
  constructor(private readonly analysisRepository: AnalysisRepository) {}

  async getSummary(query: AnalysisSummaryDto) {
    return this.analysisRepository.getSummary(query)
  }

  async getTrend(query: AnalysisTrendDto) {
    return this.analysisRepository.getTrend(query)
  }

  async getFiltered(query: AnalysisFilterDto) {
    return this.analysisRepository.getFiltered(query)
  }

  async getOverview(query: AnalyticsOverviewDto) {
    return this.analysisRepository.getOverview(query)
  }

  async getEventTrend(query: AnalyticsTrendDto) {
    return this.analysisRepository.getEventTrend(query)
  }

  async getTopEvents(query: AnalyticsTopEventsDto) {
    return this.analysisRepository.getTopEvents(query)
  }

  async getConversionRate(query: AnalyticsOverviewDto) {
    return this.analysisRepository.getConversionRate(query)
  }
}
