import { Module } from '@nestjs/common'
import { AnalysisController } from './controllers/analysis.controller'
import { AnalyticsController } from './controllers/analytics.controller'
import { AnalysisService } from './services/analysis.service'
import { AnalysisRepository } from './repositories/analysis.repository'

@Module({
  controllers: [AnalysisController, AnalyticsController],
  providers: [AnalysisService, AnalysisRepository],
  exports: [AnalysisService],
})
export class AnalysisModule {}