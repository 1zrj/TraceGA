import { Module } from '@nestjs/common'
import { AnalysisController } from './controllers/analysis.controller'
import { AnalysisService } from './services/analysis.service'
import { AnalysisRepository } from './repositories/analysis.repository'
import { ClickHouseService } from '@/database/clickhouse.service'

@Module({
  controllers: [AnalysisController],
  providers: [AnalysisService, AnalysisRepository, ClickHouseService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
