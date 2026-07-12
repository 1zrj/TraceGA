import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, ClickHouseClient } from '@clickhouse/client'

@Injectable()
export class ClickHouseService implements OnModuleInit {
  private client: ClickHouseClient

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.client = createClient({
      host: `http://${this.configService.get('CLICKHOUSE_HOST', 'localhost')}:${this.configService.get('CLICKHOUSE_PORT', 8123)}`,
      username: this.configService.get('CLICKHOUSE_USER', 'default'),
      password: this.configService.get('CLICKHOUSE_PASSWORD', ''),
      database: this.configService.get('CLICKHOUSE_DATABASE', 'tracega'),
    })
  }

  getClient(): ClickHouseClient {
    return this.client
  }

  async query<T = any>(query: string, params?: Record<string, any>): Promise<T[]> {
    const result = await this.client.query({
      query,
      query_params: params,
      format: 'JSONEachRow',
    })
    return (await result.json()) as T[]
  }

  async insert(table: string, data: Record<string, any>[]): Promise<void> {
    await this.client.insert({
      table,
      values: data,
      format: 'JSONEachRow',
    })
  }
}
