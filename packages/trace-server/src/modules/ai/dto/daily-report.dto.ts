import { IsString ,IsOptional} from 'class-validator';

export class DailyReportDto {
  @IsString()
  appId: string;
  @IsOptional()
  @IsString()
  date?: string
}
