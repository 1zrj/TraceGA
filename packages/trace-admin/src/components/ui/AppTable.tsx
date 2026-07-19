// AppTable — 高级表格（基于 antd Table 二次封装）
// 5 状态矩阵 / 分页排序 / 列渲染 / B/C 差异 / request 集成

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Table, Empty, Button, Skeleton, Result } from 'antd'
import { Grid } from 'antd'
import type { SorterResult, FilterValue } from 'antd/es/table/interface'
import { ReloadOutlined } from '@ant-design/icons'
import { cn, cnVar } from '@/utils/cn'
import type { Variant } from '@/tokens'

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export interface AppTableColumn<T> {
  title: string
  dataIndex?: keyof T & string
  key?: string
  width?: number
  fixed?: 'left' | 'right'
  ellipsis?: boolean
  align?: 'left' | 'center' | 'right'
  sorter?: boolean
  render?: (value: unknown, record: T, index: number) => React.ReactNode
}

export interface AppTableRequestParams {
  current: number
  pageSize: number
  sortField?: string
  sortOrder?: 'ascend' | 'descend'
  [key: string]: unknown
}

export interface AppTableRequestResult<T> {
  data: T[]
  success: boolean
  total: number
}

export interface AppTableProps<T extends Record<string, unknown>> {
  /** 模块变体 */
  variant?: Variant
  /** 列配置 */
  columns: AppTableColumn<T>[]
  /** 数据请求函数 */
  request: (
    params: AppTableRequestParams,
  ) => Promise<AppTableRequestResult<T>>
  /** 行唯一键，默认 'id' */
  rowKey?: string | ((record: T) => string)
  /** 空状态引导文案 */
  emptyDescription?: string
  /** 空状态引导操作 */
  emptyAction?: React.ReactNode
  /** 搜索无结果提示 */
  searchEmptyDescription?: string
  /** 是否显示「搜索无结果」空状态（而非「数据为空」） */
  showSearchEmpty?: boolean
  /** 错误重试回调 */
  onRetry?: () => void
  /** 工具栏内容 */
  toolBar?: React.ReactNode
  /** 批量选择配置 */
  rowSelection?: React.ComponentProps<typeof Table>['rowSelection']
  /** 行点击（查看详情） */
  onRowClick?: (record: T) => void
  /** 初始排序 */
  defaultSort?: { field: string; order: 'ascend' | 'descend' }
  /** 外部触发的刷新信号（变化时重新请求） */
  refreshKey?: number
}

// ═══════════════════════════════════════════════════════════════
// 分页配置
// ═══════════════════════════════════════════════════════════════

const PAGINATION_CONFIG = {
  b: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100] as number[],
    showQuickJumper: true,
    showSizeChanger: true,
  },
  c: {
    defaultPageSize: 12,
    pageSizeOptions: [12, 24, 48] as number[],
    showQuickJumper: false,
    showSizeChanger: true,
  },
} as const

// ═══════════════════════════════════════════════════════════════
// 加载骨架屏
// ═══════════════════════════════════════════════════════════════

function SkeletonRows({
  columnCount,
  rowCount = 5,
}: {
  columnCount: number
  rowCount?: number
}) {
  // 确定性宽度模式 — 避免 Math.random() 导致 re-render 不一致
  const widthPattern = ['85%', '70%', '90%', '60%', '75%']
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        <tr key={`skeleton-${i}`}>
          <td colSpan={columnCount} style={{ padding: '10px 16px' }}>
            <Skeleton active paragraph={false} title={{ width: widthPattern[i] ?? '80%' }} />
          </td>
        </tr>
      ))}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// 空状态渲染
// ═══════════════════════════════════════════════════════════════

type EmptyType = 'empty' | 'search-empty' | 'error'

function renderEmptyState(
  type: EmptyType,
  columnCount: number,
  options: {
    emptyDescription?: string
    emptyAction?: React.ReactNode
    searchEmptyDescription?: string
    onRetry?: () => void
  },
) {
  const td = (content: React.ReactNode) => (
    <tr>
      <td colSpan={columnCount}>{content}</td>
    </tr>
  )

  if (type === 'error') {
    return td(
      <Result
        status="error"
        title="加载失败"
        subTitle="数据请求异常，请检查网络后重试"
        extra={
          options.onRetry && (
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={options.onRetry}
            >
              重试
            </Button>
          )
        }
      />,
    )
  }

  if (type === 'search-empty') {
    return td(
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={options.searchEmptyDescription ?? '未找到匹配结果，请调整筛选条件'}
      />,
    )
  }

  return td(
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={options.emptyDescription ?? '暂无数据'}
    >
      {options.emptyAction}
    </Empty>,
  )
}

// ═══════════════════════════════════════════════════════════════
// 列配置持久化（B 端 localStorage）
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY_PREFIX = 'tk-table-columns-'

function getStoredColumns(tableKey: string): string[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tableKey}`)
    if (!raw) return null
    return JSON.parse(raw) as string[]
  } catch {
    return null
  }
}

function storeColumns(tableKey: string, visibleKeys: string[]) {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${tableKey}`,
      JSON.stringify(visibleKeys),
    )
  } catch {
    // localStorage 不可用时静默失败
  }
}

// ═══════════════════════════════════════════════════════════════
// AppTable 组件主体
// ═══════════════════════════════════════════════════════════════

export function AppTable<T extends Record<string, unknown>>({
  variant = 'b',
  columns,
  request: requestFn,
  rowKey = 'id' as keyof T & string,
  emptyDescription,
  emptyAction,
  searchEmptyDescription,
  showSearchEmpty = false,
  onRetry,
  toolBar,
  rowSelection,
  onRowClick,
  defaultSort,
  refreshKey,
}: AppTableProps<T>) {
  const screens = Grid.useBreakpoint()
  const isMobile = variant === 'c' && !screens.md

  // ── 数据状态 ──────────────────────────────────────────────
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [total, setTotal] = useState(0)

  // ── 分页状态 ──────────────────────────────────────────────
  const paginationConfig = PAGINATION_CONFIG[variant]
  const [pagination, setPagination] = useState<{
    current: number
    pageSize: number
  }>({
    current: 1,
    pageSize: paginationConfig.defaultPageSize,
  })

  // ── 排序状态 ──────────────────────────────────────────────
  const [sort, setSort] = useState<{
    field?: string
    order?: 'ascend' | 'descend'
  }>(defaultSort ? { field: defaultSort.field, order: defaultSort.order } : {})

  // ── 列可见性状态（B 端持久化） ─────────────────────────────
  const tableKey = useRef(
    `table-${Math.random().toString(36).slice(2, 8)}`,
  ).current
  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => {
    if (variant === 'b') {
      const stored = getStoredColumns(tableKey)
      if (stored) return stored
    }
    return columns.map((c) => (c.key ?? (c.dataIndex as string) ?? ''))
  })

  const handleColumnToggle = useCallback(
    (key: string) => {
      setVisibleKeys((prev) => {
        const next = prev.includes(key)
          ? prev.filter((k) => k !== key)
          : [...prev, key]
        if (variant === 'b') {
          storeColumns(tableKey, next)
        }
        return next
      })
    },
    [variant, tableKey],
  )

  // ── 请求数据 ──────────────────────────────────────────────
  const fetchRef = useRef(0)

  const fetchData = useCallback(async () => {
    const fetchId = ++fetchRef.current
    setLoading(true)
    setError(null)

    try {
      const result = await requestFn({
        current: pagination.current,
        pageSize: pagination.pageSize,
        sortField: sort.field,
        sortOrder: sort.order,
      })

      // 防止竞态：旧请求的结果忽略
      if (fetchId !== fetchRef.current) return

      if (result.success) {
        setData(result.data)
        setTotal(result.total)
      } else {
        setError(new Error('请求失败'))
      }
    } catch (err) {
      if (fetchId !== fetchRef.current) return
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      if (fetchId !== fetchRef.current) return
      setLoading(false)
    }
  }, [requestFn, pagination, sort])

  // 初始化 + 依赖变化时请求
  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  // ── 排序变化 ──────────────────────────────────────────────
  const handleTableChange = useCallback(
    (
      _pag: unknown,
      _filters: Record<string, FilterValue | null>,
      sorter: SorterResult<T> | SorterResult<T>[],
    ) => {
      const s = Array.isArray(sorter) ? sorter[0] : sorter
      if (s.order) {
        setSort({ field: s.field as string, order: s.order })
      } else {
        setSort({})
      }
      // 排序变化重置第一页
      setPagination((prev) => ({ ...prev, current: 1 }))
    },
    [],
  )

  // ── 分页变化 ──────────────────────────────────────────────
  const handlePaginationChange = useCallback(
    (page: number, pageSize: number) => {
      setPagination({
        current: pageSize !== pagination.pageSize ? 1 : page,
        pageSize,
      })
    },
    [pagination.pageSize],
  )

  // ── 行点击 ────────────────────────────────────────────────
  const handleRow = useCallback(
    (record: T) => ({
      onClick: () => onRowClick?.(record),
      style: { cursor: onRowClick ? 'pointer' : undefined },
    }),
    [onRowClick],
  )

  // ── 可见列 ────────────────────────────────────────────────
  const displayColumns = useMemo(
    () =>
      columns
        .filter((c) => visibleKeys.includes((c.key ?? c.dataIndex ?? '') as string))
        .map((col) => ({
          ...col,
          sorter: col.sorter ?? undefined,
        })),
    [columns, visibleKeys],
  )

  // ── 斑马纹（B 端开启） ─────────────────────────────────────
  const rowClassName = useMemo(() => {
    if (variant !== 'b') return undefined
    return (_record: T, index: number) =>
      index % 2 === 1 ? 'tk-table-row-striped' : ''
  }, [variant])

  // ── 确定当前空状态类型 ────────────────────────────────────
  const emptyType: EmptyType | null = error
    ? 'error'
    : loading
      ? null
      : data.length === 0
        ? showSearchEmpty
          ? 'search-empty'
          : 'empty'
        : null

  // ── 解析 rowKey ───────────────────────────────────────────
  const resolvedRowKey =
    typeof rowKey === 'function'
      ? (record: T) => rowKey(record)
      : (rowKey as string)

  // ═══════════════════════════════════════════════════════════
  // 移动端卡片模式（C 端 < 768px）
  // ═══════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div className={cn('table-cards', cnVar(variant))}>
        {toolBar && (
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
            {toolBar}
          </div>
        )}
        {loading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : emptyType ? (
          renderEmptyState(emptyType, 1, {
            emptyDescription,
            emptyAction,
            searchEmptyDescription,
            onRetry,
          })
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.map((record, i) => (
              <div
                key={String(
                  (() => {
                    if (typeof rowKey === 'function') return rowKey(record)
                    const val = (record as Record<string, unknown>)[rowKey as string]
                    return val != null ? val : i
                  })(),
                )}
                className="tk-card"
                style={{
                  background: '#fff',
                  borderRadius: 'var(--tk-card-radius, 8px)',
                  padding: 'var(--tk-card-padding, 16px)',
                  boxShadow: 'var(--tk-shadow-sm)',
                }}
                onClick={() => onRowClick?.(record)}
              >
                {columns
                  .filter((c) => visibleKeys.includes((c.key ?? c.dataIndex ?? '') as string))
                  .map((col) => {
                    const val = col.dataIndex ? record[col.dataIndex] : undefined
                    return (
                      <div
                        key={col.key ?? (col.dataIndex as string)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 0',
                          fontSize: 14,
                        }}
                      >
                        <span style={{ color: 'var(--tk-color-text-tertiary)' }}>
                          {col.title}
                        </span>
                        <span style={{ fontWeight: 500 }}>
                          {col.render
                            ? col.render(val, record, i)
                            : (val as React.ReactNode) ?? '-'}
                        </span>
                      </div>
                    )
                  })}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // 桌面端表格模式
  // ═══════════════════════════════════════════════════════════
  return (
    <div className={cn('table-wrapper', cnVar(variant))}>
      {/* 工具栏 */}
      {toolBar && (
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div />
          <div style={{ display: 'flex', gap: 8 }}>{toolBar}</div>
        </div>
      )}

      {/* B 端列配置 */}
      {variant === 'b' && columns.length > 0 && (
        <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {columns.map((col) => {
            const key = (col.key ?? col.dataIndex ?? '') as string
            const isVisible = visibleKeys.includes(key)
            return (
              <Button
                key={key}
                size="small"
                type={isVisible ? 'primary' : 'default'}
                onClick={() => handleColumnToggle(key)}
              >
                {col.title}
              </Button>
            )
          })}
        </div>
      )}

      {/* 表格 */}
      <Table<T>
        rowKey={resolvedRowKey}
        columns={displayColumns as React.ComponentProps<typeof Table>['columns']}
        dataSource={error ? [] : data}
        loading={false}
        rowClassName={rowClassName}
        onRow={handleRow}
        onChange={handleTableChange}
        rowSelection={rowSelection}
        pagination={
          emptyType
            ? false
            : {
                current: pagination.current,
                pageSize: pagination.pageSize,
                total,
                pageSizeOptions: paginationConfig.pageSizeOptions,
                showQuickJumper: paginationConfig.showQuickJumper,
                showSizeChanger: paginationConfig.showSizeChanger,
                showTotal: (t: number) => `共 ${t} 条`,
                onChange: handlePaginationChange,
              }
        }
        locale={{
          emptyText: emptyType
            ? renderEmptyState(emptyType, displayColumns.length, {
                emptyDescription,
                emptyAction,
                searchEmptyDescription,
                onRetry,
              })
            : undefined,
        }}
        components={
          loading
            ? {
                body: {
                  wrapper: ({
                    children: _children,
                    ...rest
                  }: React.HTMLAttributes<HTMLTableSectionElement>) => (
                    <tbody {...rest}>
                      <SkeletonRows columnCount={displayColumns.length} />
                    </tbody>
                  ),
                },
              }
            : undefined
        }
      />
    </div>
  )
}
