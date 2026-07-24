import type { ITraceCore, TracePlugin, EventPriority } from '../../types';

// ─── 常量 ───

/** 非视觉元素标签（不参与白屏判定），仅包含 body 内可能出现的标签 */
const EXCLUDED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'BR', 'HR',
]);

/** 像素对比截取高度 */
const PIXEL_SAMPLE_HEIGHT = 100;
/** 像素对比最大宽度 */
const PIXEL_SAMPLE_MAX_WIDTH = 800;

/** 默认多轮检测时间点（DOMContentLoaded 后，毫秒） */
const DEFAULT_DETECT_ROUNDS = Object.freeze([3000, 6000, 10000]);

// ─── 类型 ───

export type DetectMethod = 'elementCount' | 'pixelCompare';

export interface WhiteScreenConfig {
  /** 可视元素数量阈值，低于此值判定为白屏，默认 2 */
  threshold?: number;
  /** 采样率 0-1，默认 1（全量检测） */
  sampleRate?: number;
  /** load 事件后补检延迟（毫秒），默认 1000 */
  loadDetectDelay?: number;
  /** 多轮检测时间点（从 DOMContentLoaded 起算，毫秒），默认 [3000, 6000, 10000] */
  detectRounds?: number[];
  /** 像素对比方差阈值，默认 100 */
  pixelVarianceThreshold?: number;
  /** 是否启用像素对比增强检测，默认 false */
  enablePixelCompare?: boolean;
  /** 可视元素最小面积（宽×高），默认 2500（50×50） */
  minElementArea?: number;
  /** 上报优先级，默认 'high' */
  reportPriority?: EventPriority;
}

interface DetectionResult {
  isWhiteScreen: boolean;
  elementCount: number;
  detectMethod: DetectMethod;
}

interface PixelResult {
  isWhiteScreen: boolean;
  variance: number;
}

type ResolvedConfig = Required<WhiteScreenConfig>;

const DEFAULT_CONFIG: ResolvedConfig = {
  threshold: 2,
  sampleRate: 1,
  loadDetectDelay: 1000,
  detectRounds: [...DEFAULT_DETECT_ROUNDS],
  pixelVarianceThreshold: 100,
  enablePixelCompare: false,
  minElementArea: 2500,
  reportPriority: 'high',
};

/**
 * 白屏监控插件。
 *
 * 在 DOMContentLoaded / load 后执行多轮检测，通过元素数量法（默认）或像素对比法（可选）
 * 判定页面是否白屏，并通过 SDK 上报。连续白屏去重，恢复时上报 recovered 事件。
 */
export class WhiteScreenPlugin implements TracePlugin {
  readonly name = 'WhiteScreenPlugin';

  private readonly config: ResolvedConfig;
  private core: ITraceCore | null = null;
  private installed = false;
  private hasReportedWhiteScreen = false;
  private hasReportedRecovered = false;
  private readonly timers: ReturnType<typeof setTimeout>[] = [];
  private onDomReady: (() => void) | null = null;
  private onLoad: (() => void) | null = null;
  private domReadyFired = false;
  private loadFired = false;

  constructor(config: WhiteScreenConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── 公开 API ───

  /** 安装插件，注册事件监听并启动白屏检测。 */
  install(core: ITraceCore): void {
    if (this.installed) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    this.core = core;
    this.installed = true;
    this.resetState();

    if (this.shouldSkipBySampleRate()) return;

    this.bindEvents();
  }

  /** 卸载插件，清除所有定时器和事件监听。 */
  uninstall(): void {
    if (!this.installed) return;
    this.clearAllTimers();
    this.unbindEvents();
    this.core = null;
    this.installed = false;
    this.resetState();
  }

  // ─── 事件绑定 ───

  private bindEvents(): void {
    const state = document.readyState;

    if (state === 'complete' || state === 'interactive') {
      this.onDomReadyHandler();
    } else {
      this.onDomReady = () => this.onDomReadyHandler();
      document.addEventListener('DOMContentLoaded', this.onDomReady);
    }

    if (state === 'complete') {
      this.onLoadHandler();
    } else {
      this.onLoad = () => this.onLoadHandler();
      window.addEventListener('load', this.onLoad);
    }
  }

  private unbindEvents(): void {
    if (this.onDomReady) {
      document.removeEventListener('DOMContentLoaded', this.onDomReady);
      this.onDomReady = null;
    }
    if (this.onLoad) {
      window.removeEventListener('load', this.onLoad);
      this.onLoad = null;
    }
  }

  // ─── 事件处理 ───

  private onDomReadyHandler(): void {
    if (this.domReadyFired) return;
    this.domReadyFired = true;
    this.scheduleRounds();
  }

  private onLoadHandler(): void {
    if (this.loadFired) return;
    this.loadFired = true;
    this.scheduleTimer(this.config.loadDetectDelay);
  }

  // ─── 调度 ───

  private scheduleRounds(): void {
    for (const delay of this.config.detectRounds) {
      this.scheduleTimer(delay);
    }
  }

  private scheduleTimer(delay: number): void {
    this.timers.push(setTimeout(() => this.performDetection(), delay));
  }

  // ─── 核心检测 ───

  private performDetection(): void {
    if (!this.installed) return;

    const result = this.detectByElementCount();

    if (result.isWhiteScreen) {
      this.handleWhiteScreen(result);
    } else {
      this.handleRecovery(result);
    }
  }

  private handleWhiteScreen(result: DetectionResult): void {
    if (this.hasReportedWhiteScreen) return;
    this.hasReportedWhiteScreen = true;
    this.hasReportedRecovered = false;
    this.reportEvent('white_screen', result);
  }

  private handleRecovery(result: DetectionResult): void {
    if (!this.hasReportedWhiteScreen || this.hasReportedRecovered) return;
    this.hasReportedRecovered = true;
    this.reportEvent('white_screen_recovered', result);
  }

  // ─── 策略一：元素数量法 ───

  private detectByElementCount(): DetectionResult {
    const elements = document.body?.querySelectorAll('*') ?? [];
    let count = 0;

    for (const el of elements) {
      if (EXCLUDED_TAGS.has(el.tagName)) continue;
      if (!this.isElementVisible(el as HTMLElement)) continue;
      if (!this.isElementLargeEnough(el as HTMLElement)) continue;
      count++;
    }

    const isWhiteScreen = count < this.config.threshold;

    if (!isWhiteScreen || !this.config.enablePixelCompare) {
      return { isWhiteScreen, elementCount: count, detectMethod: 'elementCount' };
    }

    // 元素法判定为白屏时，用像素对比法二次确认
    const pixel = this.detectByPixelCompare();
    return {
      isWhiteScreen: pixel.isWhiteScreen,
      elementCount: count,
      detectMethod: 'pixelCompare',
    };
  }

  // ─── 策略二：像素对比法 ───

  private detectByPixelCompare(): PixelResult {
    if (!document.body) return { isWhiteScreen: false, variance: 0 };

    try {
      const canvas = document.createElement('canvas');
      const w = Math.min(window.innerWidth, PIXEL_SAMPLE_MAX_WIDTH);
      const h = PIXEL_SAMPLE_HEIGHT;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) return { isWhiteScreen: false, variance: 0 };

      const bgColor = window.getComputedStyle(document.body).backgroundColor || '#ffffff';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      const variance = this.calcPixelVariance(ctx.getImageData(0, 0, w, h).data);
      return {
        isWhiteScreen: variance < this.config.pixelVarianceThreshold,
        variance: Math.round(variance),
      };
    } catch {
      return { isWhiteScreen: false, variance: 0 };
    }
  }

  /** 计算像素数据的灰度方差 */
  private calcPixelVariance(pixels: Uint8ClampedArray): number {
    const grayValues: number[] = [];
    let sum = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      grayValues.push(gray);
      sum += gray;
    }

    const mean = sum / grayValues.length;
    return grayValues.reduce((acc, g) => acc + (g - mean) ** 2, 0) / grayValues.length;
  }

  // ─── 元素判断 ───

  private isElementVisible(el: HTMLElement): boolean {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  private isElementLargeEnough(el: HTMLElement): boolean {
    const { width, height } = el.getBoundingClientRect();
    return width * height > this.config.minElementArea;
  }

  // ─── 上报 ───

  private reportEvent(eventName: string, result: DetectionResult): void {
    if (!this.core) return;

    this.core.trackEvent(
      eventName,
      {
        detectMethod: result.detectMethod,
        elementCount: result.elementCount,
        viewWidth: window.innerWidth,
        viewHeight: window.innerHeight,
        url: location.href,
        timestamp: Date.now(),
      },
      this.config.reportPriority,
      'error',
    );
  }

  // ─── 工具 ───

  private shouldSkipBySampleRate(): boolean {
    return this.config.sampleRate < 1 && Math.random() > this.config.sampleRate;
  }

  private resetState(): void {
    this.hasReportedWhiteScreen = false;
    this.hasReportedRecovered = false;
    this.domReadyFired = false;
    this.loadFired = false;
  }

  private clearAllTimers(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.length = 0;
  }
}