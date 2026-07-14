import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get port(): number {
    return this.configService.get<number>('PORT', 3000)
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development')
  }

  get database() {
    return {
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 3306),
      username: this.configService.get<string>('DB_USERNAME', 'root'),
      password: this.configService.get<string>('DB_PASSWORD', 'root'),
      database: this.configService.get<string>('DB_DATABASE', 'tracega'),
    }
  }

  get glm() {
    return {
      apiKey: this.configService.get<string>('GLM_API_KEY', ''),
      model: this.configService.get<string>('GLM_MODEL', 'glm-4-flash'),
    }
  }
}
