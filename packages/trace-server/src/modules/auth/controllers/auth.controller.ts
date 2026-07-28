import { Controller, Post, Get, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { Request } from 'express'
import { AuthService } from '../services/auth.service'
import { RegisterDto } from '../dto/register.dto'
import { LoginDto } from '../dto/login.dto'
import { AuthGuard } from '@/common/guards/auth.guard'

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  logout() {
    // JWT 是无状态的，logout 只需返回成功
    // 前端清除 localStorage 中的 token 即可
    return { message: '已退出登录' }
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  getProfile(@Req() req: Request) {
    const userId = (req as any).user.sub
    return this.authService.getProfile(userId)
  }
}
