import { Controller, Post, Body } from '@nestjs/common'

@Controller('api/auth')
export class AuthController {
  @Post('login')
  login(@Body() _body: { username: string; password: string }) {
    // 临时 stub：Mock 登录，后续接入真实认证
    return {
      token: 'mock-token-stub',
      user: { id: '1', username: 'admin', role: 'admin' },
    }
  }

  @Post('logout')
  logout() {
    return null
  }
}
