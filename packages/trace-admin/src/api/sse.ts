/**
 * SSE 流式请求工具
 *
 * 后端流式接口格式：
 *   data: {"type":"text","content":"..."}
 *   data: {"type":"stats","stats":{...}}
 *   data: {"type":"done"}
 *   data: {"type":"error","message":"..."}
 */

export interface SSEStreamCallbacks {
  onText?: (text: string) => void
  onStats?: (stats: unknown) => void
  onError?: (message: string) => void
  onDone?: () => void
}

/**
 * 发送 POST 请求并以 SSE 方式消费响应流
 */
export async function postSSE(
  url: string,
  body: unknown,
  callbacks: SSEStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const token = localStorage.getItem('token')
  const response = await fetch(`/api${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    callbacks.onError?.(`请求失败 (${response.status})`)
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    callbacks.onError?.('响应流不可读')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  let reading = true

  try {
    while (reading) {
      const { done, value } = await reader.read()
      if (done) {
        reading = false
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6)
          try {
            const msg = JSON.parse(raw)
            switch (msg.type) {
              case 'text':
                callbacks.onText?.(msg.content)
                break
              case 'stats':
                callbacks.onStats?.(msg.stats)
                break
              case 'done':
                callbacks.onDone?.()
                break
              case 'error':
                callbacks.onError?.(msg.message)
                break
            }
          } catch {
            // 跳过格式错误的行
          }
        }
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    callbacks.onError?.('流式读取中断')
  }
}
