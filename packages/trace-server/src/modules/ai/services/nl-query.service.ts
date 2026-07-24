import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { NlQueryDto } from '../dto/nl-query.dto'
import { AnalysisService } from '../../analysis/services/analysis.service'
import { GlmClientService } from './glm-client.service'
import { PromptService } from './prompt.service'
import { parseAIJson, SSEMessage } from './ai.utils'

export interface NlQueryJson {
  startTime: string
  endTime: string
  eventTypes: string[]
  limit: number
  orderBy: 'asc' | 'desc'
}
const ALLOWED_FIELDS = ['startTime', 'endTime', 'eventTypes', 'limit', 'orderBy']
const ALLOWED_EVENT_TYPES = ['click', 'pageview', 'error', 'custom']
const MAX_DATE_RANGE = 90
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/
const PARSE_MAX_TOKENS = 200
const ANSWER_MAX_TOKENS = 800

@Injectable()
export class NlQueryService {
  private readonly logger = new Logger(NlQueryService.name)

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly glmClient: GlmClientService,
    private readonly promptService: PromptService,
  ) {}

  // ===== 非流式 =====

  async processQuery(dto: NlQueryDto) {
    const queryJson = await this.parseAndValidate(dto.question)
    const data = await this.executeQuery(dto.appId, queryJson)
    const answer = await this.generateAnswer(dto.question, queryJson, data)
    return { question: dto.question, queryJson, data, answer, generatedAt: new Date().toISOString() }
  }

  // ===== 流式 =====

  async *processQueryStream(dto: NlQueryDto): AsyncGenerator<SSEMessage> {
    // 步骤 1-2：NL→JSON（非流式，必须等完整结果）
    let queryJson: NlQueryJson
    try {
      queryJson = await this.parseAndValidate(dto.question)
    } catch (err) {
      yield { type: 'error', message: err instanceof BadRequestException ? err.message : '查询解析失败' }
      yield { type: 'done' }
      return
    }

    yield { type: 'stats', stats: { queryJson } }

    // 步骤 3：执行查询
    let data: unknown
    try {
      data = await this.executeQuery(dto.appId, queryJson)
    } catch (err) {
      this.logger.error('NL 查询执行失败', err)
      yield { type: 'error', message: '数据查询失败' }
      yield { type: 'done' }
      return
    }

    yield { type: 'stats', stats: { data } }

    // 步骤 4：生成回答（流式）
    const systemPrompt = this.promptService.system('nl-query.answer')
    const userPrompt = this.promptService.user('nl-query.answer', {
      question: dto.question,
      queryJson: JSON.stringify(queryJson, null, 2),
      dataJson: JSON.stringify(data, null, 2),
    })

    try {
      for await (const chunk of this.glmClient.chatStream(systemPrompt, userPrompt, { temperature: 0.3, maxTokens: ANSWER_MAX_TOKENS })) {
        yield { type: 'text', content: chunk }
      }
    } catch (err) {
      this.logger.error('NL 回答流式生成失败', err)
      yield { type: 'error', message: 'AI 回答生成失败' }
    }

    yield { type: 'done' }
  }

  // ===== 公共：解析 + 校验 =====

  private async parseAndValidate(question: string): Promise<NlQueryJson> {
    const today = this.getTodayISO()
    const systemPrompt = this.promptService.system('nl-query.parse', { today })
    const userPrompt = this.promptService.user('nl-query.parse', { question })

    const result = await this.glmClient.chat(systemPrompt, userPrompt, { temperature: 0.1, maxTokens: PARSE_MAX_TOKENS })
    const raw = this.parseJSON(result.content)
    return this.validateQueryJson(raw)
  }

  private parseJSON(content: string): Record<string, unknown> {
    const parsed = parseAIJson<Record<string, unknown> | null>(content, null)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    throw new BadRequestException(`AI 返回的查询条件格式异常，请换种方式描述你的问题。原始输出：${content.slice(0, 200)}`)
  }

  private validateQueryJson(raw: Record<string, unknown>): NlQueryJson {
    const cleaned: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in raw) cleaned[key] = raw[key]
    }

    const startTime = String(cleaned.startTime || '')
    if (!ISO_PATTERN.test(startTime)) throw new BadRequestException(`查询起始时间格式错误：${startTime || '(空)'}，期望格式 YYYY-MM-DDTHH:mm:ss`)

    const endTime = String(cleaned.endTime || '')
    if (!ISO_PATTERN.test(endTime)) throw new BadRequestException(`查询结束时间格式错误：${endTime || '(空)'}，期望格式 YYYY-MM-DDTHH:mm:ss`)

    if (new Date(startTime) >= new Date(endTime)) throw new BadRequestException('起始时间必须早于结束时间')

    const diffDays = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 86400000
    if (diffDays > MAX_DATE_RANGE) throw new BadRequestException(`查询时间范围不能超过 ${MAX_DATE_RANGE} 天，当前范围为 ${Math.round(diffDays)} 天`)

    let eventTypes: string[] = []
    if (Array.isArray(cleaned.eventTypes)) {
      eventTypes = (cleaned.eventTypes as string[]).filter(t => ALLOWED_EVENT_TYPES.includes(t))
      const invalid = (cleaned.eventTypes as string[]).filter(t => !ALLOWED_EVENT_TYPES.includes(t))
      if (invalid.length > 0) this.logger.warn(`GLM 返回了非法的 eventTypes，已过滤: [${invalid.join(',')}]`)
    }

    let limit = Number(cleaned.limit) || 10
    if (!Number.isInteger(limit) || limit < 1) limit = 10
    if (limit > 100) limit = 100

    const orderBy = cleaned.orderBy === 'asc' || cleaned.orderBy === 'desc' ? cleaned.orderBy : 'desc'
    return { startTime, endTime, eventTypes, limit, orderBy } as NlQueryJson
  }

  private async executeQuery(appId: string, query: NlQueryJson) {
    const result = await this.analysisService.getFiltered({
      appId,
      startTime: query.startTime,
      endTime: query.endTime,
      eventTypes: query.eventTypes.length > 0 ? query.eventTypes : undefined,
    })
    const sorted = [...result].sort((a, b) => (query.orderBy === 'desc' ? b.count - a.count : a.count - b.count))
    return sorted.slice(0, query.limit)
  }

  private async generateAnswer(question: string, queryJson: NlQueryJson, data: unknown): Promise<string> {
    const systemPrompt = this.promptService.system('nl-query.answer')
    const userPrompt = this.promptService.user('nl-query.answer', {
      question,
      queryJson: JSON.stringify(queryJson, null, 2),
      dataJson: JSON.stringify(data, null, 2),
    })
    try {
      const result = await this.glmClient.chat(systemPrompt, userPrompt, { temperature: 0.3, maxTokens: ANSWER_MAX_TOKENS })
      return result.content
    } catch (err) {
      this.logger.error('NL 回答生成失败', err)
      const count = Array.isArray(data) ? data.length : 0
      return `AI 回答生成失败。查询到 ${count} 条数据，以下是原始结果：${JSON.stringify(data)}`
    }
  }

  private getTodayISO(): string {
    return new Date().toISOString().slice(0, 10)
  }
}
