import React, { useEffect, useMemo } from 'react'
import { Card, Skeleton, Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import { useAlarmStore } from '@/store/useAlarmStore'
import { sequentialBlue } from '@/tokens'

export const AlarmTrendChart: React.FC = () => {
  const trendData = useAlarmStore((s) => s.trendData)
  const trendLoading = useAlarmStore((s) => s.trendLoading)
  const fetchTrend = useAlarmStore((s) => s.fetchTrend)

  useEffect(() => {
    fetchTrend()
  }, [fetchTrend])

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 12,
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: trendData.map((d) => d.time),
        boundaryGap: false,
      },
      yAxis: {
        type: 'value' as const,
        name: '告警数量',
        nameTextStyle: { fontWeight: 'bold' as const },
      },
      series: [
        {
          type: 'line',
          data: trendData.map((d) => d.count),
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: {
            color: sequentialBlue[3],
            width: 2,
          },
          itemStyle: {
            color: sequentialBlue[3],
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: sequentialBlue[2] },
                { offset: 1, color: 'rgba(255,255,255,0)' },
              ],
            },
          },
        },
      ],
    }),
    [trendData],
  )

  return (
    <Card title="告警趋势" style={{ marginBottom: 16 }}>
      {trendLoading ? (
        <div
          style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : trendData.length === 0 ? (
        <div
          style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Empty description="暂无告警数据" />
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: 280, width: '100%' }} />
      )}
    </Card>
  )
}
