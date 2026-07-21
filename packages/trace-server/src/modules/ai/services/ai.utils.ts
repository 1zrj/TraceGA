import { Logger } from '@nestjs/common'
import { GlmClientService, GlmChatOptions } from './glm-client.service'

/**
 * ai.utils
 * 职责：AI 模块各 Service 之间共享的纯工具函数。
 *
 * 注意：这里也放 withGlmFallback，虽然它接收 GlmClientService 实例，
 */

/**
 * 统一 GLM 调用 + try-catch 降级
 *
 * 消除 4 个 Service 中重复的 try { ... } catch { log + return fallback } 模式。
 *
 * @param glmClient   GlmClientService 实例
 * @param systemPrompt  system prompt
 * @param userPrompt    user prompt
 * @param options       GLM 调用参数
 * @param transform     成功时将 AI 返回文本转为期望的返回值 T
 * @param fallback      失败时返回的默认值
 * @param logger        Logger 实例
 * @param label         日志中的功能标签（如 "AI 分析"、"日报生成"）
 * @returns             AI 调用的结果，或失败时的 fallback
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
 * 解析 AI 返回的 JSON 内容
 *
 * 三层容错：
 * 1. 直接 JSON.parse
 * 2. 正则提取第一个 `{...}` 再 parse（AI 有时在 JSON 外面加解释文字或 markdown）
 * 3. 全都失败则返回 fallback
 *
 * @param content  AI 返回的原始文本
 * @param fallback  parse 失败时返回的默认值
 * @returns         泛型 T，调用方自行做结构校验
 */
export function parseAIJson<T>(content: string, fallback: T): T {
  try {
    return JSON.parse(content) as T
  } catch {
    // 第一层失败，尝试正则提取
  }

  const match = content.match(/\{[\s\S]*?\}/)
  if (match) {
    try {
      return JSON.parse(match[0]) as T
    } catch {
      // 提取后还是 parse 失败，返回 fallback
    }
  }

  return fallback
}

/**
 * 计算变化的百分比（百分数，保留一位小数）
 *
 * @param today    当期值
 * @param yesterday  基期值
 * @returns  变化的百分比，如 12.5 表示增长 12.5%，-5 表示下降 5%
 *
 * 规则：
 * - 基期为 0 时，当期 > 0 返回 100，否则返回 0
 * - 结果四舍五入到一位小数（乘以 1000 再除以 10）
 */
export function calcChange(today: number, yesterday: number): number {
  if (yesterday === 0) return today > 0 ? 100 : 0
  return Math.round(((today - yesterday) / yesterday) * 1000) / 10
}
