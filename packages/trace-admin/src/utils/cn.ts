
// className 合并工具
// 自动添加 .tk- 命名空间前缀，已含前缀则跳过

const TK_PREFIX = 'tk-'

/** 判断一个类名是否已有 tk- 前缀 */
function hasTkPrefix(cls: string): boolean {
  return cls.startsWith(TK_PREFIX)
}

/** 给单个类名添加 tk- 前缀 */
function prefixOne(cls: string): string {
  const trimmed = cls.trim()
  if (!trimmed || hasTkPrefix(trimmed)) return trimmed
  // 处理以伪类/伪元素/响应式开头的变体：hover:xxx → hover:tk-xxx
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':')
    const lastIdx = parts.length - 1
    parts[lastIdx] = prefixOne(parts[lastIdx])
    return parts.join(':')
  }
  return `${TK_PREFIX}${trimmed}`
}

/**
 * 拼接 className 并自动添加 .tk- 前缀
 *
 * @example
 * cn('button', 'active', false && 'hidden')  // → 'tk-button tk-active'
 * cn('tk-card', 'shadow')                     // → 'tk-card tk-shadow'
 * cn('button', 'hover:bg-blue')               // → 'tk-button hover:tk-bg-blue'
 */
export function cn(...args: (string | false | null | undefined)[]): string {
  return args
    .filter(Boolean)
    .map((cls) => prefixOne(cls as string))
    .join(' ')
}

/**
 * 快捷生成 variant 对应的 className
 *
 * @example
 * cnVar('b')  // → 'tk--b'
 * cnVar('c')  // → 'tk--c'
 */
export function cnVar(variant: 'b' | 'c'): string {
  return `${TK_PREFIX}--${variant}`
}
