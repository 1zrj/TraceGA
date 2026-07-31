import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Typography } from 'antd'
import {
  DashboardOutlined,
  ThunderboltOutlined,
  BellOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getSummary } from '@/api'
import type { AnalysisSummary } from '@/types'
import { StatCard } from '@/components'

const { Text } = Typography

/** 数字格式化：12345 → "12,345" */
const formatNumber = (num: number): string => num.toLocaleString()

/** 快捷入口配置 */
const quickLinks = [
  { key: '/dashboard', label: '数据看板', icon: <DashboardOutlined />, color: '#3b82f6' },
  { key: '/event-management', label: '事件管理', icon: <ThunderboltOutlined />, color: '#10b981' },
  { key: '/alarm', label: '告警管理', icon: <BellOutlined />, color: '#f59e0b' },
  { key: '/ai', label: 'AI 分析', icon: <RobotOutlined />, color: '#8b5cf6' },
]

/** 统计指标卡片颜色 */
const cardAccents = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']

export const HomePage: React.FC = () => {
  const [overview, setOverview] = useState<AnalysisSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

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

  return (
    <div>
      {/* ─── 标题区 ─────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>
          欢迎使用 TraceGA
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>行为数据分析管理平台</p>
      </div>

      {/* ─── 统计卡片 ───────────────────────────────────── */}
      {loading ? (
        <Row gutter={[16, 16]}>
          {[0, 1, 2, 3].map((i) => (
            <Col key={i} xs={24} sm={12} lg={6}>
              <StatCard title="加载中..." value="—" loading />
            </Col>
          ))}
        </Row>
      ) : (
        <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="页面浏览量 (PV)"
              value={formatNumber(overview?.pv ?? 0)}
              accentColor={cardAccents[0]}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="独立访客 (UV)"
              value={formatNumber(overview?.uv ?? 0)}
              accentColor={cardAccents[1]}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="事件类型数"
              value={formatNumber(overview?.eventCount ?? 0)}
              accentColor={cardAccents[2]}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="人均访问次数"
              value={overview?.rate ?? '0'}
              accentColor={cardAccents[3]}
            />
          </Col>
        </Row>
      )}

      {/* ─── 快捷入口 ───────────────────────────────────── */}
      <Card
        title={<span style={{ fontSize: 16, fontWeight: 600 }}>快捷操作</span>}
        styles={{ body: { padding: 20 } }}
        style={{ borderRadius: 8 }}
      >
        <Row gutter={[16, 16]}>
          {quickLinks.map((link) => (
            <Col key={link.key} xs={12} sm={6}>
              <Card
                hoverable
                onClick={() => navigate(link.key)}
                styles={{ body: { padding: 20, textAlign: 'center', cursor: 'pointer' } }}
              >
                <div style={{ fontSize: 28, color: link.color, marginBottom: 8 }}>{link.icon}</div>
                <Text style={{ fontSize: 14, color: '#475569' }}>{link.label}</Text>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  )
}
