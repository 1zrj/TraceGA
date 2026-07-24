import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { Observable } from 'rxjs'
import { Request } from 'express'
import { JwtService } from '@nestjs/jwt'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const authHeader = request.headers.authorization

    if (!authHeader) {
      throw new UnauthorizedException('未提供认证令牌')
    }

    const match = authHeader.match(/^[Bb]earer\s+(.+)$/)
    const token = match ? match[1] : authHeader

    if (!token) {
      throw new UnauthorizedException('认证令牌无效')
    }

    try {
      const payload = this.jwtService.verify(token)
      // 将用户信息挂到 request 上，供 Controller 使用
      ;(request as any).user = payload
      return true
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedException('认证令牌已过期')
      }
      throw new UnauthorizedException('认证令牌无效')
    }
  }
}
