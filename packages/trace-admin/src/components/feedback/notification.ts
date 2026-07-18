// ═══════════════════════════════════════════════════════════════
// 通用通知方法 — 基于 antd message 二次封装
// 统一 B/C 端 placement / duration
// ═══════════════════════════════════════════════════════════════

import { message } from 'antd'
import type { ArgsProps as NotificationArgsProps } from 'antd/es/notification'

// ─── 默认配置 ──────────────────────────────────────────────────

const DEFAULT_DURATION = 3
const ERROR_DURATION = 5

// ─── 通知方法 ──────────────────────────────────────────────────

/** 操作成功 — 顶部居中，2-3 秒自动消失 */
export function notifySuccess(
  content: string,
  duration = DEFAULT_DURATION,
): void {
  message.success(content, duration)
}

/** 操作失败 — 含原因说明，3-5 秒 */
export function notifyError(
  content: string,
  duration = ERROR_DURATION,
): void {
  message.error(content, duration)
}

/** 警告提示 */
export function notifyWarning(
  content: string,
  duration = DEFAULT_DURATION,
): void {
  message.warning(content, duration)
}

/** 信息提示 */
export function notifyInfo(
  content: string,
  duration = DEFAULT_DURATION,
): void {
  message.info(content, duration)
}

/** 加载中提示 — 返回关闭函数 */
export function notifyLoading(content: string): () => void {
  const hide = message.loading(content, 0)
  return hide
}

// ─── 聚合导出 ──────────────────────────────────────────────────

export const notify = {
  success: notifySuccess,
  error: notifyError,
  warning: notifyWarning,
  info: notifyInfo,
  loading: notifyLoading,
} as const

// 重新导出类型以备将来 notification API 迁移
export type { NotificationArgsProps }
