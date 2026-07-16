// useVariant — 读取全局 B/C variant 配置
// 组件树任意位置调用，默认返回 'b'


import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Variant } from '@/tokens'

// ─── Context ───────────────────────────────────────────────────

interface VariantContextValue {
  variant: Variant
}

const VariantContext = createContext<VariantContextValue>({
  variant: 'b',
})

// Provider 

interface VariantProviderProps {
  variant: Variant
  children: ReactNode
}

/** 在组件树顶层包裹，注入当前 variant */
export function VariantProvider({ variant, children }: VariantProviderProps) {
  const value = useMemo(() => ({ variant }), [variant])
  return (
    <VariantContext.Provider value={value}>{children}</VariantContext.Provider>
  )
}

// Hooks 

/** 获取当前 variant — 'b' | 'c'，默认 'b' */
export function useVariant(): Variant {
  const { variant } = useContext(VariantContext)
  return variant
}

/** 便捷判断：当前是否为 B 端 */
export function useIsB(): boolean {
  return useVariant() === 'b'
}

/** 便捷判断：当前是否为 C 端 */
export function useIsC(): boolean {
  return useVariant() === 'c'
}
