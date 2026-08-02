import React, { useCallback, useRef, useState, useEffect } from 'react'
import { Typography, Card, Button, Spin, message } from 'antd'
import {
  BarChartOutlined,
  FileTextOutlined,
  WarningOutlined,
  SearchOutlined,
  BulbOutlined,
  RobotOutlined,
  UserOutlined,
  SendOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import {
  analyzeStream,
  getDailyReportStream,
  explainAnomalyStream,
  nlQueryStream,
  recommendStream,
} from '@/api'
import { useAppStore } from '@/store'

const { Title, Text } = Typography

// ─── 消息类型 ─────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

let msgCounter = 0
const uid = () => `ai_msg_${++msgCounter}`

// ─── 快捷操作定义 ─────────────────────────────────────────
interface QuickAction {
  key: string
  label: string
  icon: React.ReactNode
  color: string
}

const quickActions: QuickAction[] = [
  { key: 'analyze', label: '数据分析', icon: <BarChartOutlined />, color: '#3b82f6' },
  { key: 'dailyReport', label: '生成日报', icon: <FileTextOutlined />, color: '#10b981' },
  { key: 'anomalyExplain', label: '异常解释', icon: <WarningOutlined />, color: '#f59e0b' },
  { key: 'nlQuery', label: '自然语言查询', icon: <SearchOutlined />, color: '#8b5cf6' },
  { key: 'recommend', label: '埋点推荐', icon: <BulbOutlined />, color: '#ec4899' },
]

// ─── 组件 ─────────────────────────────────────────────────
const AiPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // 从全局 store 读取 Dashboard 的日期筛选范围
  const dashboardDateRange = useAppStore((s) => s.dashboardDateRange)

  // 新消息时自动滚动到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, loading])

  // 组件卸载时中止流式请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
  }, [])

  /** 执行流式请求的通用逻辑 */
  const startStream = useCallback(
    async (
      streamFn: (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: any,
        callbacks: {
          onText?: (text: string) => void
          onError?: (message: string) => void
          onDone?: () => void
        },
        signal?: AbortSignal,
      ) => Promise<void>,
      params: Record<string, unknown>,
      userLabel: string,
    ) => {
      const userMsg: Message = { id: uid(), role: 'user', content: userLabel }
      const assistantId = uid()
      setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }])
      setLoading(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        await streamFn(
          params,
          {
            onText: (chunk) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId ? { ...msg, content: msg.content + chunk } : msg,
                ),
              )
            },
            onError: (errMsg) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: msg.content || `抱歉，${errMsg}` }
                    : msg,
                ),
              )
            },
          },
          controller.signal,
        )
      } catch {
        // AbortError 等不在额外处理
      } finally {
        setLoading(false)
        abortRef.current = null
      }
    },
    [],
  )

  /** 处理快捷操作点击 */
  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      if (loading) {
        message.warning('当前有请求正在处理，请稍候')
        return
      }

      const inputText = input.trim()

      switch (action.key) {
        case 'analyze':
          startStream(
            analyzeStream,
            {
              prompt: inputText || '数据分析',
              question: inputText || '数据分析',
              ...dashboardDateRange,
            },
            inputText || '进行数据分析',
          )
          break
        case 'dailyReport':
          startStream(
            getDailyReportStream,
            { appId: 'default', date: new Date().toISOString().slice(0, 10) },
            '生成今日日报',
          )
          break
        case 'anomalyExplain':
          startStream(
            explainAnomalyStream,
            { eventName: inputText || '异常事件' },
            inputText || '解释异常',
          )
          break
        case 'nlQuery':
          startStream(
            nlQueryStream,
            { appId: 'default', question: inputText || '近7天的数据趋势' },
            inputText || '自然语言查询',
          )
          break
        case 'recommend':
          startStream(
            recommendStream,
            { description: inputText || '用户注册流程' },
            inputText || '埋点推荐',
          )
          break
      }
    },
    [loading, input, startStream],
  )

  /** 发送自定义消息 */
  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { id: uid(), role: 'user', content: text }
    const assistantId = uid()
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await analyzeStream(
        { prompt: text, question: text, ...dashboardDateRange },
        {
          onText: (chunk) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: msg.content + chunk } : msg,
              ),
            )
          },
          onError: (errMsg) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: msg.content || `抱歉，${errMsg}` }
                  : msg,
              ),
            )
          },
        },
        controller.signal,
      )
    } catch {
      // 不额外处理
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [input, loading, dashboardDateRange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>
          <RobotOutlined style={{ color: '#3b82f6', marginRight: 8 }} />
          AI 分析助手
        </Title>
        <Text type="secondary">选择分析功能或输入自定义问题，快速获取数据洞察</Text>
        {dashboardDateRange && (
          <div style={{ marginTop: 8 }}>
            <Text
              type="secondary"
              style={{ fontSize: 12, background: '#f0f5ff', padding: '2px 10px', borderRadius: 4 }}
            >
              分析范围：{dashboardDateRange.startTime} ~ {dashboardDateRange.endTime}
            </Text>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 24,
          flexDirection: window.innerWidth < 768 ? 'column' : 'row',
        }}
      >
        {/* ─── 左侧：快捷操作区 ─────────────────────────── */}
        <Card
          title={
            <span>
              <ThunderboltOutlined style={{ color: '#f59e0b', marginRight: 8 }} />
              快捷操作
            </span>
          }
          style={{ width: window.innerWidth < 768 ? '100%' : 280, flexShrink: 0 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {quickActions.map((action) => (
              <Button
                key={action.key}
                type="default"
                size="large"
                icon={action.icon}
                loading={loading}
                onClick={() => handleQuickAction(action)}
                style={{
                  height: 48,
                  textAlign: 'left',
                  borderColor: action.color,
                  color: action.color,
                  borderRadius: 8,
                  fontSize: 15,
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </Card>

        {/* ─── 右侧：对话区 ─────────────────────────────── */}
        <Card
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0 } }}
        >
          {/* 消息列表 */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflow: 'auto',
              padding: 16,
              minHeight: 400,
              maxHeight: 560,
              background: '#f8fafc',
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#94a3b8',
                }}
              >
                <RobotOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }} />
                <Text type="secondary" style={{ fontSize: 15 }}>
                  点击左侧快捷功能开始分析，或在下方向我提问
                </Text>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  marginBottom: 16,
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                {/* 头像 */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: msg.role === 'user' ? '#3b82f6' : '#e2e8f0',
                    color: msg.role === 'user' ? '#fff' : '#475569',
                    flexShrink: 0,
                  }}
                >
                  {msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                </div>

                {/* 气泡 */}
                <div
                  style={{
                    maxWidth: '75%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: msg.role === 'user' ? '#3b82f6' : '#fff',
                    color: msg.role === 'user' ? '#fff' : '#1e293b',
                    border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.6,
                    fontSize: 14,
                  }}
                >
                  {msg.role === 'assistant' && msg.content === '' ? (
                    <Spin size="small" />
                  ) : (
                    <Text
                      style={{
                        color: msg.role === 'user' ? '#fff' : '#1e293b',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {msg.content}
                    </Text>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 输入区域 */}
          <div
            style={{
              borderTop: '1px solid #e2e8f0',
              padding: '12px 16px',
              background: '#fff',
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题，Enter 发送，Shift+Enter 换行"
              rows={3}
              disabled={loading}
              style={{
                width: '100%',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 14,
                lineHeight: 1.6,
                resize: 'none',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: 8,
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {loading && (
                <Button icon={<StopOutlined />} onClick={handleStop}>
                  停止
                </Button>
              )}
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                loading={loading}
                disabled={!input.trim()}
              >
                发送
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default AiPage
