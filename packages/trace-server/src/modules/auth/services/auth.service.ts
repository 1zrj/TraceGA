import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../database/prisma.service';
import { signToken, verifyToken } from '../../../common/utils/token';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(username: string, password: string) {
    // 查数据库找用户
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 签发 JWT token
    const token = signToken({ sub: String(user.id), username: user.username });

    return {
      token,
      user: {
        id: String(user.id),
        username: user.username,
        name: user.name,
        avatar: user.avatar || '',
        email: user.email || '',
        role: user.role || 'admin',
      },
    };
  }

  verifyToken(token: string): { sub: string; username: string } {
    const payload = verifyToken(token);
    if (!payload) {
      throw new UnauthorizedException('认证令牌无效或已过期');
    }
    return { sub: payload.sub, username: payload.username };
  }
}
