import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ClickHouseService } from './clickhouse.service';

@Global()
@Module({
  providers: [PrismaService, ClickHouseService],
  exports: [PrismaService, ClickHouseService],
})
export class DatabaseModule {}
