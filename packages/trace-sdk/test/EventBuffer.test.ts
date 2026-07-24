import { describe, it, expect } from 'vitest'
import { EventBuffer } from '../src/core/EventBuffer'

describe('EventBuffer', () => {
  // ── 构造函数 ──

  describe('constructor', () => {
    it('创建容量为 5 的缓冲区，初始 size 为 0', () => {
      const buf = new EventBuffer<number>(5)
      expect(buf.size()).toBe(0)
    })

    it('容量为 1 的边界值正常创建', () => {
      const buf = new EventBuffer<string>(1)
      expect(buf.size()).toBe(0)
    })

    it('maxSize 为 0 时抛出 Error', () => {
      expect(() => new EventBuffer<number>(0)).toThrow('maxSize must be greater than 0')
    })

    it('maxSize 为负数时抛出 Error', () => {
      expect(() => new EventBuffer<number>(-1)).toThrow('maxSize must be greater than 0')
    })
  })

  // ── push ──

  describe('push', () => {
    it('正常追加元素，size 递增', () => {
      const buf = new EventBuffer<number>(5)
      buf.push(1)
      buf.push(2)
      expect(buf.size()).toBe(2)
    })

    it('超过容量时移除最旧元素', () => {
      const buf = new EventBuffer<number>(3)
      buf.push(1)
      buf.push(2)
      buf.push(3)
      buf.push(4)

      expect(buf.size()).toBe(3)
      expect(buf.takeAll()).toEqual([2, 3, 4])
    })

    it('连续多次超容，始终保留最新 N 条', () => {
      const buf = new EventBuffer<string>(2)
      buf.push('a')
      buf.push('b')
      buf.push('c')
      buf.push('d')

      expect(buf.size()).toBe(2)
      expect(buf.takeAll()).toEqual(['c', 'd'])
    })

    it('容量为 1 时每次 push 都替换旧值', () => {
      const buf = new EventBuffer<number>(1)
      buf.push(10)
      buf.push(20)
      buf.push(30)

      expect(buf.size()).toBe(1)
      expect(buf.takeAll()).toEqual([30])
    })
  })

  // ── pop ──

  describe('pop', () => {
    it('按 FIFO 顺序弹出最旧元素', () => {
      const buf = new EventBuffer<number>(5)
      buf.push(10)
      buf.push(20)
      buf.push(30)

      expect(buf.pop()).toBe(10)
      expect(buf.size()).toBe(2)
      expect(buf.pop()).toBe(20)
      expect(buf.size()).toBe(1)
    })

    it('缓冲区为空时返回 undefined', () => {
      const buf = new EventBuffer<number>(5)
      expect(buf.pop()).toBeUndefined()
    })

    it('超容后 pop 应跳过被淘汰的元素', () => {
      const buf = new EventBuffer<number>(2)
      buf.push(1)
      buf.push(2)
      buf.push(3) // 1 被淘汰
      buf.push(4) // 2 被淘汰

      expect(buf.pop()).toBe(3)
      expect(buf.pop()).toBe(4)
      expect(buf.pop()).toBeUndefined()
    })
  })

  // ── size ──

  describe('size', () => {
    it('空缓冲区返回 0', () => {
      expect(new EventBuffer<number>(5).size()).toBe(0)
    })

    it('push 后正确递增', () => {
      const buf = new EventBuffer<number>(5)
      buf.push(1)
      expect(buf.size()).toBe(1)
      buf.push(2)
      expect(buf.size()).toBe(2)
    })

    it('pop 后正确递减', () => {
      const buf = new EventBuffer<number>(5)
      buf.push(1)
      buf.push(2)
      buf.pop()
      expect(buf.size()).toBe(1)
    })
  })

  // ── clear ──

  describe('clear', () => {
    it('清空所有元素，size 归零', () => {
      const buf = new EventBuffer<number>(5)
      buf.push(1)
      buf.push(2)
      buf.clear()

      expect(buf.size()).toBe(0)
      expect(buf.pop()).toBeUndefined()
    })

    it('空缓冲区 clear 不报错', () => {
      const buf = new EventBuffer<number>(5)
      expect(() => buf.clear()).not.toThrow()
    })
  })

  // ── takeAll ──

  describe('takeAll', () => {
    it('按 FIFO 顺序返回全部元素并清空缓冲区', () => {
      const buf = new EventBuffer<number>(5)
      buf.push(1)
      buf.push(2)
      buf.push(3)

      const all = buf.takeAll()
      expect(all).toEqual([1, 2, 3])
      expect(buf.size()).toBe(0)
    })

    it('空缓冲区返回空数组', () => {
      const buf = new EventBuffer<number>(5)
      expect(buf.takeAll()).toEqual([])
      expect(buf.size()).toBe(0)
    })

    it('返回的是副本，外部修改不影响内部状态', () => {
      const buf = new EventBuffer<{ id: number }>(5)
      buf.push({ id: 1 })
      buf.push({ id: 2 })

      const all = buf.takeAll()
      all[0].id = 999 // 修改数组元素
      all.length = 0 // 修改数组长度

      // 缓冲区已清空，不受影响
      expect(buf.size()).toBe(0)

      // 重新 push 验证内部状态正常
      buf.push({ id: 3 })
      expect(buf.takeAll()).toEqual([{ id: 3 }])
    })
  })

  // ── 集成场景 ──

  describe('集成场景', () => {
    it('push → pop → push 混合操作保持 FIFO', () => {
      const buf = new EventBuffer<number>(3)
      buf.push(1)
      buf.push(2)
      buf.pop() // 移除 1
      buf.push(3) // 2, 3
      buf.push(4) // 2, 3, 4

      expect(buf.takeAll()).toEqual([2, 3, 4])
    })

    it('超容后 takeAll 不包含被淘汰元素', () => {
      const buf = new EventBuffer<number>(3)
      buf.push(1)
      buf.push(2)
      buf.push(3)
      buf.push(4) // 1 淘汰
      buf.push(5) // 2 淘汰

      expect(buf.takeAll()).toEqual([3, 4, 5])
    })

    it('clear 后重新使用正常', () => {
      const buf = new EventBuffer<number>(3)
      buf.push(1)
      buf.push(2)
      buf.clear()
      buf.push(3)
      buf.push(4)

      expect(buf.takeAll()).toEqual([3, 4])
    })
  })
})
