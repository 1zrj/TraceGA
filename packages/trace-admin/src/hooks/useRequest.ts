// ═══════════════════════════════════════════════════════════════
// useRequest — 通用异步请求 Hook
// 支持自动执行 / 手动触发 / 回调 / 错误 Toast / AbortController
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react'
import { notifyError } from '@/components/feedback/notification'

// ─── 类型 ──────────────────────────────────────────────────────

interface UseRequestState<T> {
  loading: boolean
  error: Error | null
  data: T | null
}

type RequestFunction<T, P extends unknown[] = unknown[]> = (
  ...args: P
) => Promise<T>

interface UseRequestOptions<T, P extends unknown[]> {
  /** 是否手动触发（默认 false = 组件挂载时自动执行） */
  manual?: boolean
  /** 自动执行时的参数 */
  defaultArgs?: P
  /** 成功回调 */
  onSuccess?: (data: T, args: P) => void
  /** 失败回调 */
  onError?: (error: Error, args: P) => void
  /** 失败时自动弹出错误 Toast（默认 true） */
  errorToast?: boolean
  /** 自动执行依赖（类似 useEffect deps），仅 manual=false 时生效 */
  refreshDeps?: unknown[]
}

// ─── Hook ──────────────────────────────────────────────────────

export function useRequest<T, P extends unknown[] = unknown[]>(
  requestFn: RequestFunction<T, P>,
  options: UseRequestOptions<T, P> = {},
) {
  const {
    manual = false,
    defaultArgs,
    onSuccess,
    onError,
    errorToast = true,
    refreshDeps = [],
  } = options

  const [state, setState] = useState<UseRequestState<T>>({
    loading: !manual,
    error: null,
    data: null,
  })

  // 用于取消未完成请求
  const abortRef = useRef<AbortController | null>(null)
  // 追踪组件是否已卸载
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const run = useCallback(
    async (...args: P): Promise<T | undefined> => {
      // 取消上一个未完成的请求
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const data = await requestFn(...args)
        if (!mountedRef.current) return undefined

        setState({ loading: false, error: null, data })
        onSuccess?.(data, args)
        return data
      } catch (err) {
        // 如果是被取消的请求，忽略
        if (err instanceof DOMException && err.name === 'AbortError') {
          return undefined
        }

        if (!mountedRef.current) return undefined

        const error = err instanceof Error ? err : new Error(String(err))
        setState({ loading: false, error, data: null })

        if (errorToast) {
          notifyError(error.message)
        }
        onError?.(error, args)
        throw error
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requestFn, onSuccess, onError, errorToast],
  )

  /** 用上次参数重新请求（data 非 null 时可用） */
  const refresh = useCallback(() => {
    if (defaultArgs) {
      return run(...defaultArgs)
    }
    return Promise.resolve(undefined)
  }, [run, defaultArgs])

  /** 手动设置 data（乐观更新） */
  const mutate = useCallback((newData: T | ((prev: T | null) => T)) => {
    setState((prev) => ({
      ...prev,
      data:
        typeof newData === 'function'
          ? (newData as (prev: T | null) => T)(prev.data)
          : newData,
    }))
  }, [])

  /** 重置状态 */
  const reset = useCallback(() => {
    setState({ loading: false, error: null, data: null })
    abortRef.current?.abort()
  }, [])

  // ── 自动执行 ──────────────────────────────────────────────
  useEffect(() => {
    if (!manual) {
      run(...((defaultArgs ?? []) as unknown as P))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual, ...refreshDeps])

  return {
    ...state,
    run,
    refresh,
    mutate,
    reset,
  }
}
