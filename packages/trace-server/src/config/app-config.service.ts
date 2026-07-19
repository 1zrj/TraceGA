import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get port(): number {
    return this.configService.get<number>('PORT', 3000);
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get database() {
    return {
      url: this.configService.get<string>('DATABASE_URL', ''),
    };
  }

  get clickhouse() {
    return {
      host: this.configService.get<string>('CLICKHOUSE_HOST', 'localhost'),
      port: this.configService.get<number>('CLICKHOUSE_PORT', 8123),
      username: this.configService.get<string>('CLICKHOUSE_USER', 'default'),
      password: this.configService.get<string>('CLICKHOUSE_PASSWORD', ''),
      database: this.configService.get<string>('CLICKHOUSE_DATABASE', 'tracega'),
    };
  }

  get glm() {
    return {
      apiKey: this.configService.get<string>('GLM_API_KEY', ''),
      model: this.configService.get<string>('GLM_MODEL', 'glm-4-flash'),
    };
  }
}
