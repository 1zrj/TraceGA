import { Module } from '@nestjs/common'
import { AnalysisController } from './controllers/analysis.controller'
import { AnalysisService } from './services/analysis.service'
import { AnalysisRepository } from './repositories/analysis.repository'

@Module({
  controllers: [AnalysisController],
  providers: [AnalysisService, AnalysisRepository],
  exports: [AnalysisService],
})
export class AnalysisModule {}