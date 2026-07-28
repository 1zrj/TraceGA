import { Injectable } from '@nestjs/common'
import { AnalysisRepository } from '../repositories/analysis.repository'
import { AnalysisSummaryDto, AnalysisTrendDto, AnalysisFilterDto } from '../dto/analysis.dto'

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
}
