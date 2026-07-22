import { create } from 'zustand'
import { login as loginApi } from '@/api/auth'
import type { LoginDto, LoginResult } from '@/types'

interface UserInfo {
  name: string
  avatar?: string
  username?: string
  email?: string
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
    const userInfo = {
      name: res.user.name,
      avatar: res.user.avatar,
      username: res.user.username,
      email: res.user.email,
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
