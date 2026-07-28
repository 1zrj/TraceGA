import { IsString, IsOptional, IsObject } from 'class-validator';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  eventName?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  propertySchema?: Record<string, any>;

  @IsOptional()
  @IsString()
  appId?: string;
}
