/**
 * NlQueryService
 *
 * 职责：自然语言查询。用户输入中文问题 → GLM 解析为查询条件 JSON →
 *       校验 → 执行 ClickHouse 查询 → GLM 生成自然语言回答。
 *
 * 两次 GLM 调用：一次解析（NL→JSON），一次回答（data→NL）。
 *
 * 不涉及日报生成、异常解释或通用问答 —— 那是另外三个 Service 的职责。
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { NlQueryDto } from '../dto/nl-query.dto';
import { AnalysisService } from '../../analysis/services/analysis.service';
import { GlmClientService } from './glm-client.service';
import { PromptService } from './prompt.service';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** GLM 解析出的合法查询条件 */
export interface NlQueryJson {
  startTime: string;
  endTime: string;
  eventTypes: string[];
  limit: number;
  orderBy: 'asc' | 'desc';
}

/** 白名单：允许 GLM 输出的字段名 */
const ALLOWED_FIELDS = ['startTime', 'endTime', 'eventTypes', 'limit', 'orderBy'];

/** 允许的 eventTypes 枚举值 */
const ALLOWED_EVENT_TYPES = ['click', 'pageview', 'error', 'custom'];

/** 日期范围上限（天） */
const MAX_DATE_RANGE = 90;

/** 日期格式正则 */
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/** GLM 调用参数 */
const PARSE_MAX_TOKENS = 200; // 解析 JSON 输出很小
const ANSWER_MAX_TOKENS = 800; // 回答需要一定长度

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class NlQueryService {
  private readonly logger = new Logger(NlQueryService.name);

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly glmClient: GlmClientService,
    private readonly promptService: PromptService,
  ) {}

  // ===== 主入口 =====

  async processQuery(dto: NlQueryDto) {
    // 步骤 1：NL → 查询 JSON
    const rawJson = await this.parseQuestion(dto.question);

    // 步骤 2：校验 + 清洗
    const queryJson = this.validateQueryJson(rawJson);

    this.logger.log(
      `NL 查询解析成功 | question="${dto.question.slice(0, 50)}" | ` +
        `startTime=${queryJson.startTime} endTime=${queryJson.endTime} ` +
        `eventTypes=[${queryJson.eventTypes.join(',')}] limit=${queryJson.limit}`,
    );

    // 步骤 3：执行查询
    const data = await this.executeQuery(dto.appId, queryJson);

    // 步骤 4：data → 自然语言回答
    const answer = await this.generateAnswer(dto.question, queryJson, data);

    return {
      question: dto.question,
      queryJson,
      data,
      answer,
      generatedAt: new Date().toISOString(),
    };
  }

  // ===== 步骤 1：NL → JSON =====

  /**
   * 将用户问题发给 GLM 解析为查询条件 JSON。
   */
  private async parseQuestion(question: string): Promise<Record<string, unknown>> {
    const today = this.getTodayISO();
    const systemPrompt = this.promptService.system('nl-query.parse', { today });
    const userPrompt = this.promptService.user('nl-query.parse', { question });

    const result = await this.glmClient.chat(systemPrompt, userPrompt, {
      temperature: 0.1,
      maxTokens: PARSE_MAX_TOKENS,
    });

    return this.parseNLJSON(result.content);
  }

  /**
   * 解析 GLM 返回的 JSON。
   * 三层容错：JSON.parse → 正则提取 → 抛错
   */
  private parseNLJSON(content: string): Record<string, unknown> {
    try {
      return JSON.parse(content);
    } catch {
      // JSON 解析失败，继续尝试正则提取
    }

    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // JSON 解析失败，抛出异常
      }
    }

    throw new BadRequestException(`AI 返回的查询条件格式异常，请换种方式描述你的问题。原始输出：${content.slice(0, 200)}`);
  }

  // ===== 步骤 2：JSON 校验 =====

  /**
   * 校验 GLM 返回的查询 JSON。
   * - 只保留白名单字段
   * - 必填字段缺失 → 抛错
   * - 类型/值域不合法 → 抛错
   */
  private validateQueryJson(raw: Record<string, unknown>): NlQueryJson {
    const cleaned: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in raw) {
        cleaned[key] = raw[key];
      }
    }

    // startTime
    const startTime = String(cleaned.startTime || '');
    if (!ISO_PATTERN.test(startTime)) {
      throw new BadRequestException(`查询起始时间格式错误：${startTime || '(空)'}，期望格式 YYYY-MM-DDTHH:mm:ss`);
    }

    // endTime
    const endTime = String(cleaned.endTime || '');
    if (!ISO_PATTERN.test(endTime)) {
      throw new BadRequestException(`查询结束时间格式错误：${endTime || '(空)'}，期望格式 YYYY-MM-DDTHH:mm:ss`);
    }

    if (new Date(startTime) >= new Date(endTime)) {
      throw new BadRequestException('起始时间必须早于结束时间');
    }

    const diffDays = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 86400000;
    if (diffDays > MAX_DATE_RANGE) {
      throw new BadRequestException(`查询时间范围不能超过 ${MAX_DATE_RANGE} 天，当前范围为 ${Math.round(diffDays)} 天`);
    }

    // eventTypes
    let eventTypes: string[] = [];
    if (Array.isArray(cleaned.eventTypes)) {
      eventTypes = (cleaned.eventTypes as string[]).filter(t => ALLOWED_EVENT_TYPES.includes(t));
      const invalid = (cleaned.eventTypes as string[]).filter(t => !ALLOWED_EVENT_TYPES.includes(t));
      if (invalid.length > 0) {
        this.logger.warn(`GLM 返回了非法的 eventTypes，已过滤: [${invalid.join(',')}]`);
      }
    }

    // limit
    let limit = Number(cleaned.limit) || 10;
    if (!Number.isInteger(limit) || limit < 1) limit = 10;
    if (limit > 100) limit = 100;

    // orderBy
    const orderBy = cleaned.orderBy === 'asc' || cleaned.orderBy === 'desc' ? cleaned.orderBy : 'desc';

    return { startTime, endTime, eventTypes, limit, orderBy };
  }

  // ===== 步骤 3：执行查询 =====

  private async executeQuery(appId: string, query: NlQueryJson) {
    const result = await this.analysisService.getFiltered({
      appId,
      startTime: query.startTime,
      endTime: query.endTime,
      eventTypes: query.eventTypes.length > 0 ? query.eventTypes : undefined,
    });

    const sorted = [...result].sort((a, b) => {
      return query.orderBy === 'desc' ? b.count - a.count : a.count - b.count;
    });

    return sorted.slice(0, query.limit);
  }

  // ===== 步骤 4：data → 自然语言回答 =====

  private async generateAnswer(question: string, queryJson: NlQueryJson, data: unknown): Promise<string> {
    const systemPrompt = this.promptService.system('nl-query.answer');
    const userPrompt = this.promptService.user('nl-query.answer', {
      question,
      queryJson: JSON.stringify(queryJson, null, 2),
      dataJson: JSON.stringify(data, null, 2),
    });

    try {
      const result = await this.glmClient.chat(systemPrompt, userPrompt, {
        temperature: 0.3,
        maxTokens: ANSWER_MAX_TOKENS,
      });
      return result.content;
    } catch (err) {
      this.logger.error('NL 回答生成失败', err);
      const count = Array.isArray(data) ? data.length : 0;
      return `AI 回答生成失败。查询到 ${count} 条数据，以下是原始结果：${JSON.stringify(data)}`;
    }
  }

  // ===== 辅助 =====

  private getTodayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
