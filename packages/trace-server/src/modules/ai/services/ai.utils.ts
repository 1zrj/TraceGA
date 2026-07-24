import { Logger } from '@nestjs/common'
import { GlmClientService, GlmChatOptions } from './glm-client.service'

// ---------------------------------------------------------------------------
// SSE 流式响应类型
// ---------------------------------------------------------------------------

export type SSEMessage = { type: 'text'; content: string } | { type: 'stats'; stats: unknown } | { type: 'done' } | { type: 'error'; message: string }

/**
 * 将 SSEMessage 发送到 HTTP 响应流
 * @param res  NestJS @Res() 返回的响应对象
 */
export async function writeSSE(res: any, messages: AsyncGenerator<SSEMessage>): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  try {
    for await (const msg of messages) {
      res.write(`data: ${JSON.stringify(msg)}\n\n`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误'
    res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
  } finally {
    res.end()
  }
}

// ---------------------------------------------------------------------------
// 通用工具函数
// ---------------------------------------------------------------------------

/**
 * 统一 GLM 调用 + try-catch 降级
 */
export async function withGlmFallback<T>(
  glmClient: GlmClientService,
  systemPrompt: string,
  userPrompt: string,
  options: GlmChatOptions,
  transform: (content: string) => T,
  fallback: T,
  logger: Logger,
  label: string,
): Promise<T> {
  try {
    const result = await glmClient.chat(systemPrompt, userPrompt, options)
    return transform(result.content)
  } catch (err) {
    logger.error(`${label}失败`, err)
    return fallback
  }
}

/**
 * 解析 AI 返回的 JSON 内容，三层容错
 */
export function parseAIJson<T>(content: string, fallback: T): T {
  try {
    return JSON.parse(content) as T
  } catch {
    /* 解析失败则尝试正则提取 */
  }

  const match = content.match(/\{[\s\S]*?\}/)
  if (match) {
    try {
      return JSON.parse(match[0]) as T
    } catch {
      /* 提取后仍失败则返回 fallback */
    }
  }

  return fallback
}

/**
 * 计算变化的百分比，保留一位小数
 */
export function calcChange(today: number, yesterday: number): number {
  if (yesterday === 0) return today > 0 ? 100 : 0
  return Math.round(((today - yesterday) / yesterday) * 1000) / 10
}
