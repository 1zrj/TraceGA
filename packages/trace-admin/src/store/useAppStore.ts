import { create } from 'zustand'
import { login as loginApi } from '@/api/auth'
import type { LoginDto, LoginResult } from '@/types'

interface UserInfo {
  username: string
  email: string
  role: string
  avatar: string | null
}

interface AppState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  userInfo: UserInfo | null
  setUserInfo: (user: UserInfo | null) => void

  // auth
  token: string | null
  isAuthenticated: boolean
  login: (dto: LoginDto) => Promise<LoginResult>
  logout: () => void
  initializeAuth: () => void

  // Dashboard dateRange（AI 分析需要感知筛选范围）
  dashboardDateRange: { startTime?: string; endTime?: string } | null
  setDashboardDateRange: (range: { startTime?: string; endTime?: string } | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  userInfo: null,
  setUserInfo: (user) => set({ userInfo: user }),

  // ── auth ──────────────────────────────────────────────────
  token: null,
  isAuthenticated: false,

  login: async (dto: LoginDto) => {
    const res = await loginApi(dto)
    const userInfo: UserInfo = {
      username: res.user.username,
      email: res.user.email,
      role: res.user.role,
      avatar: res.user.avatar,
    }
    localStorage.setItem('token', res.token)
    localStorage.setItem('userInfo', JSON.stringify(userInfo))
    set({
      token: res.token,
      isAuthenticated: true,
      userInfo,
    })
    return res
  },

  logout: () => {
    localStorage.removeItem('token')
    set({
      token: null,
      isAuthenticated: false,
      userInfo: null,
    })
  },

  dashboardDateRange: null,
  setDashboardDateRange: (range) => set({ dashboardDateRange: range }),

  initializeAuth: () => {
    const token = localStorage.getItem('token')
    // 从 localStorage 读取缓存的用户信息
    let userInfo: UserInfo | null = null
    try {
      const cached = localStorage.getItem('userInfo')
      if (cached) {
        userInfo = JSON.parse(cached)
      }
    } catch {
      // ignore
    }

    set({
      token,
      isAuthenticated: !!token,
      userInfo,
    })
  },
}))
