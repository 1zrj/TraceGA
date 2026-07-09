import React, { useEffect, useState } from 'react'
import { Spin, Row, Col, Card } from 'antd'
import ReactECharts from 'echarts-for-react'
import { getOverview, getEventTrend, getTopEvents } from '@/api'
import type { AnalyticsOverview, EventTrend, TopEvent } from '@/types'
import { StatCard } from '@/components'

export const Dashboard: React.FC = () => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [eventTrend, setEventTrend] = useState<EventTrend[]>([])
  const [topEvents, setTopEvents] = useState<TopEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewRes, trendRes, topRes] = await Promise.all([
          getOverview({}),
          getEventTrend({ interval: 'day' }),
          getTopEvents({ limit: 5 }),
        ])
        setOverview(overviewRes)
        setEventTrend(trendRes)
        setTopEvents(topRes)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <Spin size="large" />
      </div>
    )
  }

  const trendOption = {
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      type: 'category',
      data: eventTrend.map((item) => item.time),
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: '事件数',
        type: 'bar',
        data: eventTrend.map((item) => item.count),
        itemStyle: {
          color: '#3b82f6',
        },
      },
    ],
  }

  const topEventsOption = {
    tooltip: {
      trigger: 'item',
    },
    series: [
      {
        name: '热门事件',
        type: 'pie',
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
            color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index],
          },
        })),
      },
    ],
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: '#1e293b', marginBottom: 24 }}>
        数据看板
      </h1>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="总事件数" value={overview?.totalEvents || 0} change="+12.5%" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="总用户数" value={overview?.totalUsers || 0} change="+8.3%" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="平均会话时长" value={`${overview?.avgSessionDuration || 0}s`} change="-2.1%" changeType="negative" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="转化率" value={`${overview?.conversionRate || 0}%`} change="+3.7%" />
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="事件趋势" style={{ height: '100%' }}>
            <ReactECharts option={trendOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="热门事件" style={{ height: '100%' }}>
            <ReactECharts option={topEventsOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}