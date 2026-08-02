import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/** 创建告警规则 */
export class CreateAlarmRuleDto {
  /** 应用ID */
  @IsNotEmpty({ message: 'appId 不能为空' })
  @IsString()
  appId: string;

  /** 事件名称 */
  @IsNotEmpty({ message: 'eventName 不能为空' })
  @IsString()
  eventName: string;

  /** 触发阈值 */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  threshold: number;

  /** 比较操作符：gt=大于触发，lt=小于触发 */
  @IsIn(['gt', 'lt'], { message: 'operator 仅支持 gt / lt' })
  @IsString()
  operator: string;

  /** 通知方式 */
  @IsOptional()
  @IsString()
  notifyType?: string;

  /** webhook 通知地址（notifyType=webhook 时生效） */
  @IsOptional()
  @IsString()
  webhookUrl?: string;

  /** 规则状态：1=启用，0=停用 */
  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  status?: number;
}
