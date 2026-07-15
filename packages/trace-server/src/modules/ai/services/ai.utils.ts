/**
 * ai.utils
 *
 * 职责：AI 模块各 Service 之间共享的纯工具函数。
 *
 * 只放无副作用的、不依赖任何 DI 注入的纯函数。
 * 任何有 NestJS 依赖（constructor 注入）的逻辑都不应该放这里。
 */

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
