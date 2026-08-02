import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAlarmStatusDto {
  @IsString()
  @IsIn(['pending', 'processing', 'resolved', 'closed'])
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
