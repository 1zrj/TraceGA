import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/** 更新告警规则（字段均可选） */
export class UpdateAlarmRuleDto {
  /** 应用ID */
  @IsOptional()
  @IsString()
  appId?: string;

  /** 事件名称 */
  @IsOptional()
  @IsString()
  eventName?: string;

  /** 触发阈值 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  threshold?: number;

  /** 比较操作符：gt=大于触发，lt=小于触发 */
  @IsOptional()
  @IsIn(['gt', 'lt'], { message: 'operator 仅支持 gt / lt' })
  @IsString()
  operator?: string;

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
