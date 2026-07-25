import { http, HttpResponse } from 'msw'

export const authHandlers = [
  // 登录
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }

    if (body.email === 'admin@tracega.com' && body.password === 'admin') {
      return HttpResponse.json({
        code: 200,
        message: 'success',
        data: {
          token: 'mock-token-stub',
          user: {
            id: '1',
            username: 'admin',
            email: 'admin@tracega.com',
            phone: '13800138000',
            role: 'admin',
            avatar: null,
            status: 1,
            lastLoginAt: new Date().toISOString(),
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        },
      })
    }

    return HttpResponse.json({ code: 401, message: '邮箱或密码错误', data: null }, { status: 401 })
  }),

  // 注册
  http.post('/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: {
        token: 'mock-token-register',
        user: {
          id: '2',
          username: body.username || 'user',
          email: body.email || '',
          phone: body.phone || '',
          role: body.role || 'viewer',
          avatar: null,
          status: 1,
          lastLoginAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    })
  }),

  // 登出
  http.post('/api/auth/logout', () => {
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: null,
    })
  }),

  // 个人信息
  http.get('/api/auth/profile', () => {
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: {
        id: '1',
        username: 'admin',
        email: 'admin@tracega.com',
        phone: '13800138000',
        role: 'admin',
        avatar: null,
        status: 1,
        lastLoginAt: new Date().toISOString(),
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    })
  }),
]
