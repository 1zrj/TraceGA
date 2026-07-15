/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { GlmClientService } from '../services/glm-client.service'

function mockFetchSuccess(content: string, usage?: Record<string, number>) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
      usage: usage ?? { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    }),
  }
}

function mockFetchError(status: number, body: string) {
  return {
    ok: false,
    status,
    text: async () => body,
  }
}

describe('GlmClientService', () => {
  let service: GlmClientService
  let mockConfigGet: jest.Mock

  beforeEach(async () => {
    jest.clearAllMocks()

    mockConfigGet = jest.fn((key: string, defaultValue: string) => {
      if (key === 'GLM_API_KEY') return 'test-api-key'
      if (key === 'GLM_MODEL') return 'glm-4-flash'
      return defaultValue
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlmClientService,
        { provide: ConfigService, useValue: { get: mockConfigGet } },
      ],
    }).compile()

    service = module.get(GlmClientService)
  })

  describe('API Key 校验', () => {
    it('GLM_API_KEY 为空时，应抛出明确的配置错误', async () => {
      mockConfigGet.mockImplementation((key: string, defaultValue: string) => {
        if (key === 'GLM_API_KEY') return ''
        if (key === 'GLM_MODEL') return 'glm-4-flash'
        return defaultValue
      })

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GlmClientService,
          { provide: ConfigService, useValue: { get: mockConfigGet } },
        ],
      }).compile()
      const svc = module.get(GlmClientService)

      await expect(svc.chat('system', 'user')).rejects.toThrow('GLM_API_KEY 未配置')
    })
  })

  describe('正常调用', () => {
    it('成功返回 AI 文本和 token 用量', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        mockFetchSuccess('这是 AI 的分析结果') as any,
      )

      const result = await service.chat('你是专家', '帮我分析数据')

      expect(result.content).toBe('这是 AI 的分析结果')
      expect(result.usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const fetchUrl = fetchSpy.mock.calls[0][0]
      const fetchOptions = fetchSpy.mock.calls[0][1]
      expect(fetchUrl).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions')
      expect(fetchOptions?.method).toBe('POST')

      fetchSpy.mockRestore()
    })

    it('AI 返回空 content 时，应返回空字符串', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(mockFetchSuccess('') as any)
      const result = await service.chat('system', 'user')
      expect(result.content).toBe('')
      expect(result.usage.totalTokens).toBe(150)
    })

    it('默认 temperature=0.3, maxTokens=1024', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        mockFetchSuccess('ok') as any,
      )
      await service.chat('s', 'u')
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
      expect(body.temperature).toBe(0.3)
      expect(body.max_tokens).toBe(1024)
      fetchSpy.mockRestore()
    })

    it('支持自定义 temperature 和 maxTokens', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        mockFetchSuccess('ok') as any,
      )
      await service.chat('s', 'u', { temperature: 0.8, maxTokens: 2048 })
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
      expect(body.temperature).toBe(0.8)
      expect(body.max_tokens).toBe(2048)
      fetchSpy.mockRestore()
    })
  })

  describe('错误处理与重试', () => {
    it('401 错误：应直接抛异常，不重试', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        mockFetchError(401, 'Invalid API Key') as any,
      )
      await expect(service.chat('s', 'u')).rejects.toThrow('401')
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      fetchSpy.mockRestore()
    })

    it('429 限流：应直接抛异常，不重试', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        mockFetchError(429, 'Rate limit exceeded') as any,
      )
      await expect(service.chat('s', 'u')).rejects.toThrow('429')
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      fetchSpy.mockRestore()
    })

    it('500 错误：应重试 1 次，两次都失败后抛出异常', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        mockFetchError(500, 'Server Error') as any,
      )
      await expect(service.chat('s', 'u')).rejects.toThrow('500')
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      fetchSpy.mockRestore()
    })

    it('5xx 错误：第一次失败，重试后成功', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(mockFetchError(500, 'Server Error') as any)
        .mockResolvedValueOnce(mockFetchSuccess('重试后成功') as any)

      const result = await service.chat('s', 'u')
      expect(result.content).toBe('重试后成功')
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      fetchSpy.mockRestore()
    })

    it('网络错误（fetch 本身抛异常，无 HTTP 状态码）：应重试', async () => {
      const networkError = new Error('Network failure')
      const fetchSpy = jest.spyOn(global, 'fetch')
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)

      await expect(service.chat('s', 'u')).rejects.toThrow('Network failure')
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      fetchSpy.mockRestore()
    })
  })

  describe('超时处理', () => {
    it('fetch 抛出 AbortError 时，应转换为超时错误信息', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError')
      jest.spyOn(global, 'fetch').mockRejectedValue(abortError)
      await expect(service.chat('s', 'u')).rejects.toThrow(/请求超时/)
    })
  })
})
