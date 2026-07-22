import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { LoginPage } from '@/pages/Login'
import { ProfilePage } from '@/pages/Profile'
import { HomePage } from '@/pages/Home'
import { EventList } from '@/features/event-management/pages/EventList'
import { Dashboard } from '@/features/dashboard/pages/Dashboard'
import { HomeOutlined, ThunderboltOutlined, DashboardOutlined } from '@ant-design/icons'
import type { MenuItem } from '@/components/layout/AppLayout'

const menuItems: MenuItem[] = [
  {
    key: '/',
    label: '首页',
    icon: <HomeOutlined />,
  },
  {
    key: '/event-management',
    label: '事件管理',
    icon: <ThunderboltOutlined />,
  },
  {
    key: '/dashboard',
    label: '数据看板',
    icon: <DashboardOutlined />,
  },
]

const router = createBrowserRouter([
  // ── 登录页（无布局） ───────────────────────────────────
  {
    path: '/login',
    element: <LoginPage />,
  },

  // ── 受保护页面（带布局 + 路由守卫） ────────────────────
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppLayout menuItems={menuItems} />
      </AuthGuard>
    ),
    children: [
      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: '/event-management',
        element: <EventList />,
      },
      {
        path: '/dashboard',
        element: <Dashboard />,
      },
      {
        path: '/profile',
        element: <ProfilePage />,
      },
    ],
  },
])

export { router }
export default router
