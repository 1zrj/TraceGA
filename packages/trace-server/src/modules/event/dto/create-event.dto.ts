import { IsString, IsOptional, IsObject } from 'class-validator'

export class CreateEventDto {
  @IsString()
  eventName: string

  @IsString()
  eventType: string

  @IsString()
  category: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsObject()
  propertySchema?: Record<string, any>

  @IsString()
  appId: string
}
