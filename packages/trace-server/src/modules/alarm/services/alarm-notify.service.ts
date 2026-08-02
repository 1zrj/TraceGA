import { Injectable, Logger } from '@nestjs/common';

/** Webhook 请求超时时间（毫秒） */
const WEBHOOK_TIMEOUT_MS = 5 * 1000;

/** 通知发送总次数（含 1 次重试） */
const NOTIFY_ATTEMPTS = 2;

/** 发送给 webhook 的告警载荷 */
export interface WebhookNotifyPayload {
  alarmId: string;
  appId: string;
  eventName: string;
  level: string;
  message: string;
  triggeredAt: string;
}

/**
 * 告警通知服务（当前仅支持 webhook 模式）
 *
 * 设计要点：通知发送失败不抛异常、不影响告警记录写入主流程，
 * 只记录日志，由调用方决定是否感知失败。
 */
@Injectable()
export class AlarmNotifyService {
  private readonly logger = new Logger('AlarmNotify');

  /** 发送 webhook 通知，成功返回 true，最终失败返回 false（不抛错） */
  async sendWebhook(url: string, payload: WebhookNotifyPayload): Promise<boolean> {
    for (let attempt = 1; attempt <= NOTIFY_ATTEMPTS; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
        } finally {
          clearTimeout(timer);
        }

        this.logger.log(`webhook 通知发送成功 [${url}]（告警 #${payload.alarmId}）`);
        return true;
      } catch (error) {
        const reason = (error as Error).name === 'AbortError' ? '请求超时' : (error as Error).message;
        this.logger.warn(`webhook 通知发送失败（第 ${attempt}/${NOTIFY_ATTEMPTS} 次）[${url}]：${reason}`);
      }
    }
    return false;
  }
}
