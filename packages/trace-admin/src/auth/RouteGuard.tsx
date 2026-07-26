// RouteGuard — 路由守卫组件
// 按优先级检查：加载中 → 公共路由放行 → 未登录 → 角色 → 权限点

import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from './AuthContext'
import type { AppRouteObject } from '@/router/routes'


interface RouteGuardProps {
  route: AppRouteObject
  children: React.ReactNode
}


export function RouteGuard({ route, children }: RouteGuardProps) {
  const { isAuthenticated, isLoading, hasRole, can } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  if (!route.roles && !route.permissions) {
    return <>{children}</>
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/login" state={{ from: location.pathname }} replace />
    )
  }

  if (route.roles && route.roles.length > 0) {
    if (!route.roles.some(hasRole)) {
      return <Navigate to="/403" replace />
    }
  }

  if (route.permissions && route.permissions.length > 0) {
    if (!route.permissions.some(can)) {
      return <Navigate to="/403" replace />
    }
  }

  return <>{children}</>
}
