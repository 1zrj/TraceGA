import { useDebounce } from './useDebounce'

export function useChartData<T>(data: T[], delay: number = 500) {
  const debouncedData = useDebounce(data, delay)
  return debouncedData
}