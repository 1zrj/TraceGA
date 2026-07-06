import { useState, useCallback } from 'react'

interface UseRequestState<T> {
  loading: boolean
  error: Error | null
  data: T | null
}

type RequestFunction<T> = (...args: unknown[]) => Promise<T>

export function useRequest<T>(requestFn: RequestFunction<T>) {
  const [state, setState] = useState<UseRequestState<T>>({
    loading: false,
    error: null,
    data: null,
  })

  const run = useCallback(
    async (...args: unknown[]) => {
      setState((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const data = await requestFn(...args)
        setState((prev) => ({ ...prev, loading: false, data }))
        return data
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }))
        throw error
      }
    },
    [requestFn],
  )

  const reset = useCallback(() => {
    setState({ loading: false, error: null, data: null })
  }, [])

  return {
    ...state,
    run,
    reset,
  }
}