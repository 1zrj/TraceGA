import React, { useState, useRef, useEffect } from 'react'
import { Button, Input, Drawer, Spin, Empty, Typography } from 'antd'
import {
  MessageOutlined,
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { analyze } from '@/api'
import type { AiAnalysisResult } from '@/types'

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

// ─── 格式化 AI 返回结果为显示文本 ──────────────────────────
function formatResult(result: AiAnalysisResult): string {
  let text = `▎分析结论\n${result.conclusion}\n`
  if (result.suggestions?.length) {
    text += `\n▎建议\n${result.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
  }
  return text
}

// ─── 组件 ─────────────────────────────────────────────────
export const AiAssistantPanel: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // 新消息时自动滚动到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, loading])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { id: uid(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    setLoading(true)
    try {
      const res = await analyze({ prompt: text, question: text })
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'assistant', content: formatResult(res) },
      ])
    } catch {
      // 网络/服务端错误由 request.ts 拦截器统一弹 message.error
      // 这里在对话中也展示一条提示，方便用户感知
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: '抱歉，AI 分析服务暂不可用，请稍后重试。',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

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
        extra={
          <Button type="text" icon={<CloseOutlined />} onClick={() => setOpen(false)} />
        }
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
                <Text
                  style={{
                    color: msg.role === 'user' ? '#fff' : '#1e293b',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </Text>
              </div>
            </div>
          ))}

          {/* 加载中 */}
          {loading && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#e2e8f0',
                  flexShrink: 0,
                }}
              >
                <RobotOutlined style={{ color: '#475569' }} />
              </div>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                }}
              >
                <Spin size="small" />
                <span style={{ marginLeft: 8, color: '#94a3b8', fontSize: 14 }}>
                  AI 正在分析...
                </span>
              </div>
            </div>
          )}
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
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
