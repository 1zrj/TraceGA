import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AiAnalyzeDto } from '../dto/ai-analyze.dto'
import { AnalysisService } from '../../analysis/services/analysis.service'

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly configService: ConfigService,
  ) {}

  async analyze(query: AiAnalyzeDto) {
    // 1. 从 ClickHouse 查询真实数据
    const [summary, trend] = await Promise.all([
      this.analysisService.getSummary({
        appId: query.appId,
        startTime: query.startTime,
        endTime: query.endTime,
      }),
      this.analysisService.getTrend({
        appId: query.appId,
        startTime: query.startTime,
        endTime: query.endTime,
        interval: 'day',
      }),
    ])

    // 2. 如果有自然语言问题，调用 GLM 分析
    if (query.question) {
      try {
        const aiReply = await this.callGLM(query.question, summary, trend)
        return {
          insight: aiReply.insight,
          suggestions: aiReply.suggestions,
          metrics: summary,
          trend,
        }
      } catch (err) {
        this.logger.error('GLM API 调用失败', err)
        return {
          insight: 'AI 分析暂时不可用，以下是原始数据供参考。',
          suggestions: ['请检查 GLM_API_KEY 配置是否正确'],
          metrics: summary,
          trend,
        }
      }
    }

    // 如果没有问题，直接返回数据
    return {
      insight: '请提供一个具体问题以获得 AI 分析。',
      suggestions: [],
      metrics: summary,
      trend,
    }
  }

  private async callGLM(
    question: string,
    summary: { pv: number; uv: number; eventCount: number },
    trend: any[],
  ) {
    const apiKey = this.configService.get<string>('GLM_API_KEY', '')
    const model = this.configService.get<string>('GLM_MODEL', 'glm-4-flash')

    if (!apiKey) {
      throw new Error('GLM_API_KEY 未配置')
    }

    // 构造数据摘要
    const dataSummary = `
当前数据概览：
- PV（页面访问量）：${summary.pv}
- UV（独立访客）：${summary.uv}
- 事件种类数：${summary.eventCount}
- 近期趋势（最近 ${trend.length} 个周期）：${JSON.stringify(trend.slice(-7))}
    `.trim()

    const systemPrompt = `你是一个专业的埋点数据分析师。你会收到用户的产品埋点数据和一个问题。
请基于数据给出分析，用中文回复。回复格式严格按 JSON：
{
  "insight": "核心洞察（2-3 句话）",
  "suggestions": ["建议1", "建议2", "建议3"]
}`

    const userPrompt = `以下是埋点数据：\n${dataSummary}\n\n用户的问题是：${question}`

    const response = await fetch(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          stream: false,
        }),
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GLM API 响应异常 [${response.status}]: ${errorText}`)
    }

    const result = await response.json()
    const content = result?.choices?.[0]?.message?.content || ''

    // 尝试从 LLM 返回的 JSON 中解析
    try {
      return JSON.parse(content)
    } catch {
      // 如果 LLM 没返回合法 JSON，把原文当 insight 返回
      return {
        insight: content,
        suggestions: [],
      }
    }
  }
}
