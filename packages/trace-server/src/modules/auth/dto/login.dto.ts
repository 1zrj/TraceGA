import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * 校验登录请求中 email 和 phone 至少提供一个
 */
@ValidatorConstraint({ name: 'loginIdentifier', async: false })
class LoginIdentifierConstraint implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments): boolean {
    const dto = args.object as LoginDto;
    return !!(dto.email || dto.phone);
  }
  defaultMessage(): string {
    return '请提供邮箱或手机号';
  }
}

function LoginIdentifier(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'loginIdentifier',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions,
      validator: LoginIdentifierConstraint,
    });
  };
}

export class LoginDto {
  /**
   * 合成字段：承载跨字段校验，始终存在（初始化为 undefined），不会被 @IsOptional 旁路
   */
  @LoginIdentifier()
  private readonly __loginConstraint: undefined = undefined;

  @IsOptional()
  @IsString()
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(128)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;
}
