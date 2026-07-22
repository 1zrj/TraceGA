import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/routes/index'
import { startMockIfEnabled } from '@/mocks'
import { useAppStore } from '@/store'

async function bootstrap() {
  try {
    await startMockIfEnabled()
  } catch (err) {
    console.warn('[Mock] MSW 启动失败，应用将以无 Mock 模式运行:', err)
  }

  // 初始化认证状态（从 localStorage 读取 token 和用户信息）
  useAppStore.getState().initializeAuth()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

bootstrap()
