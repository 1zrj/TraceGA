// AuthContext — 认证上下文
// 提供 AuthProvider + useAuth hook
// 从 localStorage token 恢复用户，从 roles 推导 permissions

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react'
import type { ReactNode } from 'react'
import { matchPermission } from './rbac'
import { ROLE_PERMISSIONS, DEFAULT_PERMISSIONS } from './permissions'
import { notifyError } from '@/components/feedback/notification'


interface UserInfo {
  id: string
  name: string
  avatar?: string
  roles: string[]
}

interface AuthState {
  user: UserInfo | null
  permissions: string[]
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  /** 检查是否拥有指定权限点 */
  can: (permission: string) => boolean
  /** 检查是否拥有指定角色 */
  hasRole: (role: string) => boolean
  /** 登录 */
  login: (token: string) => Promise<void>
  /** 登出 */
  logout: () => void
}


interface TokenPayload {
  user: string
  roles: string[]
  exp: number
}

function parseToken(token: string): TokenPayload | null {
  try {
    const payload = JSON.parse(atob(token))
    if (payload.exp && payload.exp < Date.now()) {
      return null
    }
    return payload
  } catch {
    return null
  }
}


const AuthContext = createContext<AuthContextValue>(null!)


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 启动时从 token 恢复用户信息
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setIsLoading(false)
      return
    }

    const payload = parseToken(token)
    if (!payload) {
      localStorage.removeItem('token')
      setIsLoading(false)
      return
    }

    setUser({
      id: payload.user,
      name: payload.user,
      roles: payload.roles,
    })
    setIsLoading(false)
  }, [])

  // 从 roles 推导 permissions
  const permissions = useMemo(() => {
    if (!user?.roles) return DEFAULT_PERMISSIONS
    const perms = user.roles.flatMap(
      (role) => ROLE_PERMISSIONS[role]?.permissions ?? [],
    )
    // 去重
    return [...new Set(perms)]
  }, [user?.roles])

  const can = useCallback(
    (perm: string) => matchPermission(permissions, perm),
    [permissions],
  )

  const hasRole = useCallback(
    (role: string) => user?.roles?.includes(role) ?? false,
    [user?.roles],
  )

  const login = useCallback(async (token: string) => {
    localStorage.setItem('token', token)
    const payload = parseToken(token)
    if (!payload) {
      notifyError('无效的登录凭证')
      throw new Error('Invalid token')
    }
    setUser({
      id: payload.user,
      name: payload.user,
      roles: payload.roles,
    })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      permissions,
      isAuthenticated: !!user,
      isLoading,
      can,
      hasRole,
      login,
      logout,
    }),
    [user, permissions, isLoading, can, hasRole, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth 必须在 AuthProvider 内部使用')
  }
  return ctx
}
