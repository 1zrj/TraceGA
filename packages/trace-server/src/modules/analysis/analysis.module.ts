import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AnalysisController } from './controllers/analysis.controller'
import { AnalysisService } from './services/analysis.service'
import { AnalysisRepository } from './repositories/analysis.repository'
import { TrackEntity } from '../track/entities/track.entity'

@Module({
  imports: [TypeOrmModule.forFeature([TrackEntity])],
  controllers: [AnalysisController],
  providers: [AnalysisService, AnalysisRepository],
  exports: [AnalysisService],
})
export class AnalysisModule {}