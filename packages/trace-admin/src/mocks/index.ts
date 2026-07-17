/**
 * Mock 模块统一导出入口
 *
 * 使用方式：
 * - 开发环境：自动根据开关策略启动 Mock
 * - 生产环境：除非 VITE_ENABLE_MOCK=true，否则不启动
 * - 调试时：可在 URL 后加 ?mock=true 强制启用
 *
 * 示例：
 *   import { startMockIfEnabled } from '@/mocks'
 *   await startMockIfEnabled()
 */

export { isMockEnabled, getMockMode, startMockIfEnabled } from './toggle'
export { handlers } from './handlers'
export { worker } from './browser'
