import React, { useEffect, useState } from 'react'
import { Spin } from 'antd'
import { getSummary } from '@/api'
import type { AnalyticsOverview } from '@/types'
import { StatCard } from '@/components'

export const HomePage: React.FC = () => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const now = new Date().toISOString()
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const res = await getSummary({ startTime: weekAgo, endTime: now })
        setOverview(res)
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
        <StatCard title="页面浏览量(PV)" value={overview?.pv || 0} change="+12.5%" />
        <StatCard title="独立访客数(UV)" value={overview?.uv || 0} change="+8.3%" />
        <StatCard title="人均访问次数" value={overview?.rate || '0'} change="+3.7%" />
      </div>
    </div>
  )
}