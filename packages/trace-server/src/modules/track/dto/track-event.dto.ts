import { IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator'

export const TRACK_EVENT_TYPES = ['custom', 'click', 'page_view', 'exposure', 'error', 'performance', 'white_screen'] as const

export class TrackEventDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  eventId?: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @IsIn(TRACK_EVENT_TYPES)
  eventType: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'eventName must use snake_case',
  })
  eventName: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  appId: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  userId?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionId?: string

  @IsOptional()
  @IsObject()
  properties?: Record<string, any>

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8640000000000000)
  timestamp?: number

  @IsOptional()
  @IsString()
  @MaxLength(512)
  url?: string

  @IsOptional()
  @IsString()
  @MaxLength(512)
  referrer?: string
}
