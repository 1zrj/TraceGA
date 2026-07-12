import { IsOptional, IsString, IsArray } from 'class-validator'

export class AnalysisSummaryDto {
  @IsOptional()
  @IsString()
  appId?: string

  @IsOptional()
  @IsString()
  startTime?: string

  @IsOptional()
  @IsString()
  endTime?: string
}

export class AnalysisTrendDto {
  @IsOptional()
  @IsString()
  appId?: string

  @IsOptional()
  @IsString()
  eventType?: string

  @IsOptional()
  @IsString()
  startTime?: string

  @IsOptional()
  @IsString()
  endTime?: string

  @IsOptional()
  @IsString()
  interval?: string
}

export class AnalysisFilterDto {
  @IsOptional()
  @IsString()
  appId?: string

  @IsOptional()
  @IsArray()
  eventTypes?: string[]

  @IsOptional()
  @IsString()
  startTime?: string

  @IsOptional()
  @IsString()
  endTime?: string

  @IsOptional()
  filters?: Record<string, any>[]
}
