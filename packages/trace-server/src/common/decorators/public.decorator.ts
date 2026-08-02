import { SetMetadata } from '@nestjs/common';

/** 元数据键：标记路由为公开访问（跳过 JWT 鉴权） */
export const IS_PUBLIC_KEY = 'isPublic';

/** 标记控制器或方法为公开访问（如登录、SDK 事件上报） */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
