import { IsString, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AnomalyContext {
  @IsOptional()
  @IsNumber()
  pageChange?: number;

  @IsOptional()
  @IsString()
  pageUrl?: string;

  @IsOptional()
  @IsString()
  releaseNotes?: string;

  @IsOptional()
  @IsString()
  additionalInfo?: string;
}

export class AnomalyExplainDto {
  @IsString()
  appId: string;

  @IsString()
  eventName: string;

  @IsOptional()
  @IsNumber()
  currentValue?: number;

  @IsOptional()
  @IsNumber()
  previousValue?: number;

  @IsOptional()
  @IsString()
  compareLabel?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnomalyContext)
  context?: AnomalyContext;
}
