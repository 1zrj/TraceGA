/**
 * 基于 localStorage 的持久化工具类，用于缓存失败上报数据。
 * 所有方法内置异常保护，不向上抛出。
 */
export class StoragePersister {
  /**
   * 将数据序列化为 JSON 并存入 localStorage。
   *
   * @param key - 存储键名
   * @param data - 待存储的数据（需可序列化）
   * @returns 存储成功返回 `true`，QuotaExceeded 或序列化异常时返回 `false`
   */
  save(key: string, data: any): boolean {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(key, json);
      return true;
    } catch (error: any) {
      // QuotaExceededError 或 JSON 序列化错误
      if (error.name === 'QuotaExceededError' || error.code === 22) {
        return false;
      }
      // 其他异常（如 localStorage 不可用）也返回 false
      return false;
    }
  }

  /**
   * 从 localStorage 读取并反序列化数据。
   *
   * @param key - 存储键名
   * @returns 反序列化后的数据，不存在或异常时返回 `null`
   */
  load(key: string): any | null {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * 删除指定键的数据。
   *
   * @param key - 存储键名
   */
  clear(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // 静默忽略
    }
  }
}