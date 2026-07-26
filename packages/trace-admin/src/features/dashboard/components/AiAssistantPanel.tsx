import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Input, Drawer, Spin, Empty, Typography } from 'antd'
import {
  MessageOutlined,
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  CloseOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { analyzeStream } from '@/api'

const { Text } = Typography
const { TextArea } = Input

// ─── 消息类型 ─────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

let msgCounter = 0
const uid = () => `ai_msg_${++msgCounter}`

// ─── 组件 ─────────────────────────────────────────────────
export const AiAssistantPanel: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // 新消息时自动滚动到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, loading])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
  }, [])

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
        { prompt: text, question: text },
        {
          onText: (chunk) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: msg.content + chunk } : msg,
              ),
            )
          },
          onError: (message) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: msg.content || `抱歉，${message}` }
                  : msg,
              ),
            )
          },
        },
        controller.signal,
      )
    } catch {
      // AbortError 或其他异常，不额外处理
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [input, loading])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 清理流式请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  return (
    <>
      {/* 浮动入口按钮 */}
      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<MessageOutlined />}
        style={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          width: 48,
          height: 48,
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          zIndex: 1000,
        }}
        onClick={() => setOpen(true)}
      />

      <Drawer
        title={
          <span>
            <RobotOutlined style={{ color: '#3b82f6', marginRight: 8 }} />
            AI 分析助手
          </span>
        }
        placement="right"
        width={420}
        open={open}
        onClose={() => setOpen(false)}
        styles={{ body: { display: 'flex', flexDirection: 'column', padding: 0 } }}
        extra={<Button type="text" icon={<CloseOutlined />} onClick={() => setOpen(false)} />}
      >
        {/* 消息列表 */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 16,
            background: '#f8fafc',
          }}
        >
          {messages.length === 0 && !loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Empty description="有什么数据分析问题想问？" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                  maxWidth: '70%',
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
          <TextArea
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，Enter 发送，Shift+Enter 换行"
            rows={3}
            disabled={loading}
            style={{ marginBottom: 8, resize: 'none' }}
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
      </Drawer>
    </>
  )
}
