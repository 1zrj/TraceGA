/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing'
import * as fs from 'fs'
import { PromptService } from '../services/prompt.service'

/**
 * PromptService 单元测试
 *
 * 测试原则：不读真实磁盘文件，用 jest.spyOn 拦截 fs.readFileSync / fs.readdirSync。
 * 只验证：给定模板内容 + 变量 → 是否产出预期替换结果。
 */

describe('PromptService', () => {
  let service: PromptService
  let readFileSyncSpy: jest.SpyInstance
  let readdirSyncSpy: jest.SpyInstance
  let watchSpy: jest.SpyInstance

  beforeEach(async () => {
    jest.clearAllMocks()

    // Mock fs.readdirSync：模拟 prompts 目录下只有 test.system.txt 和 test.user.txt
    readdirSyncSpy = jest.spyOn(fs, 'readdirSync').mockReturnValue(['test.system.txt', 'test.user.txt'] as any)

    // Mock fs.readFileSync：按文件名返回对应的模板内容
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((filePath: any) => {
      const file = String(filePath)
      if (file.includes('test.system.txt')) return 'SYSTEM: {{role}}'
      if (file.includes('test.user.txt')) return 'USER: {{question}}'
      return '默认模板内容'
    })

    // Mock fs.watch：避免真正监听文件目录
    watchSpy = jest.spyOn(fs, 'watch').mockReturnValue({
      close: jest.fn(),
    } as any)

    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptService],
    }).compile()

    service = module.get(PromptService)
  })

  // ==================== 变量替换 ====================

  describe('变量替换', () => {
    it('应正确替换单个 {{变量}}', () => {
      // 覆盖 readFileSync 返回：system('test') 会读取 test.system.txt
      readFileSyncSpy.mockReturnValue('你好 {{name}}，欢迎使用')

      const result = service.system('test', { name: '张三' })

      expect(result).toBe('你好 张三，欢迎使用')
    })

    it('应正确替换多个 {{变量}}', () => {
      readFileSyncSpy.mockReturnValue('{{greeting}} {{name}}，今天是 {{date}}')

      const result = service.user('test', {
        greeting: '你好',
        name: '李四',
        date: '2026-07-10',
      })

      expect(result).toBe('你好 李四，今天是 2026-07-10')
    })

    it('变量未提供时，应保留原始占位符', () => {
      readFileSyncSpy.mockReturnValue('你好 {{name}}')

      const result = service.system('test', {}) // 没传 name

      // 占位符保持不变，不报错
      expect(result).toBe('你好 {{name}}')
    })

    it('部分变量未提供时，已提供的替换，未提供的保留', () => {
      readFileSyncSpy.mockReturnValue('{{a}} 和 {{b}} 和 {{c}}')

      const result = service.user('test', { a: '一', c: '三' })

      expect(result).toBe('一 和 {{b}} 和 三')
    })

    it('无占位符的纯文本应原样返回', () => {
      readFileSyncSpy.mockReturnValue('这是没有变量的纯文本')

      const result = service.system('test')

      expect(result).toBe('这是没有变量的纯文本')
    })

    it('空模板应返回空字符串', () => {
      readFileSyncSpy.mockReturnValue('')

      const result = service.system('test')

      expect(result).toBe('')
    })
  })

  // ==================== system / user 方法 ====================

  describe('system() 和 user() 方法', () => {
    it('system() 应读取 <name>.system.txt', () => {
      // 这个测试利用 beforeEach 中预设的 mock：
      // test.system.txt → 'SYSTEM: {{role}}'
      const result = service.system('test', { role: '分析师' })

      expect(result).toBe('SYSTEM: 分析师')
    })

    it('user() 应读取 <name>.user.txt', () => {
      const result = service.user('test', { question: '今天PV多少' })

      expect(result).toBe('USER: 今天PV多少')
    })
  })

  // ==================== 文件读取错误 ====================

  describe('文件读取错误', () => {
    it('不存在的 Prompt 文件应抛出明确错误', () => {
      // nonexistent.system.txt 不在 readdirSync 返回的列表中，也不在缓存中
      // readFileSync 会被调用（缓存 miss 时兜底读取），让它抛出错误
      readFileSyncSpy.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory')
      })

      expect(() => service.system('nonexistent')).toThrow('Prompt 文件不存在或无法读取')
    })
  })

  // ==================== 缓存行为 ====================

  describe('缓存行为', () => {
    it('第二次调用同一文件应命中缓存，不再 readFileSync', () => {
      // 第一次调用：缓存 miss，触发 readFileSync 读盘
      const first = service.system('test', { role: '分析师' })
      expect(first).toBe('SYSTEM: 分析师')

      // 记录此时的 readFileSync 调用次数
      const callCountAfterFirst = readFileSyncSpy.mock.calls.length

      // 第二次调用：应命中缓存，不再读盘
      const second = service.system('test', { role: '分析师' })
      expect(second).toBe('SYSTEM: 分析师')

      // readFileSync 不应有新增调用
      expect(readFileSyncSpy.mock.calls.length - callCountAfterFirst).toBe(0)
    })
  })
})
