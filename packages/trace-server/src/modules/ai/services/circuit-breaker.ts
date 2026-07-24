/**
 * CircuitBreaker — 熔断器
 *
 * 状态机：
 *   CLOSED（正常）─ 连续失败达阈值 ─→ OPEN（熔断）
 *   OPEN（熔断）─── 冷却期过后 ────→ HALF_OPEN（半开）
 *   HALF_OPEN（半开）─ 探针成功 ──→ CLOSED（恢复正常）
 *   HALF_OPEN（半开）─ 探针失败 ──→ OPEN（继续熔断）
 *
 * 用法：
 *   const cb = new CircuitBreaker('GLM', { failureThreshold: 5, cooldownMs: 30_000 })
 *   const result = await cb.call(() => fetch(...))
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  /** 连续失败多少次后熔断 */
  private readonly failureThreshold: number

  /** 熔断后等待多久进入半开 */
  private readonly cooldownMs: number

  /** 熔断器名称（用于日志） */
  private readonly name: string

  constructor(name: string, options?: { failureThreshold?: number; cooldownMs?: number }) {
    this.name = name
    this.failureThreshold = options?.failureThreshold ?? 5
    this.cooldownMs = options?.cooldownMs ?? 30_000
  }

  /**
   * 在熔断器保护下执行异步操作
   *
   * @param fn  要保护的操作
   * @returns   操作结果
   * @throws    CircuitBreakerOpenError 当熔断器处于 OPEN 状态时快速失败
   *            操作本身的异常也会透传
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // 冷却期已过 → 切换到半开，放一个探针请求
      if (Date.now() - this.lastFailureTime >= this.cooldownMs) {
        this.state = 'HALF_OPEN'
      } else {
        throw new CircuitBreakerOpenError(`${this.name} 熔断器已打开，请求被拒绝（冷却中，剩余 ${Math.ceil((this.cooldownMs - (Date.now() - this.lastFailureTime)) / 1000)} 秒）`)
      }
    }

    try {
      const result = await fn()

      // 成功 → 重置计数器
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED'
        this.failures = 0
      }
      this.failures = 0

      return result
    } catch (err) {
      this.failures++
      this.lastFailureTime = Date.now()

      if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
        this.state = 'OPEN'
      }

      throw err
    }
  }

  /** 获取当前状态 */
  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state
  }

  /** 重置熔断器（手动恢复） */
  reset(): void {
    this.state = 'CLOSED'
    this.failures = 0
    this.lastFailureTime = 0
  }
}

/**
 * 熔断器打开时的错误
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CircuitBreakerOpenError'
  }
}
