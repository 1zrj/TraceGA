import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StoragePersister } from '../src/utils/StoragePersister'

// ─── 常量 ───────────────────────────────────────────────────

const TEST_KEY = 'test_key'
const TEST_DATA = { name: 'test' }

// ─── 测试套件 ───────────────────────────────────────────────

describe('StoragePersister', () => {
  let persister: StoragePersister

  beforeEach(() => {
    persister = new StoragePersister()
    localStorage.clear()
  })

  // ── save ──

  describe('save', () => {
    it('正常存储对象并返回 true', () => {
      const result = persister.save(TEST_KEY, TEST_DATA)
      expect(result).toBe(true)
      expect(localStorage.getItem(TEST_KEY)).toBe('{"name":"test"}')
    })

    it('正常存储基本类型（数字、字符串、null）', () => {
      expect(persister.save('num', 42)).toBe(true)
      expect(localStorage.getItem('num')).toBe('42')

      expect(persister.save('str', 'hello')).toBe(true)
      expect(localStorage.getItem('str')).toBe('"hello"')

      expect(persister.save('nil', null)).toBe(true)
      expect(localStorage.getItem('nil')).toBe('null')
    })

    it('JSON 序列化失败（循环引用）返回 false', () => {
      const circular: Record<string, unknown> = {}
      circular.self = circular

      const result = persister.save(TEST_KEY, circular)
      expect(result).toBe(false)
      expect(localStorage.getItem(TEST_KEY)).toBeNull()
    })

    it('QuotaExceededError 返回 false', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw Object.assign(new Error('QuotaExceeded'), { name: 'QuotaExceededError' })
      })

      const result = persister.save(TEST_KEY, { data: 'large' })
      expect(result).toBe(false)

      spy.mockRestore()
    })

    it('localStorage 不可用返回 false', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })

      const result = persister.save(TEST_KEY, TEST_DATA)
      expect(result).toBe(false)

      spy.mockRestore()
    })
  })

  // ── load ──

  describe('load', () => {
    it('正常读取并解析 JSON', () => {
      localStorage.setItem(TEST_KEY, '{"name":"test"}')
      const result = persister.load(TEST_KEY)
      expect(result).toEqual({ name: 'test' })
    })

    it('key 不存在返回 null', () => {
      const result = persister.load('missing_key')
      expect(result).toBeNull()
    })

    it('JSON 解析失败返回 null', () => {
      localStorage.setItem(TEST_KEY, 'not-json')
      const result = persister.load(TEST_KEY)
      expect(result).toBeNull()
    })
  })

  // ── clear ──

  describe('clear', () => {
    it('正常删除已存在的 key', () => {
      localStorage.setItem(TEST_KEY, 'data')
      persister.clear(TEST_KEY)
      expect(localStorage.getItem(TEST_KEY)).toBeNull()
    })

    it('删除不存在的 key 不抛异常', () => {
      expect(() => persister.clear('missing_key')).not.toThrow()
    })

    it('localStorage 不可用时不抛异常', () => {
      const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })

      expect(() => persister.clear(TEST_KEY)).not.toThrow()

      spy.mockRestore()
    })
  })
})
