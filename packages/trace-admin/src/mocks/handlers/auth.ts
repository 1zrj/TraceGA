import { http, HttpResponse } from 'msw'

export const authHandlers = [
  // 登录
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { username?: string; password?: string }

    if (body.username === 'admin' && body.password === 'admin') {
      return HttpResponse.json({
        code: 200,
        message: 'success',
        data: {
          token: 'mock-token-stub',
          user: {
            id: '1',
            username: 'admin',
            name: 'Admin',
            role: 'admin',
            avatar: '',
            email: 'admin@tracega.com',
          },
        },
      })
    }

    return HttpResponse.json(
      { code: 401, message: '用户名或密码错误', data: null },
      { status: 401 },
    )
  }),

  // 登出
  http.post('/api/auth/logout', () => {
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: null,
    })
  }),
]
