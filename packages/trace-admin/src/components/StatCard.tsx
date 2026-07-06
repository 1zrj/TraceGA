import React from 'react'

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative'
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeType = 'positive',
}) => {
  return (
    <div
      style={{
        background: '#fff',
        padding: 20,
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>{title}</div>
      {change && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: changeType === 'positive' ? '#10b981' : '#ef4444',
          }}
        >
          {change}
        </div>
      )}
    </div>
  )
}