import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * GLM API 调用参数
 */
export interface GlmChatOptions {
  /** 温度，控制输出随机性，0-1，默认 0.3 */
  temperature?: number
  /** 最大输出 token 数，默认 1024 */
  maxTokens?: number
}

/**
 * GLM API 调用结果
 */
export interface GlmChatResult {
  /** AI 返回的文本内容 */
  content: string
  /** 本次调用消耗的 token 数（用于成本统计） */
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * GlmClientService
 *
 * 职责：封装 GLM-4Flash API 的 HTTP 调用，包括超时、重试、错误处理。
 * 不包含任何业务逻辑或 Prompt 构造 —— 它只认 systemPrompt + userPrompt 两个字符串。
 */
@Injectable()
export class GlmClientService {
  private readonly logger = new Logger(GlmClientService.name)

  /** GLM API 地址 */
  private readonly apiUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

  /** 请求超时时间（毫秒） */
  private readonly timeout = 15_000

  /** 失败后最多重试次数 */
  private readonly maxRetries = 1

  constructor(private readonly configService: ConfigService) {}

  /**
   * 调用 GLM 对话接口
   *
   * @param systemPrompt  系统角色提示词（定义 AI 的行为和角色）
   * @param userPrompt    用户提示词（本次要分析的具体内容）
   * @param options       可选参数（temperature、maxTokens）
   * @returns             AI 返回的文本 + token 用量
   */
  async chat(
    systemPrompt: string,
    userPrompt: string,
    options: GlmChatOptions = {},
  ): Promise<GlmChatResult> {
    const { temperature = 0.3, maxTokens = 1024 } = options

    const apiKey = this.configService.get<string>('GLM_API_KEY', '')
    const model = this.configService.get<string>('GLM_MODEL', 'glm-4-flash')

    if (!apiKey) {
      throw new Error('GLM_API_KEY 未配置，请在环境变量中设置 GLM_API_KEY')
    }

    // 带重试的调用
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.doRequest(apiKey, model, systemPrompt, userPrompt, temperature, maxTokens)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))

        // 4xx 错误（如 401 API Key 错误、429 限流）不重试，重试也没用
        if (this.isClientError(err)) {
          throw lastError
        }

        // 最后一次尝试也失败了，抛出错误
        if (attempt >= this.maxRetries) {
          throw lastError
        }

        this.logger.warn(
          `GLM 调用失败，正在进行第 ${attempt + 1} 次重试...`,
          lastError.message,
        )
      }
    }

    // 理论上不会走到这里，但 TypeScript 需要
    throw lastError
  }

  /**
   * 执行单次 HTTP 请求
   */
  private async doRequest(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    maxTokens: number,
  ): Promise<GlmChatResult> {
    const startTime = Date.now()

    // 创建 AbortController 用于超时控制
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(this.apiUrl, {
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
          temperature,
          max_tokens: maxTokens,
          stream: false,
        }),
        signal: controller.signal,
      })

      // 处理 HTTP 错误状态码
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '无法读取响应体')
        const error = new Error(
          `GLM API 返回错误 [${response.status}]: ${errorBody}`,
        )
        // 把状态码挂到 error 上，方便上层判断是否需要重试
        ;(error as any).statusCode = response.status
        throw error
      }

      // 解析成功响应
      const data = await response.json()
      const content: string = data?.choices?.[0]?.message?.content || ''

      // 从 GLM 返回中提取 token 用量
      const usage = {
        promptTokens: data?.usage?.prompt_tokens ?? 0,
        completionTokens: data?.usage?.completion_tokens ?? 0,
        totalTokens: data?.usage?.total_tokens ?? 0,
      }

      const elapsed = Date.now() - startTime
      this.logger.log(
        `GLM 调用成功 | 模型=${model} | 耗时=${elapsed}ms | ` +
        `tokens: prompt=${usage.promptTokens} completion=${usage.completionTokens} total=${usage.totalTokens}`,
      )

      return { content, usage }
    } catch (err) {
      // AbortController 触发的超时错误
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`GLM API 请求超时（${this.timeout / 1000}秒）`)
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * 判断是否是客户端错误（4xx），这类错误不应该重试
   */
  private isClientError(err: unknown): boolean {
    const statusCode = (err as any)?.statusCode
    return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
  }
}
