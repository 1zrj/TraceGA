import { useState, useCallback } from 'react'

interface PaginationOptions {
  defaultPage?: number
  defaultPageSize?: number
  pageSizeOptions?: number[]
}

export function usePagination(options: PaginationOptions = {}) {
  const {
    defaultPage = 1,
    defaultPageSize = 10,
    pageSizeOptions = [10, 20, 50, 100],
  } = options

  const [currentPage, setCurrentPage] = useState(defaultPage)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [total, setTotal] = useState(0)

  const totalPages = Math.ceil(total / pageSize)

  const paginationParams = {
    page: currentPage,
    pageSize,
  }

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }, [])

  const resetPagination = useCallback(() => {
    setCurrentPage(defaultPage)
    setPageSize(defaultPageSize)
    setTotal(0)
  }, [defaultPage, defaultPageSize])

  return {
    currentPage,
    pageSize,
    total,
    setTotal,
    totalPages,
    paginationParams,
    pageSizeOptions,
    handlePageChange,
    handlePageSizeChange,
    resetPagination,
  }
}