// ─── StoragePersister ───────────────────────────────────────

/**
 * 基于 localStorage 的持久化工具。
 *
 * 用于缓存失败上报数据，所有方法内置异常保护，不向上层抛出异常。
 * 无定时器、无事件监听，无需 destroy。
 */
export class StoragePersister {
  // ── 公有方法 ──

  /**
   * 将数据序列化为 JSON 并存入 localStorage。
   *
   * @param key  - 存储键名
   * @param data - 待存储的数据（需可 JSON 序列化）
   * @returns 存储成功返回 `true`，异常时返回 `false`
   */
  save(key: string, data: unknown): boolean {
    try {
      const json = JSON.stringify(data)
      localStorage.setItem(key, json)
      return true
    } catch {
      // 捕获 QuotaExceededError（Chrome）、NS_ERROR_FILE_NO_DEVICE_SPACE（Firefox，code=22）、
      // JSON 序列化异常、localStorage 不可用等所有异常，统一返回 false
      return false
    }
  }

  /**
   * 从 localStorage 读取并反序列化数据。
   *
   * @param key - 存储键名
   * @returns 反序列化后的数据，key 不存在或 JSON 解析失败时返回 `null`
   */
  load(key: string): unknown | null {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return null
      return JSON.parse(raw) as unknown
    } catch {
      return null
    }
  }

  /**
   * 删除指定键的缓存数据。
   *
   * @param key - 存储键名
   */
  clear(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      // localStorage 不可用时静默忽略
    }
  }
}
