import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { createClient } from '@clickhouse/client'

@Injectable()
export class ClickHouseService implements OnModuleInit, OnModuleDestroy {
  private client: ReturnType<typeof createClient> | null = null

  async onModuleInit() {
    const host = process.env.CLICKHOUSE_HOST || 'localhost'
    const port = process.env.CLICKHOUSE_PORT || '8123'
    const database = process.env.CLICKHOUSE_DATABASE || 'default'

    this.client = createClient({
      host: `http://${host}:${port}`,
      database,
    })
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close()
    }
  }

  async query<T = any>(sql: string, params?: Record<string, any>): Promise<T[]> {
    if (!this.client) {
      throw new Error('ClickHouse client not initialized')
    }

    const result = await this.client.query({
      query: sql,
      query_params: params,
      format: 'JSON',
    })

    const data = await result.json() as { data?: T[] }
    return data.data || []
  }

  async insert<T = any>(table: string, data: T[]): Promise<void> {
    if (!this.client || data.length === 0) {
      return
    }

    const columns = Object.keys(data[0])
    const values = data.map((row) => {
      return columns.map((col) => {
        const value = row[col as keyof T]
        if (value === null || value === undefined) return 'NULL'
        if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`
        if (typeof value === 'object') return `'${JSON.stringify(value)}'`
        return value
      }).join(', ')
    }).join('), (')

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values})`
    await this.client.command({ query: sql })
  }
}