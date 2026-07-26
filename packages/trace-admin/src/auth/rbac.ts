// RBAC 权限匹配引擎
// 支持完全匹配、全局通配 *、后缀通配 analytics.*、中段通配 analytics.*.read

/**
 * 权限点匹配 — 支持通配符
 *
 * @example
 * matchPermission(['analytics.*'], 'analytics.events.read')  // → true
 * matchPermission(['analytics.*.read'], 'analytics.events.read') // → true
 * matchPermission(['*'], 'anything.at.all')                   // → true
 * matchPermission(['analytics.dashboard.*'], 'analytics.events.read') // → false
 */
export function matchPermission(
  userPermissions: string[],
  required: string,
): boolean {
  return userPermissions.some((perm) => {
    // 全局通配
    if (perm === '*') return true
    // 完全匹配
    if (perm === required) return true
    // 后缀通配: analytics.* → 匹配 analytics.xxx
    if (perm.endsWith('.*')) {
      const prefix = perm.slice(0, -2)
      return required.startsWith(prefix + '.')
    }
    // 中段通配: analytics.*.read → 匹配 analytics.events.read
    const regex = new RegExp('^' + perm.replace(/\*/g, '[^.]+') + '$')
    return regex.test(required)
  })
}
