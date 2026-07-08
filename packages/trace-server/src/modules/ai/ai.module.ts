import { Module } from '@nestjs/common'
import { AiController } from './controllers/ai.controller'
import { AiService } from './services/ai.service'
import { AnalysisModule } from '../analysis/analysis.module'

@Module({
  imports: [AnalysisModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
