import React from 'react'
import { Tag, Space } from 'antd'
import dayjs from 'dayjs'
import { Drawer, Button } from '@/components/ui'
import { useAlarmStore } from '@/store/useAlarmStore'

const LEVEL_MAP: Record<string, { label: string; color: string }> = {
  critical: { label: '严重', color: 'red' },
  high: { label: '高', color: 'orange' },
  medium: { label: '中', color: 'blue' },
  low: { label: '低', color: 'default' },
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'red' },
  processing: { label: '处理中', color: 'orange' },
  resolved: { label: '已解决', color: 'green' },
  closed: { label: '已关闭', color: 'default' },
}

const FIELD_LABEL: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
)

export const AlarmDetailDrawer: React.FC = () => {
  const detailDrawerOpen = useAlarmStore((s) => s.detailDrawerOpen)
  const selectedRecord = useAlarmStore((s) => s.selectedRecord)
  const closeDetail = useAlarmStore((s) => s.closeDetail)

  if (!selectedRecord) return null

  const levelInfo = LEVEL_MAP[selectedRecord.level] || {
    label: selectedRecord.level,
    color: 'default',
  }
  const statusInfo = STATUS_MAP[selectedRecord.status] || {
    label: selectedRecord.status,
    color: 'default',
  }

  return (
    <Drawer
      open={detailDrawerOpen}
      onClose={closeDetail}
      title="告警详情"
      footer={
        <Space>
          <Button onClick={closeDetail}>关闭</Button>
        </Space>
      }
    >
      <div style={{ padding: '8px 0' }}>
        {/* 告警名称 */}
        <div style={{ marginBottom: 16 }}>
          <FIELD_LABEL label="告警名称" />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
            {selectedRecord.name}
          </div>
        </div>

        {/* 告警类型 */}
        <div style={{ marginBottom: 16 }}>
          <FIELD_LABEL label="告警类型" />
          <div style={{ fontSize: 14, color: '#334155' }}>{selectedRecord.type}</div>
        </div>

        {/* 告警级别 + 告警状态 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <FIELD_LABEL label="告警级别" />
            <Tag color={levelInfo.color}>{levelInfo.label}</Tag>
          </div>
          <div>
            <FIELD_LABEL label="告警状态" />
            <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
          </div>
        </div>

        {/* 关联规则 */}
        <div style={{ marginBottom: 16 }}>
          <FIELD_LABEL label="关联规则" />
          <div style={{ fontSize: 14, color: '#334155' }}>{selectedRecord.rule || '-'}</div>
        </div>

        {/* 应用ID */}
        <div style={{ marginBottom: 16 }}>
          <FIELD_LABEL label="应用ID" />
          <div style={{ fontSize: 14, color: '#334155' }}>{selectedRecord.appId}</div>
        </div>

        {/* 告警消息 */}
        <div style={{ marginBottom: 16 }}>
          <FIELD_LABEL label="告警消息" />
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
            {selectedRecord.message || '无'}
          </div>
        </div>

        {/* 附加数据 */}
        <div style={{ marginBottom: 16 }}>
          <FIELD_LABEL label="附加数据" />
          <pre
            style={{
              fontSize: 12,
              color: '#475569',
              background: '#f1f5f9',
              padding: 12,
              borderRadius: 6,
              fontFamily: 'monospace',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              margin: 0,
              maxHeight: 200,
              overflow: 'auto',
            }}
          >
            {JSON.stringify(selectedRecord.data, null, 2)}
          </pre>
        </div>

        {/* 创建时间 + 更新时间 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <FIELD_LABEL label="创建时间" />
            <div style={{ fontSize: 14, color: '#334155' }}>
              {dayjs(selectedRecord.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </div>
          </div>
          <div>
            <FIELD_LABEL label="更新时间" />
            <div style={{ fontSize: 14, color: '#334155' }}>
              {dayjs(selectedRecord.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  )
}
