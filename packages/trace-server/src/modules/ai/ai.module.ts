import { Module } from '@nestjs/common'
import { AiController } from './controllers/ai.controller'
import { AiService } from './services/ai.service'
import { GlmClientService } from './services/glm-client.service'
import { PromptService } from './services/prompt.service'
import { AnalysisModule } from '../analysis/analysis.module'

@Module({
  imports: [AnalysisModule],
  controllers: [AiController],
  providers: [AiService, GlmClientService, PromptService],
  exports: [AiService],
})
export class AiModule {}
