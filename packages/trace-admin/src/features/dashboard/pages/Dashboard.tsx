import React, { useEffect, useState } from 'react'
import { Spin, Row, Col, Card } from 'antd'
import ReactECharts from 'echarts-for-react'
import { getSummary, getTrend } from '@/api'
import type { AnalyticsOverview, TrendData } from '@/types'
import { StatCard } from '@/components'
import { AiAssistantPanel } from '../components/AiAssistantPanel'

export const Dashboard: React.FC = () => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const now = new Date().toISOString()
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

        const [overviewRes, trendRes] = await Promise.all([
          getSummary({ startTime: weekAgo, endTime: now }),
          getTrend({ startTime: weekAgo, endTime: now, interval: 'day' }),
        ])
        setOverview(overviewRes)
        setTrendData(trendRes)
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
      data: trendData.map((item) => item.time),
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'PV',
        type: 'bar',
        data: trendData.map((item) => item.pv),
        itemStyle: {
          color: '#3b82f6',
        },
      },
      {
        name: 'UV',
        type: 'line',
        data: trendData.map((item) => item.uv),
        itemStyle: {
          color: '#10b981',
        },
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
          <StatCard title="页面浏览量(PV)" value={overview?.pv || 0} change="+12.5%" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="独立访客数(UV)" value={overview?.uv || 0} change="+8.3%" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="人均访问次数" value={overview?.rate || '0'} change="+3.7%" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="统计周期" value={overview ? `${overview.startTime.slice(0, 10)} ~ ${overview.endTime.slice(0, 10)}` : '-'} />
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={24}>
          <Card title="PV/UV 趋势" style={{ height: '100%' }}>
            <ReactECharts option={trendOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      <AiAssistantPanel />
    </div>
  )
}