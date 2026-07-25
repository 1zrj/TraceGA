/// <reference types="jest" />
import { parseAIJson, calcChange } from '../services/ai.utils'

// ============================================================
// parseAIJson — 三层容错 JSON 解析工具函数
// ============================================================
describe('parseAIJson', () => {
  // ---- 场景 1：标准的纯 JSON ----
  describe('标准的 JSON 输入', () => {
    it('应正确解析完整的 JSON 对象', () => {
      const result = parseAIJson<{ insight: string; suggestions: string[] }>('{"insight": "PV 上涨了", "suggestions": ["优化A", "优化B"]}', { insight: '', suggestions: [] })
      expect(result.insight).toBe('PV 上涨了')
      expect(result.suggestions).toEqual(['优化A', '优化B'])
    })

    it('应正确解析嵌套 JSON', () => {
      const result = parseAIJson<{ a: { b: number } }>('{"a":{"b":42}}', { a: { b: 0 } })
      expect(result.a.b).toBe(42)
    })

    it('应正确解析 JSON 数组', () => {
      const result = parseAIJson<number[]>('[1, 2, 3]', [])
      expect(result).toEqual([1, 2, 3])
    })

    it('应正确解析简单值（字符串）', () => {
      const result = parseAIJson<string>('"hello"', '')
      expect(result).toBe('hello')
    })

    it('应正确解析简单值（数字）', () => {
      const result = parseAIJson<number>('42', 0)
      expect(result).toBe(42)
    })

    it('应正确解析布尔值', () => {
      const result = parseAIJson<boolean>('true', false)
      expect(result).toBe(true)
    })

    it('应正确解析 null', () => {
      const result = parseAIJson<null>('null', null)
      expect(result).toBeNull()
    })
  })

  // ---- 场景 2：AI 在 JSON 外面加了文字 ----
  describe('AI 在 JSON 外面加了文字', () => {
    it('开头有文字，应提取第一个 {} 对象', () => {
      const result = parseAIJson<{ insight: string }>('根据数据分析：\n{"insight": "用户活跃度下降"}\n建议关注留存', { insight: '' })
      expect(result.insight).toBe('用户活跃度下降')
    })

    it('后面有文字，应提取第一个 {} 对象', () => {
      const result = parseAIJson<{ score: number }>('{"score": 95}\n这是模型给出的评分', { score: 0 })
      expect(result.score).toBe(95)
    })

    it('markdown 代码块包裹，应提取 {}', () => {
      const result = parseAIJson<{ answer: string }>('```json\n{"answer": "这是回答"}\n```', { answer: '' })
      expect(result.answer).toBe('这是回答')
    })

    it('多个 {} 时，应提取第一个', () => {
      const result = parseAIJson<{ id: number }>('{"id": 1} 然后 {"id": 2}', { id: 0 })
      expect(result.id).toBe(1)
    })

    it('一个段落文字中嵌入 JSON，应提取成功', () => {
      const result = parseAIJson<{ reason: string }>('分析结果：{"reason": "因为节假日流量波动"}。请关注。', { reason: '' })
      expect(result.reason).toBe('因为节假日流量波动')
    })
  })

  // ---- 场景 3：AI 返回的不是合法 JSON ----
  describe('AI 返回的不是合法 JSON', () => {
    it('纯文字（无 {} 结构），应返回 fallback', () => {
      const fallback = { insight: '', suggestions: [] }
      const result = parseAIJson('AI 说现在无法分析，请稍后重试', fallback)
      expect(result).toBe(fallback)
    })

    it('有 {} 但内容不是合法 JSON，应返回 fallback', () => {
      const fallback = { value: 0 }
      const result = parseAIJson('结果是：{value: 不是合法json}', fallback)
      expect(result).toBe(fallback)
    })

    it('{} 中的 JSON 字段名没加引号，应返回 fallback', () => {
      const fallback = { insight: '' }
      const result = parseAIJson('{insight: "不行"}', fallback)
      expect(result).toBe(fallback)
    })

    it('空字符串，应返回 fallback', () => {
      const fallback = { ok: false }
      const result = parseAIJson('', fallback)
      expect(result).toBe(fallback)
    })

    it('只含空白字符，应返回 fallback', () => {
      const fallback = { ok: false }
      const result = parseAIJson('   \n  \t  ', fallback)
      expect(result).toBe(fallback)
    })

    it('截断的不完整 JSON，应返回 fallback', () => {
      const fallback = { insight: '' }
      const result = parseAIJson('{"insight": "分析中...', fallback)
      expect(result).toBe(fallback)
    })
  })

  // ---- 场景 4：边界值 ----
  describe('边界情况', () => {
    it('fallback 默认值不应被突变', () => {
      const fallback = { count: 0, items: [] as number[] }
      const result = parseAIJson('{"count": 5, "items": [1,2,3]}', fallback)
      // parseAIJson 返回的是解析后的新对象，不是 fallback 引用
      expect(result.count).toBe(5)
      expect(result.items).toEqual([1, 2, 3])
      // fallback 本身不变
      expect(fallback.count).toBe(0)
      expect(fallback.items).toEqual([])
    })

    it('超大 JSON 也能正确解析', () => {
      const large = { data: 'x'.repeat(10000) }
      const json = JSON.stringify(large)
      const result = parseAIJson(json, { data: '' })
      expect(result.data.length).toBe(10000)
    })

    it('特殊字符不影响解析', () => {
      const result = parseAIJson<{ text: string }>('{"text": "换行\\n制表\\t引号\\"反斜杠\\\\"}', { text: '' })
      expect(result.text).toContain('\n')
      expect(result.text).toContain('\t')
      expect(result.text).toContain('"')
      expect(result.text).toContain('\\')
    })
  })
})

// ============================================================
// calcChange — 百分比变化计算函数（已有，回归验证）
// ============================================================
describe('calcChange', () => {
  it('正常增长：100 → 150，增长 50%', () => {
    expect(calcChange(150, 100)).toBe(50)
  })

  it('正常下降：200 → 100，下降 50%', () => {
    expect(calcChange(100, 200)).toBe(-50)
  })

  it('基期为 0，当期 > 0，应返回 100', () => {
    expect(calcChange(100, 0)).toBe(100)
  })

  it('基期为 0，当期也为 0，应返回 0', () => {
    expect(calcChange(0, 0)).toBe(0)
  })

  it('保留一位小数：50 → 73，变化 46.0%', () => {
    expect(calcChange(73, 50)).toBe(46)
  })

  it('保留一位小数精确：1 → 3，变化 200%', () => {
    expect(calcChange(3, 1)).toBe(200)
  })

  it('负值场景：从 -100 到 -50（亏损减少），变化 -50%', () => {
    const result = calcChange(-50, -100)
    expect(result).toBe(-50)
  })
})
