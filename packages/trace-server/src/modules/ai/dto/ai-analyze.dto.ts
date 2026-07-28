import { IsString, IsOptional, IsArray } from 'class-validator'

export class AiAnalyzeDto {
  @IsString()
  appId: string

  @IsOptional()
  @IsString()
  analysisType?: string

  @IsOptional()
  @IsArray()
  eventNames?: string[]

  @IsOptional()
  @IsString()
  startTime?: string

  @IsOptional()
  @IsString()
  endTime?: string

  @IsOptional()
  @IsString()
  question?: string
}
