import { IsString, IsOptional } from 'class-validator';

export class DailyReportDto {
  @IsOptional()
  @IsString()
  appId?: string;
  @IsOptional()
  @IsString()
  date?: string;
}
