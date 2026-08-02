import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetAlarmTrendDto {
  @IsOptional()
  @IsString()
  @IsIn(['15m', '1h', '4h', '1d', '7d'])
  timeRange?: string = '1d';
}
