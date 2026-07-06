import { useState, useCallback, useMemo } from 'react'

export function useFilter<T extends Record<string, unknown>>(initialFilters: T = {} as T) {
  const [filters, setFilters] = useState<T>({ ...initialFilters })

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(
      (value) => value !== undefined && value !== null && value !== '',
    )
  }, [filters])

  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateFilters = useCallback((newFilters: Partial<T>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
  }, [])

  const clearFilter = useCallback(<K extends keyof T>(key: K) => {
    setFilters((prev) => {
      const newFilters = { ...prev }
      delete newFilters[key]
      return newFilters
    })
  }, [])

  const clearAllFilters = useCallback(() => {
    setFilters({} as T)
  }, [])

  const resetFilters = useCallback(() => {
    setFilters({ ...initialFilters })
  }, [initialFilters])

  return {
    filters,
    hasActiveFilters,
    setFilter,
    updateFilters,
    clearFilter,
    clearAllFilters,
    resetFilters,
  }
}