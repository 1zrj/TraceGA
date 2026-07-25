import { Injectable, Logger } from '@nestjs/common'
import { RecommendDto } from '../dto/recommend.dto'
import { GlmClientService } from './glm-client.service'
import { PromptService } from './prompt.service'
import { parseAIJson, withGlmFallback, SSEMessage } from './ai.utils'

const MAX_TOKENS = 1024

@Injectable()
export class RecommendService {
  private readonly logger = new Logger(RecommendService.name)

  constructor(
    private readonly glmClient: GlmClientService,
    private readonly promptService: PromptService,
  ) {}

  // ===== 非流式 =====

  async recommend(dto: RecommendDto) {
    const { systemPrompt, userPrompt } = this.buildPrompts(dto.description)
    const base = { appId: dto.appId, description: dto.description, generatedAt: new Date().toISOString(), error: undefined as string | undefined }

    return await withGlmFallback(
      this.glmClient,
      systemPrompt,
      userPrompt,
      { temperature: 0.5, maxTokens: MAX_TOKENS },
      content => {
        const parsed = parseAIJson<{ recommendations?: Array<{ eventName: string; eventType: string; trigger: string; params: string }> }>(content, {})
        return { ...base, recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [] }
      },
      { ...base, recommendations: [], error: 'AI 推荐生成失败，请稍后重试' },
      this.logger,
      '埋点推荐生成',
    )
  }

  // ===== 流式 =====

  async *recommendStream(dto: RecommendDto): AsyncGenerator<SSEMessage> {
    const { systemPrompt, userPrompt } = this.buildPrompts(dto.description)

    try {
      for await (const chunk of this.glmClient.chatStream(systemPrompt, userPrompt, { temperature: 0.5, maxTokens: MAX_TOKENS })) {
        yield { type: 'text', content: chunk }
      }
    } catch (err) {
      this.logger.error('埋点推荐流式生成失败', err)
      yield { type: 'error', message: 'AI 推荐生成失败，请稍后重试' }
    }

    yield { type: 'done' }
  }

  private buildPrompts(description: string) {
    return {
      systemPrompt: this.promptService.system('recommend'),
      userPrompt: this.promptService.user('recommend', { description }),
    }
  }
}
