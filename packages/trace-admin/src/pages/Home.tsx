import React, { useEffect, useState } from 'react'
import { Spin } from 'antd'
import { getOverview } from '@/api'
import type { AnalyticsOverview } from '@/types'
import { StatCard } from '@/components'

export const HomePage: React.FC = () => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getOverview({})
        setOverview(res.data.data)
      } catch (error) {
        console.error('Failed to fetch overview:', error)
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

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>
        欢迎使用 TraceGA
      </h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 32 }}>行为数据分析管理平台</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24 }}>
        <StatCard title="总事件数" value={overview?.totalEvents || 0} change="+12.5%" />
        <StatCard title="总用户数" value={overview?.totalUsers || 0} change="+8.3%" />
        <StatCard title="平均会话时长" value={`${overview?.avgSessionDuration || 0}s`} change="-2.1%" changeType="negative" />
        <StatCard title="转化率" value={`${overview?.conversionRate || 0}%`} change="+3.7%" />
      </div>
    </div>
  )
}