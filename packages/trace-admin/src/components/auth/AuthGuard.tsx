import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAppStore } from '@/store'

interface AuthGuardProps {
  children: React.ReactNode
}

/**
 * 路由守卫 — 未登录时重定向到 /login
 * 保留当前路径，登录后跳回
 */
export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}
