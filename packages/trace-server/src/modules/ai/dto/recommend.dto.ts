import { IsString, IsOptional } from 'class-validator';

export class RecommendDto {
  @IsOptional()
  @IsString()
  appId?: string;

  @IsString()
  description: string;
}
