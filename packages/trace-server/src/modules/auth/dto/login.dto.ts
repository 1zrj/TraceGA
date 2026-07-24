import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class LoginDto {
  @IsOptional()
  @IsString()
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(128)
  email?: string

  @IsOptional()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string
}
