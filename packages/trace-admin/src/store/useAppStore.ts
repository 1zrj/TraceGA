import { create } from 'zustand'

interface AppState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  userInfo: { name: string; avatar?: string } | null
  setUserInfo: (user: { name: string; avatar?: string } | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  userInfo: { name: 'Admin' },
  setUserInfo: (user) => set({ userInfo: user }),
}))