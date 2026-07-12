/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing'
import * as fs from 'fs'
import { PromptService } from '../services/prompt.service'

/**
 * PromptService 单元测试
 *
 * 测试原则：不读真实磁盘文件，用 jest.spyOn 拦截 fs.readFileSync。
 * 只验证：给定模板内容 + 变量 → 是否产出预期替换结果。
 */

describe('PromptService', () => {
  let service: PromptService
  let readFileSyncSpy: jest.SpyInstance

  beforeEach(async () => {
    jest.clearAllMocks()

    // Mock fs.readFileSync，让所有文件读取都返回我们预设的内容
    // PromptService 自己会用 resolve(__dirname, '..', 'prompts', ...) 拼路径，
    // 但 readFileSync 已经被 mock 了，无论路径是什么都返回假内容
    readFileSyncSpy = jest
      .spyOn(fs, 'readFileSync')
      .mockReturnValue('默认模板内容')

    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptService],
    }).compile()

    service = module.get(PromptService)
  })

  // ==================== 变量替换 ====================

  describe('变量替换', () => {
    it('应正确替换单个 {{变量}}', () => {
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
      readFileSyncSpy.mockReturnValue('SYSTEM: {{role}}')

      const result = service.system('analyze', { role: '分析师' })

      expect(result).toBe('SYSTEM: 分析师')
      // 验证读的是正确的文件名
      const filePath = readFileSyncSpy.mock.calls[0][0] as string
      expect(filePath).toContain('analyze.system.txt')
    })

    it('user() 应读取 <name>.user.txt', () => {
      readFileSyncSpy.mockReturnValue('USER: {{question}}')

      const result = service.user('analyze', { question: '今天PV多少' })

      expect(result).toBe('USER: 今天PV多少')
      const filePath = readFileSyncSpy.mock.calls[0][0] as string
      expect(filePath).toContain('analyze.user.txt')
    })
  })

  // ==================== 文件读取错误 ====================

  describe('文件读取错误', () => {
    it('文件不存在时应抛出明确错误', () => {
      readFileSyncSpy.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory')
      })

      expect(() => service.system('nonexistent')).toThrow(
        'Prompt 文件不存在或无法读取',
      )
    })

    it('权限错误时应抛出明确错误', () => {
      readFileSyncSpy.mockImplementation(() => {
        throw new Error('EACCES: permission denied')
      })

      expect(() => service.user('locked')).toThrow(
        'Prompt 文件不存在或无法读取',
      )
    })
  })
})
