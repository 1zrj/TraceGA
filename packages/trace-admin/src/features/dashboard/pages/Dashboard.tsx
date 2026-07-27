import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
// Space: 筛选栏按钮组自动换行；Spin: 刷新遮罩 loading 指示器
import { Card, Row, Col, Skeleton, Space, Spin, Tag, Button, Empty, Modal } from 'antd'
import type { Dayjs } from 'dayjs'
import { EditOutlined, CheckOutlined, ReloadOutlined, ExportOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import type { Layout, ResponsiveLayouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import {
  getOverview,
  getEventTrend,
  getTopEvents,
  getEventTypeTrend,
  getErrorEvents,
  getErrorTrend,
} from '@/api'
import type {
  AnalyticsOverview,
  EventTrend,
  TopEvent,
  EventTypeTrendItem,
  ErrorEventItem,
} from '@/types'
import { StatCard } from '@/components'
// Phase 3 封装组件：Button（B 端默认尺寸圆角）、RangePicker（C 端大圆角 + 快捷预设）
import { Button as AppButton } from '@/components/ui/Button'
import { useAppStore } from '@/store'
import { RangePicker } from '@/components/ui/DatePicker'
// Design Token 图表色板：统一所有图表颜色来源
import { dataPalette10, sequentialBlue } from '@/tokens'
import './Dashboard.css'

const ResponsiveGridLayout = WidthProvider(Responsive)

const STORAGE_KEY = 'tracega-dashboard-layout'

// 默认布局配置
const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: 'stats', x: 0, y: 0, w: 12, h: 2, static: true },
    { i: 'error-events', x: 0, y: 2, w: 12, h: 6.5, minW: 4, minH: 4 },
    { i: 'trend', x: 0, y: 13, w: 6, h: 8, minW: 4, minH: 4 },
    { i: 'pie', x: 6, y: 13, w: 6, h: 8, minW: 3, minH: 4 },
    { i: 'type-trend', x: 0, y: 21, w: 7, h: 9, minW: 4, minH: 4 },
    { i: 'funnel', x: 7, y: 21, w: 5, h: 9, minW: 3, minH: 4 },
  ],
}

// 从 localStorage 恢复布局（仅在组件外部使用）
const loadLayoutFromStorage = (): ResponsiveLayouts => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved) as ResponsiveLayouts
    }
  } catch {
    // ignore
  }
  return DEFAULT_LAYOUTS
}

// 持久化布局到 localStorage
const persistLayout = (layouts: ResponsiveLayouts): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts))
  } catch {
    // ignore
  }
}

export const Dashboard: React.FC = () => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [eventTrend, setEventTrend] = useState<EventTrend[]>([])
  const [topEvents, setTopEvents] = useState<TopEvent[]>([])
  const [eventTypeTrend, setEventTypeTrend] = useState<EventTypeTrendItem[]>([])
  const [errorEvents, setErrorEvents] = useState<ErrorEventItem[]>([])
  const [errorLoading, setErrorLoading] = useState(false)
  const [errorTrend, setErrorTrend] = useState<EventTrend[]>([])
  const [loading, setLoading] = useState(true)
  // 日期切换时的刷新态：与首次加载分离，刷新时 StatCard 保留旧值不闪回骨架
  const [refreshing, setRefreshing] = useState(false)
  // 仅首次加载失败时设置，刷新失败时保留旧数据
  const [error, setError] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  // 日期范围筛选：C 端 RangePicker 返回 [Dayjs, Dayjs] | null，传给 API 时转 YYYY-MM-DD
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [chartKey, setChartKey] = useState(0)
  // 错误详情弹窗
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedError, setSelectedError] = useState<ErrorEventItem | null>(null)
  // 标记是否已完成首次加载：true=首次走骨架屏，false=后续走遮罩
  const isInitialLoad = useRef(true)

  // 同步 dateRange 到全局 store（供 AI 分析感知筛选范围）
  const setDashboardDateRange = useAppStore((s) => s.setDashboardDateRange)
  useEffect(() => {
    setDashboardDateRange(
      dateRange
        ? {
            startTime: dateRange[0].format('YYYY-MM-DD'),
            endTime: dateRange[1].format('YYYY-MM-DD'),
          }
        : null,
    )
  }, [dateRange, setDashboardDateRange])

  // 从 localStorage 恢复布局，resetKey 变化时重新加载
  const initialLayout = useMemo(() => loadLayoutFromStorage(), [resetKey])

  // isRefresh=true：日期切换/手动刷新时调用，StatCard 保留旧值、图表区半透明遮罩
  // isRefresh=false：首次加载时调用，走骨架屏
  const fetchDashboardData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      try {
        const params = {
          startTime: dateRange?.[0]?.format('YYYY-MM-DD'),
          endTime: dateRange?.[1]?.format('YYYY-MM-DD'),
        }
        const [overviewRes, trendRes, topRes, typeTrendRes] = await Promise.all([
          getOverview(params),
          getEventTrend({ interval: 'day', ...params }),
          getTopEvents({ limit: 5, ...params }),
          getEventTypeTrend(params),
        ])
        setOverview(overviewRes)
        setEventTrend(trendRes)
        setTopEvents(topRes)
        setEventTypeTrend(typeTrendRes)
        isInitialLoad.current = false
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
        // 仅首次加载失败时显示错误页，刷新失败时保留旧数据 + notify 提示
        if (!isRefresh) {
          setError('数据加载失败，请检查网络后重试')
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [dateRange],
  )

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  /** 获取错误事件数据 */
  const fetchErrorEvents = useCallback(async () => {
    setErrorLoading(true)
    try {
      const [eventsRes, trendRes] = await Promise.all([getErrorEvents({}), getErrorTrend({})])
      setErrorEvents(eventsRes)
      setErrorTrend(trendRes)
    } catch (error) {
      console.error('Failed to fetch error events:', error)
      setErrorEvents([])
      setErrorTrend([])
    } finally {
      setErrorLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchErrorEvents()
  }, [fetchErrorEvents])

  /** 查看错误详情 */
  const handleViewErrorDetail = useCallback((item: ErrorEventItem) => {
    setSelectedError(item)
    setDetailModalVisible(true)
  }, [])

  /** 忽略错误 */
  const handleIgnoreError = useCallback((item: ErrorEventItem) => {
    setErrorEvents((prev) =>
      prev.map((e) => (e.id === item.id ? { ...e, status: 'ignored' as const } : e)),
    )
  }, [])

  // 数据加载完成后，递增 chartKey 强制图表组件重新挂载，
  // 确保 ECharts 在 react-grid-layout 容器尺寸完全就位后初始化
  useEffect(() => {
    // 数据加载中或刷新中均不触发 chartKey 递增
    if (!loading && !refreshing) {
      const timer = setTimeout(() => setChartKey((k) => k + 1), 150)
      return () => clearTimeout(timer)
    }
  }, [loading, refreshing])

  // 布局变更时保存
  const handleLayoutChange = useCallback((_layout: Layout, layouts: ResponsiveLayouts) => {
    persistLayout(layouts)
  }, [])

  // 恢复默认布局
  const handleResetLayout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setResetKey((k) => k + 1)
  }, [])

  // 漏斗图数据：从 topEvents 按用户行为流程排序推导（Hook 必须在条件返回前）
  const funnelOption = useMemo(() => {
    const funnelOrder = ['用户注册', '用户登录', '商品浏览', '添加购物车', '订单完成']
    const funnelData = funnelOrder.map((name) => {
      const found = topEvents.find((e) => e.name === name)
      return { name, value: found?.count ?? 0 }
    })
    return {
      tooltip: { trigger: 'item' as const },
      series: [
        {
          name: '转化漏斗',
          type: 'funnel' as const,
          left: '10%',
          right: '10%',
          top: 20,
          bottom: 20,
          width: '80%',
          min: 0,
          max: Math.max(...funnelData.map((d) => d.value), 1),
          sort: 'none',
          gap: 2,
          label: {
            show: true,
            position: 'inside' as const,
            formatter: '{b}',
            fontSize: 13,
          },
          labelLine: { show: false },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 2,
          },
          emphasis: {
            label: { fontSize: 16, fontWeight: 'bold' },
          },
          data: funnelData.map((item, index) => ({
            ...item,
            itemStyle: {
              // 漏斗图：10 色分类色板循环取色
              color: dataPalette10[index % dataPalette10.length],
            },
          })),
        },
      ],
    }
  }, [topEvents])

  // 事件类型趋势折线图：将 EventTypeTrendItem[] 按 type 分组为多系列平滑折线，叠加错误事件总和曲线
  const typeTrendOption = useMemo(() => {
    const times = [...new Set(eventTypeTrend.map((d) => d.time))]
    const types = [...new Set(eventTypeTrend.map((d) => d.type))]
    // 折线图：10 色分类色板按 type 索引取色
    const colors = dataPalette10 as readonly string[]
    const series = types.map((type, idx) => ({
      name: type,
      type: 'line' as const,
      smooth: false,
      symbol: 'circle',
      symbolSize: 8,
      emphasis: { focus: 'series' as const },
      itemStyle: { color: colors[idx % colors.length] },
      lineStyle: { width: 2.5 },
      // 数据点标签显示数值
      label: {
        show: true,
        position: 'top' as const,
        fontSize: 11,
        color: colors[idx % colors.length],
      },
      data: times.map((t) => {
        const item = eventTypeTrend.find((d) => d.time === t && d.type === type)
        return item?.count ?? 0
      }),
    }))

    // 追加错误事件总和曲线（使用虚线 + 菱形标记以明显区分）
    const errorTrendData = times.map((t) => {
      const item = errorTrend.find((d) => d.time === t)
      return item?.count ?? 0
    })
    series.push({
      name: '错误事件总和',
      type: 'line' as const,
      smooth: false,
      symbol: 'diamond',
      symbolSize: 10,
      emphasis: { focus: 'series' as const },
      itemStyle: { color: '#ff0000ff' },
      lineStyle: { width: 3 },
      label: {
        show: true,
        position: 'top' as const,
        fontSize: 11,
        color: '#ff6b6b',
      },
      data: errorTrendData,
    })
    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'cross' as const },
      },
      legend: {
        top: 0,
        icon: 'roundRect',
        itemWidth: 14,
        itemHeight: 4,
      },
      grid: { left: '3%', right: '7%', bottom: '12%', top: '7%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: times,
        name: '日期',
        nameTextStyle: { fontWeight: 'bold' },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value' as const,
        name: '事件数量',
        nameTextStyle: { fontWeight: 'bold' },
      },
      series,
    }
  }, [eventTypeTrend, errorTrend])

  // 首次加载态：统计卡骨架屏 + 图表区域 Skeleton 占位
  if (loading) {
    return (
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--tk-color-text)', margin: 0 }}>
            数据看板
          </h1>
        </div>
        <Row gutter={16}>
          {[0, 1, 2, 3].map((i) => (
            <Col key={i} xs={24} sm={12} lg={6}>
              <StatCard title="加载中..." value="—" loading />
            </Col>
          ))}
        </Row>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}
        >
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </div>
    )
  }

  // 首次加载失败：错误卡片 + 重试按钮
  if (error) {
    return (
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--tk-color-text)', margin: 0 }}>
            数据看板
          </h1>
        </div>
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: '#64748b', marginBottom: 16 }}>{error}</p>
            <AppButton
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => fetchDashboardData()}
            >
              重试
            </AppButton>
          </div>
        </Card>
      </div>
    )
  }

  const trendOption = {
    tooltip: {
      trigger: 'axis' as const,
    },
    legend: {
      top: 0,
      icon: 'roundRect',
      itemWidth: 14,
      itemHeight: 4,
      selected: { 错误事件数: false },
    },
    xAxis: {
      type: 'category' as const,
      data: eventTrend.map((item) => item.time),
    },
    yAxis: {
      type: 'value' as const,
    },
    series: [
      {
        name: '事件数',
        type: 'bar' as const,
        data: eventTrend.map((item) => item.count),
        itemStyle: {
          // 柱状图：顺序蓝色板第 4 阶（主色）
          color: sequentialBlue[3],
        },
      },
      {
        name: '错误事件数',
        type: 'bar' as const,
        data: errorTrend.map((item) => item.count),
        itemStyle: {
          color: '#ef4444',
        },
      },
    ],
  }

  const topEventsOption = {
    tooltip: {
      trigger: 'item' as const,
    },
    legend: {
      orient: 'vertical' as const,
      right: 0,
      top: 'center',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
    },
    series: [
      {
        name: '热门事件',
        type: 'pie' as const,
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}: {c}',
        },
        data: topEvents.map((item, index) => ({
          value: item.count,
          name: item.name,
          itemStyle: {
            // 饼图：10 色分类色板循环取色
            color: dataPalette10[index % dataPalette10.length],
          },
        })),
      },
    ],
  }

  // 拖拽手柄组件（仅在编辑模式下显示）
  const dragHandle = isEditMode ? <span className="drag-handle">⋮⋮</span> : null

  return (
    <>
      <div className={isEditMode ? 'dashboard-edit-mode' : undefined}>
        {/* 标题栏 + C 端筛选栏：日期范围 / 刷新 / 导出 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--tk-color-text)', margin: 0 }}>
            数据看板
          </h1>
          <Space size="middle" wrap>
            {/* 日期范围选择：C 端 variant 大圆角 + 快捷预设 */}
            <RangePicker
              variant="c"
              value={dateRange ?? undefined}
              onChange={(dates: [Dayjs, Dayjs] | null) => setDateRange(dates)}
              style={{ width: 260 }}
            />
            {/* 刷新按钮：isRefresh=true 时 StatCard 保留旧值不闪回，图表区半透明遮罩 */}
            <AppButton icon={<ReloadOutlined />} onClick={() => fetchDashboardData(true)}>
              刷新
            </AppButton>
            {/* 导出按钮（C 端风格） */}
            <AppButton icon={<ExportOutlined />}>导出</AppButton>
            <AppButton icon={<ReloadOutlined />} onClick={handleResetLayout}>
              恢复默认布局
            </AppButton>
            <AppButton
              type={isEditMode ? 'primary' : 'default'}
              icon={isEditMode ? <CheckOutlined /> : <EditOutlined />}
              onClick={() => setIsEditMode(!isEditMode)}
            >
              {isEditMode ? '完成编辑' : '编辑布局'}
            </AppButton>
          </Space>
        </div>

        {/* 日期切换刷新提示条：仅 refreshing=true 时显示 */}
        {refreshing && (
          <div style={{ textAlign: 'center', marginBottom: 8, color: '#64748b', fontSize: 13 }}>
            <Spin size="small" /> 数据更新中...
          </div>
        )}

        {/* 图表区容器：refreshing 时叠加半透明遮罩 + Spin，StatCard 在上方保留旧值不受影响 */}
        <div style={{ position: 'relative' }}>
          {refreshing && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 10,
                background: 'rgba(255,255,255,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                pointerEvents: 'none',
              }}
            >
              <Spin size="large" />
            </div>
          )}

          {/* 可拖拽缩放网格 */}
          <ResponsiveGridLayout
            className="layout"
            layouts={initialLayout}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={50}
            margin={[16, 16]}
            isDraggable={isEditMode}
            isResizable={isEditMode}
            draggableHandle=".drag-handle"
            draggableCancel="button,input,select,.ant-btn,.ant-select,.ant-picker,canvas"
            onLayoutChange={handleLayoutChange}
          >
            {/* 统计卡片区域 - static: 不可拖拽缩放的固定区域 */}
            <div key="stats" style={{ background: 'transparent' }}>
              <Row gutter={16}>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard title="总事件数" value={overview?.totalEvents || 0} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard title="总用户数" value={overview?.totalUsers || 0} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard title="平均会话时长" value={`${overview?.avgSessionDuration || 0}s`} />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard
                    title="转化率"
                    value={`${((overview?.conversionRate ?? 0) * 100).toFixed(2)}%`}
                  />
                </Col>
              </Row>
            </div>

            {/* 错误事件列表 */}
            <div key="error-events" style={{ height: '100%' }}>
              <Card
                title={
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>错误事件</span>
                    {dragHandle}
                  </div>
                }
                styles={{
                  body: {
                    height: 'calc(100% - 57px)',
                    padding: 16,
                    overflow: 'auto',
                  },
                }}
                style={{ height: '100%', overflow: 'hidden' }}
              >
                {errorLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Spin />
                  </div>
                ) : errorEvents.length === 0 ? (
                  <div
                    style={{
                      minHeight: 200,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Empty description="暂无错误事件" />
                  </div>
                ) : (
                  <div className="error-event-list">
                    {errorEvents.map((item) => {
                      const statusColor =
                        item.status === 'active'
                          ? 'red'
                          : item.status === 'resolved'
                            ? 'green'
                            : 'default'
                      return (
                        <div key={item.id} className="error-event-item">
                          <div className="error-event-header">
                            <span className="error-event-type">{item.type}</span>
                            <Tag color={statusColor}>{item.status}</Tag>
                            {item.duration !== undefined && (
                              <span className="error-event-duration">
                                {item.duration >= 1000
                                  ? `${(item.duration / 1000).toFixed(1)}s`
                                  : `${item.duration}ms`}
                              </span>
                            )}
                          </div>
                          <div className="error-event-message">
                            <span className="error-event-name">{item.errorName}: </span>
                            {item.message}
                          </div>
                          <div className="error-event-footer">
                            <span className="error-event-time">
                              {item.occurredAt}
                              {item.url && <span className="error-event-url"> · {item.url}</span>}
                            </span>
                            <div className="error-event-actions">
                              <Button
                                type="link"
                                size="small"
                                onClick={() => handleViewErrorDetail(item)}
                              >
                                查看详情
                              </Button>
                              <Button
                                type="link"
                                size="small"
                                onClick={() => handleIgnoreError(item)}
                                disabled={item.status === 'ignored'}
                              >
                                忽略
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* 事件趋势图 */}
            <div key="trend" style={{ height: '100%' }}>
              <Card
                title={
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>每日总事件</span>
                    {dragHandle}
                  </div>
                }
                styles={{ body: { height: 'calc(100% - 57px)', padding: 16 } }}
                style={{ height: '100%', overflow: 'hidden' }}
              >
                <ReactECharts
                  key={`trend-${chartKey}`}
                  option={trendOption}
                  style={{ height: '100%', width: '100%' }}
                />
              </Card>
            </div>

            {/* 热门事件饼图 */}
            <div key="pie" style={{ height: '100%' }}>
              <Card
                title={
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>热门事件</span>
                    {dragHandle}
                  </div>
                }
                styles={{ body: { height: 'calc(100% - 57px)', padding: 16 } }}
                style={{ height: '100%', overflow: 'hidden' }}
              >
                <ReactECharts
                  key={`pie-${chartKey}`}
                  option={topEventsOption}
                  style={{ height: '100%', width: '100%' }}
                />
              </Card>
            </div>

            {/* 事件类型趋势堆叠柱状图 */}
            <div key="type-trend" style={{ height: '100%' }}>
              <Card
                title={
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>事件类型趋势对比</span>
                    {dragHandle}
                  </div>
                }
                styles={{ body: { height: 'calc(100% - 57px)', padding: 16 } }}
                style={{ height: '100%', overflow: 'hidden' }}
              >
                <ReactECharts
                  key={`type-trend-${chartKey}`}
                  option={typeTrendOption}
                  style={{ height: '100%', width: '100%' }}
                />
              </Card>
            </div>

            {/* 用户行为漏斗图 */}
            <div key="funnel" style={{ height: '100%' }}>
              <Card
                title={
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>用户行为漏斗</span>
                    {dragHandle}
                  </div>
                }
                styles={{ body: { height: 'calc(100% - 57px)', padding: 16 } }}
                style={{ height: '100%', overflow: 'hidden' }}
              >
                <ReactECharts
                  key={`funnel-${chartKey}`}
                  option={funnelOption}
                  style={{ height: '100%', width: '100%' }}
                />
              </Card>
            </div>
          </ResponsiveGridLayout>
        </div>
        {/* position: relative 图表遮罩容器结束 */}
      </div>

      {/* 错误详情弹窗 */}
      <Modal
        title="错误详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={640}
      >
        {selectedError && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>错误名称</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#ef4444' }}>
                {selectedError.errorName}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>错误消息</div>
              <div
                style={{
                  fontSize: 13,
                  color: '#334155',
                  background: '#f8fafc',
                  padding: 12,
                  borderRadius: 6,
                  fontFamily: 'monospace',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {selectedError.message || '无'}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>错误类型</div>
                <Tag>{selectedError.type}</Tag>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>状态</div>
                <Tag color={selectedError.status === 'active' ? 'red' : 'default'}>
                  {selectedError.status}
                </Tag>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>耗时</div>
                <div style={{ fontSize: 14 }}>
                  {selectedError.duration !== undefined
                    ? selectedError.duration >= 1000
                      ? `${(selectedError.duration / 1000).toFixed(1)}s`
                      : `${selectedError.duration}ms`
                    : '-'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>发生时间</div>
                <div style={{ fontSize: 14 }}>{selectedError.occurredAt}</div>
              </div>
            </div>
            {selectedError.url && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>页面 URL</div>
                <div
                  style={{
                    fontSize: 13,
                    color: '#3b82f6',
                    wordBreak: 'break-all',
                  }}
                >
                  {selectedError.url}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
