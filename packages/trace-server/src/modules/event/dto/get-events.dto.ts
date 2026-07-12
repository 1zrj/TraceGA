import { IsOptional, IsString, IsNumber, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class GetEventsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number = 20

  @IsOptional()
  @IsString()
  eventType?: string

  @IsOptional()
  @IsString()
  appId?: string

  @IsOptional()
  @IsString()
  keyword?: string
}
