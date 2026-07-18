import { Injectable, Logger } from '@nestjs/common'
import { RecommendDto } from '../dto/recommend.dto'
import { GlmClientService } from './glm-client.service'
import { PromptService } from './prompt.service'

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

    try {
      const result = await this.glmClient.chat(systemPrompt, userPrompt, {
        temperature: 0.5,
        maxTokens: MAX_TOKENS,
      })

      const parsed = this.parseRecommendJSON(result.content)

      return {
        appId: dto.appId,
        description: dto.description,
        recommendations: parsed.recommendations,
        generatedAt: new Date().toISOString(),
      }
    } catch (err) {
      this.logger.error('埋点推荐生成失败', err)
      return {
        appId: dto.appId,
        description: dto.description,
        recommendations: [],
        error: 'AI 推荐生成失败，请稍后重试',
        generatedAt: new Date().toISOString(),
      }
    }
  }

  private parseRecommendJSON(content: string): {
    recommendations: Array<{
      eventName: string
      eventType: string
      trigger: string
      params: string
    }>
  } {
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed.recommendations)) {
        return parsed
      }
    } catch {}

    const match = content.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed.recommendations)) {
          return parsed
        }
      } catch {}
    }

    return { recommendations: [] }
  }
}
