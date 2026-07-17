import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/routes/index'
import { startMockIfEnabled } from '@/mocks'

async function bootstrap() {
  try {
    await startMockIfEnabled()
  } catch (err) {
    console.warn('[Mock] MSW 启动失败，应用将以无 Mock 模式运行:', err)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

bootstrap()