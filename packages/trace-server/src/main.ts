import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { AppConfigService } from './config/app-config.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  )

  const configService = app.get(AppConfigService)
  const port = configService.port

  await app.listen(port)
  console.log(`Server is running on http://localhost:${port}`)
}

bootstrap()
