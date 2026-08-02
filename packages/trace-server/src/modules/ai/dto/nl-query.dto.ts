import { IsString, IsOptional } from 'class-validator';

export class NlQueryDto {
  @IsOptional()
  @IsString()
  appId?: string;

  @IsString()
  question: string;
}
