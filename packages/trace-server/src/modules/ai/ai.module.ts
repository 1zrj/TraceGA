import { Module } from '@nestjs/common'
import { AiController } from './controllers/ai.controller'
import { AiAnalyzeService } from './services/ai-analyze.service'
import { DailyReportService } from './services/daily-report.service'
import { AnomalyExplainService } from './services/anomaly-explain.service'
import { NlQueryService } from './services/nl-query.service'
import { RecommendService } from './services/recommend.service'
import { GlmClientService } from './services/glm-client.service'
import { PromptService } from './services/prompt.service'
import { AnalysisModule } from '../analysis/analysis.module'

@Module({
  imports: [AnalysisModule],
  controllers: [AiController],
  providers: [
    AiAnalyzeService,
    DailyReportService,
    AnomalyExplainService,
    NlQueryService,
    RecommendService,
    GlmClientService,
    PromptService,
  ],
  exports: [
    AiAnalyzeService,
    DailyReportService,
    AnomalyExplainService,
    NlQueryService,
    RecommendService,
  ],
})
export class AiModule {}
