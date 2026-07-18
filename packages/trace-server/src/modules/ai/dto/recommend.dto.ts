import { IsString } from 'class-validator'

export class RecommendDto {
  @IsString()
  appId: string

  @IsString()
  description: string
}
