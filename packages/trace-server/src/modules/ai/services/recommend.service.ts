import { Injectable, Logger } from '@nestjs/common'
import { RecommendDto } from '../dto/recommend.dto'
import { GlmClientService } from './glm-client.service'
import { PromptService } from './prompt.service'
import { parseAIJson, withGlmFallback } from './ai.utils'

const MAX_TOKENS = 1024

@Injectable()
export class RecommendService {
  private readonly logger = new Logger(RecommendService.name)

  constructor(
    private readonly glmClient: GlmClientService,
    private readonly promptService: PromptService,
  ) {}

  async recommend(dto: RecommendDto) {
    const systemPrompt = this.promptService.system('recommend')
    const userPrompt = this.promptService.user('recommend', {
      description: dto.description,
    })

    const result = await withGlmFallback(
      this.glmClient,
      systemPrompt,
      userPrompt,
      { temperature: 0.5, maxTokens: MAX_TOKENS },
      content => {
        const parsed = parseAIJson<{
          recommendations?: Array<{
            eventName: string
            eventType: string
            trigger: string
            params: string
          }>
        }>(content, {})
        return {
          appId: dto.appId,
          description: dto.description,
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          generatedAt: new Date().toISOString(),
        }
      },
      {
        appId: dto.appId,
        description: dto.description,
        recommendations: [],
        error: 'AI 推荐生成失败，请稍后重试',
        generatedAt: new Date().toISOString(),
      },
      this.logger,
      '埋点推荐生成',
    )

    return result
  }
}
