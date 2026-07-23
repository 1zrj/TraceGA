import React from 'react'
import { Card, Tag, Button, Tooltip, Empty, Spin } from 'antd'
import { ReloadOutlined, EyeOutlined, StopOutlined } from '@ant-design/icons'
import type { ErrorEventItem } from '@/types'

interface ErrorEventCardProps {
  /** 错误事件数据列表 */
  data: ErrorEventItem[]
  /** 是否加载中 */
  loading?: boolean
  /** 手动刷新回调 */
  onRefresh?: () => void
  /** 查看详情回调 */
  onViewDetail?: (item: ErrorEventItem) => void
  /** 忽略错误回调 */
  onIgnore?: (item: ErrorEventItem) => void
}

/** 错误状态对应的颜色和标签文案 */
const STATUS_CONFIG: Record<ErrorEventItem['status'], { color: string; label: string }> = {
  active: { color: '#ef4444', label: '活跃' },
  resolved: { color: '#10b981', label: '已解决' },
  ignored: { color: '#6b7280', label: '已忽略' },
}

/** 格式化持续时长为可读字符串 */
const formatDuration = (ms?: number): string | null => {
  if (ms == null) return null
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}min ${Math.round((ms % 60000) / 1000)}s`
}

/** 错误时间卡片组件：展示系统错误事件及其时间信息 */
export const ErrorEventCard: React.FC<ErrorEventCardProps> = ({
  data,
  loading = false,
  onRefresh,
  onViewDetail,
  onIgnore,
}) => {
  const hasActionButtons = onViewDetail || onIgnore

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>错误事件</span>
          {onRefresh && (
            <Tooltip title="刷新错误数据">
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined spin={loading} />}
                onClick={onRefresh}
                disabled={loading}
              />
            </Tooltip>
          )}
        </div>
      }
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{ body: { flex: 1, overflow: 'auto', padding: '12px 16px' } }}
    >
      <Spin spinning={loading}>
        {data.length === 0 ? (
          <Empty description="暂无错误事件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="error-event-list">
            {data.map((item) => {
              const statusCfg = STATUS_CONFIG[item.status]
              return (
                <div key={item.id} className="error-event-item">
                  {/* 错误类型和状态标识 */}
                  <div className="error-event-header">
                    <Tag color={statusCfg.color} style={{ marginRight: 8 }}>
                      {statusCfg.label}
                    </Tag>
                    <span className="error-event-type">{item.type}</span>
                    {item.duration != null && (
                      <span className="error-event-duration">{formatDuration(item.duration)}</span>
                    )}
                  </div>

                  {/* 错误描述 */}
                  <div className="error-event-message" title={item.message}>
                    <span className="error-event-name">[{item.errorName}]</span> {item.message}
                  </div>

                  {/* 底部：时间 + 操作按钮 */}
                  <div className="error-event-footer">
                    <span className="error-event-time">
                      {item.occurredAt}
                      {item.url && <span className="error-event-url"> — {item.url}</span>}
                    </span>
                    {hasActionButtons && (
                      <div className="error-event-actions">
                        {onViewDetail && (
                          <Button
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => onViewDetail(item)}
                          >
                            详情
                          </Button>
                        )}
                        {onIgnore && item.status === 'active' && (
                          <Button
                            type="link"
                            size="small"
                            danger
                            icon={<StopOutlined />}
                            onClick={() => onIgnore(item)}
                          >
                            忽略
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Spin>
    </Card>
  )
}
