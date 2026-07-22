import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../services/auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    if (!body.username || !body.password) {
      throw new UnauthorizedException('用户名和密码不能为空');
    }
    return this.authService.login(body.username, body.password);
  }

  @Post('logout')
  logout() {
    return null;
  }
}
