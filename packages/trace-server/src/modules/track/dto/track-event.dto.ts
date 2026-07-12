import { IsString, IsOptional, IsObject, IsNumber } from 'class-validator'

export class TrackEventDto {
  @IsString()
  eventType: string

  @IsString()
  eventName: string

  @IsString()
  appId: string

  @IsOptional()
  @IsString()
  userId?: string

  @IsOptional()
  @IsString()
  sessionId?: string

  @IsOptional()
  @IsObject()
  properties?: Record<string, any>

  @IsOptional()
  @IsNumber()
  timestamp?: number

  @IsOptional()
  @IsString()
  url?: string

  @IsOptional()
  @IsString()
  referrer?: string
}
