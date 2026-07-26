// 路由配置定义

import React from 'react'
import type { RouteObject } from 'react-router-dom'
import type { MenuItem } from '@/components/layout/AppLayout'
import {
  HomeOutlined,
  ThunderboltOutlined,
  DashboardOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { PERMISSIONS } from '@/auth/permissions'


export interface AppRouteObject extends Omit<RouteObject, 'children'> {
  roles?: string[]
  permissions?: string[]
  /** 页面组件（懒加载），由 wrapRoutes 转换为 element */
  component?: React.LazyExoticComponent<React.ComponentType<object>>
  hideInMenu?: boolean
  icon?: React.ReactNode
  children?: AppRouteObject[]
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyPage(importer: () => Promise<any>, name: string) {
  return React.lazy(() =>
    importer().then((mod: Record<string, React.ComponentType<object>>) => ({
      default: mod[name],
    })),
  )
}

const HomePage = lazyPage(() => import('@/pages/Home'), 'HomePage')
const LoginPage = lazyPage(() => import('@/pages/Login'), 'LoginPage')
const ForbiddenPage = lazyPage(() => import('@/pages/403'), 'ForbiddenPage')
const NotFoundPage = lazyPage(() => import('@/pages/404'), 'NotFoundPage')
const EventListPage = lazyPage(
  () => import('@/features/event-management/pages/EventList'),
  'EventList',
)
const DashboardPage = lazyPage(
  () => import('@/features/dashboard/pages/Dashboard'),
  'Dashboard',
)


export const appRoutes: AppRouteObject[] = [
  {
    path: '/',
    children: [
      {
        path: '/',
        icon: <HomeOutlined />,
        component: HomePage,
      },
      {
        path: '/event-management',
        icon: <ThunderboltOutlined />,
        permissions: [PERMISSIONS.EVENTS_READ],
        component: EventListPage,
      },
      {
        path: '/dashboard',
        icon: <DashboardOutlined />,
        permissions: [PERMISSIONS.DASHBOARD_READ],
        component: DashboardPage,
      },
      {
        path: '/settings',
        icon: <SettingOutlined />,
        roles: ['admin'],
        permissions: [PERMISSIONS.SETTINGS_READ],
        children: [
          {
            path: '/settings/account',
            roles: ['admin'],
            component: HomePage,
          },
        ],
      },
      {
        path: '/users',
        icon: <TeamOutlined />,
        roles: ['admin', 'editor'],
        permissions: [PERMISSIONS.USERS_READ],
        component: HomePage,
      },
    ],
  },
  {
    path: '/login',
    hideInMenu: true,
    component: LoginPage,
  },
  {
    path: '/403',
    hideInMenu: true,
    component: ForbiddenPage,
  },
  {
    path: '/404',
    hideInMenu: true,
    component: NotFoundPage,
  },
  {
    path: '/profile',
    hideInMenu: true,
    roles: ['admin', 'editor', 'analyst'],
    component: HomePage,
  },
]


export function toMenuItems(routes: AppRouteObject[]): MenuItem[] {
  return routes
    .filter((r) => !r.hideInMenu && r.path && r.path !== '/')
    .map((r) => ({
      key: r.path!,
      label: r.path!.replace('/', '').replace('-', ' '),
      icon: r.icon,
      children: r.children ? toMenuItems(r.children) : undefined,
    }))
}
