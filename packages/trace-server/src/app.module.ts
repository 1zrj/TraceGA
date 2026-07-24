import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { ConfigModule } from './config/config.module'
import { DatabaseModule } from './database/database.module'
import { EventModule } from './modules/event/event.module'
import { TrackModule } from './modules/track/track.module'
import { AnalysisModule } from './modules/analysis/analysis.module'
import { AiModule } from './modules/ai/ai.module'
import { AuthModule } from './modules/auth/auth.module'
import { AuthGuard } from './common/guards/auth.guard'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'
import { LoggerMiddleware } from './common/middlewares/logger.middleware'
import { CorsMiddleware } from './common/middlewares/cors.middleware'

@Module({
  imports: [ConfigModule, DatabaseModule, EventModule, TrackModule, AnalysisModule, AiModule, AuthModule],
  providers: [
    AuthGuard,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorsMiddleware, LoggerMiddleware).forRoutes('*')
  }
}
