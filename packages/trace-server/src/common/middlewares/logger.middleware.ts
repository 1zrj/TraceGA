import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req
    const userAgent = req.get('user-agent') || ''

    console.log(`[${new Date().toISOString()}] ${method} ${originalUrl} - ${ip} - ${userAgent}`)

    next()
  }
}
