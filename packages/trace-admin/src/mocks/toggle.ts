/**
 * Mock 开关控制模块
 *
 * 支持三种方式控制 Mock 启用/禁用（优先级从高到低）：
 * 1. URL 参数：?mock=true / ?mock=false（方便调试时临时切换）
 * 2. 环境变量：VITE_ENABLE_MOCK=true / false
 * 3. 默认行为：开发环境启用，生产环境禁用
 */

type MockMode = 'enabled' | 'disabled' | 'auto'

/**
 * 判断 Mock 是否已启用
 * URL 参数 > 环境变量 > 默认（DEV 启用，PROD 禁用）
 */
export function isMockEnabled(): boolean {
  // 1. URL 参数优先级最高
  const urlParams = new URLSearchParams(window.location.search)
  const urlMock = urlParams.get('mock')
  if (urlMock === 'true') return true
  if (urlMock === 'false') return false

  // 2. 环境变量
  const envMock = import.meta.env.VITE_ENABLE_MOCK
  if (envMock === 'true') return true
  if (envMock === 'false') return false

  // 3. 默认规则
  return import.meta.env.DEV
}

/**
 * 获取当前的 Mock 模式
 */
export function getMockMode(): MockMode {
  const urlParams = new URLSearchParams(window.location.search)
  const urlMock = urlParams.get('mock')
  if (urlMock === 'true') return 'enabled'
  if (urlMock === 'false') return 'disabled'

  const envMock = import.meta.env.VITE_ENABLE_MOCK
  if (envMock === 'true') return 'enabled'
  if (envMock === 'false') return 'disabled'

  return 'auto'
}

/**
 * 条件启动 MSW Worker
 * 仅在 isMockEnabled() 返回 true 时启动
 */
export async function startMockIfEnabled(): Promise<boolean> {
  if (!isMockEnabled()) {
    if (import.meta.env.DEV) {
      console.log('[Mock] 已禁用（可通过 ?mock=true 临时启用）')
    }
    return false
  }

  const { worker } = await import('./browser')
  await worker.start({
    onUnhandledRequest: 'bypass',
  })
  console.log('[Mock] MSW Worker 已启动')
  return true
}
