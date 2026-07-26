// 路由生成 + 守卫注入
// 递归为每个路由包裹 RouteGuard + Suspense
// B 端路由包裹 AppLayout，独立路由（login/403/404）不包裹

import { Suspense } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { Spin } from 'antd'
import { AuthProvider } from '@/auth/AuthContext'
import { RouteGuard } from '@/auth/RouteGuard'
import { AppLayout } from '@/components/layout/AppLayout'
import { appRoutes, toMenuItems } from './routes'
import type { AppRouteObject } from './routes'


function wrapRoutes(routes: AppRouteObject[]): AppRouteObject[] {
  return routes.map((route) => {
    const children = route.children
      ? wrapRoutes(route.children)
      : undefined

    const element = route.component ? (
      <RouteGuard route={route}>
        <Suspense
          fallback={
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: 200,
              }}
            >
              <Spin size="large" />
            </div>
          }
        >
          <route.component />
        </Suspense>
      </RouteGuard>
    ) : undefined

    return {
      ...route,
      element,
      children,
    }
  })
}


const bRoutes = appRoutes.find((r) => r.path === '/')?.children ?? []
const wrappedBRoutes = wrapRoutes(bRoutes)


const standaloneRoutes = appRoutes.filter((r) => r.hideInMenu)
const wrappedStandalone = wrapRoutes(standaloneRoutes)


const menuItems = toMenuItems(
  appRoutes.find((r) => r.path === '/')?.children ?? [],
)


const router = createBrowserRouter([
  // 根路径重定向
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },

  // B 端：包裹在 AppLayout + AuthProvider 内
  {
    path: '/',
    element: (
      <AuthProvider>
        <AppLayout menuItems={menuItems} />
      </AuthProvider>
    ),
    children: wrappedBRoutes as RouteObject[],
  },

  // 独立路由：包裹在 AuthProvider 内但不在 AppLayout 内
  ...wrappedStandalone.map((r) => ({
    path: r.path,
    element: <AuthProvider>{r.element}</AuthProvider>,
  })),
])

export { router }
export default router
