import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import type { MenuItem } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/Home'
import { EventList } from '@/features/event-management/pages/EventList'
import { Dashboard } from '@/features/dashboard/pages/Dashboard'
import {
  HomeOutlined,
  ThunderboltOutlined,
  DashboardOutlined,
} from '@ant-design/icons'

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
  {
    path: '/',
    element: <AppLayout menuItems={menuItems} />,
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
    ],
  },
])

export { router }
export default router
