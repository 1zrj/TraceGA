// 权限点常量 + 角色-权限映射


export const PERMISSIONS = {
  // 事件管理
  EVENTS_READ: 'events.read',
  EVENTS_WRITE: 'events.write',
  EVENTS_DELETE: 'events.delete',
  // 数据看板
  DASHBOARD_READ: 'dashboard.read',
  // 系统设置
  SETTINGS_READ: 'settings.read',
  SETTINGS_WRITE: 'settings.write',
  // 用户管理
  USERS_READ: 'users.read',
  USERS_WRITE: 'users.write',
} as const


interface RoleConfig {
  name: string
  permissions: string[]
}

export const ROLE_PERMISSIONS: Record<string, RoleConfig> = {
  admin: {
    name: '管理员',
    permissions: ['*'],
  },
  editor: {
    name: '编辑者',
    permissions: [
      'events.*',
      'dashboard.*',
      'settings.read',
    ],
  },
  analyst: {
    name: '分析员',
    permissions: [
      'events.read',
      'dashboard.read',
    ],
  },
} as const


export const DEFAULT_PERMISSIONS: string[] = []
