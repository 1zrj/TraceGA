import { IsString } from 'class-validator';

export class NlQueryDto {
  @IsString()
  appId: string;

  @IsString()
  question: string;
}
