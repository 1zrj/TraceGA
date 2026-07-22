import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WhiteScreenPlugin } from '../src/plugins/whiteScreen/WhiteScreenPlugin';
import type { ITraceCore } from '../src/types';

// ─── 常量 ───

const VIEWPORT_WIDTH = 1024;
const VIEWPORT_HEIGHT = 768;
const DETECT_DELAY_3S = 3000;
const DETECT_DELAY_6S = 6000;
const DETECT_DELAY_10S = 10000;

/** 白屏上报事件名 */
const EVENT_WHITE_SCREEN = 'white_screen';
/** 白屏恢复上报事件名 */
const EVENT_RECOVERED = 'white_screen_recovered';

// ─── 测试辅助 ───

/** 安装的插件列表，afterEach 自动 uninstall */
const installedPlugins: WhiteScreenPlugin[] = [];

/** 创建 mock ITraceCore */
function createMockCore(overrides: Partial<ITraceCore> = {}): ITraceCore {
  return {
    trackEvent: vi.fn(),
    register: vi.fn(),
    addCommonParams: vi.fn(),
    removeCommonParams: vi.fn(),
    getCommonParams: vi.fn().mockReturnValue({}),
    setUser: vi.fn(),
    getEnvInfo: vi.fn().mockReturnValue(null),
    getConfig: vi.fn().mockReturnValue(null),
    setReporter: vi.fn(),
    destroy: vi.fn(),
    ...overrides,
  };
}

/** 创建插件并注册到自动清理列表 */
function createPlugin(config: ConstructorParameters<typeof WhiteScreenPlugin>[0] = {}): WhiteScreenPlugin {
  const plugin = new WhiteScreenPlugin(config);
  installedPlugins.push(plugin);
  return plugin;
}

/** 填充正常页面 DOM */
function populateNormalPage(): void {
  document.body.innerHTML = `
    <header><h1>Hello World</h1></header>
    <main>
      <div class="big-box" style="width:200px;height:200px;"></div>
      <div class="big-box" style="width:300px;height:100px;"></div>
      <p>Some text content</p>
      <img class="big-box" style="width:100px;height:100px;" />
    </main>
    <footer><span>Footer</span></footer>
  `;
}

/** 清空页面 DOM */
function clearPage(): void {
  document.body.innerHTML = '';
}

/**
 * Mock getBoundingClientRect。
 * jsdom 默认返回 0，需要为含 .big-box 或特定语义标签的元素返回合理尺寸。
 */
function mockRectDimensions(): void {
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const tag = this.tagName;
    if (this.classList.contains('big-box')) {
      return DOMRectReadOnly.fromRect({ width: 200, height: 200 });
    }
    if (tag === 'H1' || tag === 'P' || tag === 'SPAN') {
      return DOMRectReadOnly.fromRect({ width: 500, height: 60 });
    }
    if (tag === 'HEADER' || tag === 'MAIN' || tag === 'FOOTER') {
      return DOMRectReadOnly.fromRect({ width: VIEWPORT_WIDTH, height: 200 });
    }
    return original.call(this);
  });
}

/** 设置 readyState 并安装插件 */
function installPlugin(plugin: WhiteScreenPlugin, core: ITraceCore, readyState: DocumentReadyState): void {
  Object.defineProperty(document, 'readyState', { value: readyState, writable: true });
  plugin.install(core);
}

// ─── 断言辅助 ───

/** 断言已上报白屏事件 */
function assertWhiteScreenReported(core: ITraceCore, overrides: Record<string, unknown> = {}): void {
  expect(core.trackEvent).toHaveBeenCalledWith(
    EVENT_WHITE_SCREEN,
    expect.objectContaining({ detectMethod: 'elementCount', elementCount: 0, ...overrides }),
    'high',
    'error',
  );
}

/** 断言已上报白屏恢复事件 */
function assertRecoveredReported(core: ITraceCore): void {
  expect(core.trackEvent).toHaveBeenLastCalledWith(
    EVENT_RECOVERED,
    expect.any(Object),
    'high',
    'error',
  );
}

/** 断言未触发任何上报 */
function assertNotReported(core: ITraceCore): void {
  expect(core.trackEvent).not.toHaveBeenCalled();
}

// ─── 测试套件 ───

describe('WhiteScreenPlugin', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_WIDTH, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: VIEWPORT_HEIGHT, writable: true });
    Object.defineProperty(document, 'readyState', { value: 'loading', writable: true });
  });

  afterEach(() => {
    installedPlugins.splice(0).forEach((p) => p.uninstall());
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  // ── 基本功能 ──

  describe('基本功能', () => {
    it('应有 name 属性', () => {
      const plugin = createPlugin();
      expect(plugin.name).toBe('WhiteScreenPlugin');
    });

    it('install 应绑定 DOMContentLoaded 和 load 事件', () => {
      const core = createMockCore();
      const plugin = createPlugin({ detectRounds: [DETECT_DELAY_3S] });
      const docSpy = vi.spyOn(document, 'addEventListener');
      const winSpy = vi.spyOn(window, 'addEventListener');

      plugin.install(core);

      expect(docSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
      expect(winSpy).toHaveBeenCalledWith('load', expect.any(Function));
    });
  });

  // ── 正常页面（非白屏） ──

  describe('正常页面（非白屏）', () => {
    it('不触发白屏上报', () => {
      const core = createMockCore();
      const plugin = createPlugin({ detectRounds: [DETECT_DELAY_3S] });

      mockRectDimensions();
      populateNormalPage();
      installPlugin(plugin, core, 'interactive');

      vi.advanceTimersByTime(DETECT_DELAY_3S);
      assertNotReported(core);
    });

    it('load 后补检不触发白屏上报', () => {
      const core = createMockCore();
      const plugin = createPlugin({ detectRounds: [], loadDetectDelay: 1000 });

      mockRectDimensions();
      populateNormalPage();
      installPlugin(plugin, core, 'complete');

      vi.advanceTimersByTime(1000);
      assertNotReported(core);
    });
  });

  // ── 空页面（白屏检测） ──

  describe('空页面（白屏检测）', () => {
    it('检测为白屏并上报', () => {
      const core = createMockCore();
      const plugin = createPlugin({ detectRounds: [DETECT_DELAY_3S], threshold: 2 });

      clearPage();
      installPlugin(plugin, core, 'interactive');

      vi.advanceTimersByTime(DETECT_DELAY_3S);

      expect(core.trackEvent).toHaveBeenCalledTimes(1);
      assertWhiteScreenReported(core);
    });

    it('多轮检测连续白屏只上报一次（去重）', () => {
      const core = createMockCore();
      const plugin = createPlugin({ detectRounds: [DETECT_DELAY_3S, DETECT_DELAY_6S, DETECT_DELAY_10S], threshold: 2 });

      clearPage();
      installPlugin(plugin, core, 'interactive');

      vi.advanceTimersByTime(DETECT_DELAY_3S);
      vi.advanceTimersByTime(DETECT_DELAY_3S);
      vi.advanceTimersByTime(4000);

      expect(core.trackEvent).toHaveBeenCalledTimes(1);
    });
  });

  // ── 白屏恢复 ──

  describe('白屏恢复', () => {
    it('白屏后恢复正常应上报 white_screen_recovered', () => {
      const core = createMockCore();
      const plugin = createPlugin({ detectRounds: [DETECT_DELAY_3S, DETECT_DELAY_6S], threshold: 2 });

      clearPage();
      installPlugin(plugin, core, 'interactive');

      // 第一轮：空页面 → 白屏
      vi.advanceTimersByTime(DETECT_DELAY_3S);
      assertWhiteScreenReported(core);

      // 恢复正常
      mockRectDimensions();
      populateNormalPage();

      // 第二轮：正常页面 → 恢复
      vi.advanceTimersByTime(DETECT_DELAY_3S);

      expect(core.trackEvent).toHaveBeenCalledTimes(2);
      assertRecoveredReported(core);
    });
  });

  // ── 采样率 ──

  describe('采样率', () => {
    it('sampleRate 为 0 时跳过检测，不绑定事件', () => {
      const core = createMockCore();
      const plugin = createPlugin({ sampleRate: 0, detectRounds: [DETECT_DELAY_3S] });
      const docSpy = vi.spyOn(document, 'addEventListener');
      const winSpy = vi.spyOn(window, 'addEventListener');

      clearPage();
      installPlugin(plugin, core, 'interactive');

      expect(docSpy).not.toHaveBeenCalled();
      expect(winSpy).not.toHaveBeenCalled();
    });

    it('sampleRate 为 0.5 时 random > 0.5 跳过', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.6);

      const core = createMockCore();
      const plugin = createPlugin({ sampleRate: 0.5, detectRounds: [DETECT_DELAY_3S] });
      const docSpy = vi.spyOn(document, 'addEventListener');

      installPlugin(plugin, core, 'interactive');

      expect(docSpy).not.toHaveBeenCalled();
    });
  });

  // ── uninstall ──

  describe('uninstall', () => {
    it('应清除定时器和事件监听', () => {
      const core = createMockCore();
      // 手动创建，不走自动清理列表，便于精确控制 uninstall 时机
      const plugin = new WhiteScreenPlugin({ detectRounds: [DETECT_DELAY_3S] });
      const docSpy = vi.spyOn(document, 'removeEventListener');
      const winSpy = vi.spyOn(window, 'removeEventListener');

      plugin.install(core);
      plugin.uninstall();

      expect(docSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
      expect(winSpy).toHaveBeenCalledWith('load', expect.any(Function));
    });

    it('重复 uninstall 不报错', () => {
      const plugin = createPlugin();
      installPlugin(plugin, createMockCore(), 'interactive');

      expect(() => {
        plugin.uninstall();
        plugin.uninstall();
      }).not.toThrow();
    });

    it('uninstall 后不再触发检测', () => {
      const core = createMockCore();
      const plugin = new WhiteScreenPlugin({ detectRounds: [DETECT_DELAY_3S] });

      clearPage();
      installPlugin(plugin, core, 'interactive');
      plugin.uninstall();

      vi.advanceTimersByTime(DETECT_DELAY_3S);
      assertNotReported(core);
    });
  });

  // ── 非视觉元素排除 ──

  describe('非视觉元素排除', () => {
    it('排除 script、style、link、meta、noscript', () => {
      const core = createMockCore();
      const plugin = createPlugin({ detectRounds: [DETECT_DELAY_3S], threshold: 2 });

      document.body.innerHTML = `
        <script>var x = 1;</script>
        <style>body { color: red; }</style>
        <link rel="stylesheet" href="style.css" />
        <meta charset="utf-8" />
        <noscript>No JS</noscript>
      `;
      installPlugin(plugin, core, 'interactive');

      vi.advanceTimersByTime(DETECT_DELAY_3S);
      assertWhiteScreenReported(core);
    });

    it('排除 display:none 和 visibility:hidden', () => {
      const core = createMockCore();
      const plugin = createPlugin({ detectRounds: [DETECT_DELAY_3S], threshold: 2 });

      document.body.innerHTML = `
        <div class="big-box" style="width:200px;height:200px;display:none;">Hidden</div>
        <div class="big-box" style="width:200px;height:200px;visibility:hidden;">Hidden</div>
      `;
      mockRectDimensions();
      installPlugin(plugin, core, 'interactive');

      vi.advanceTimersByTime(DETECT_DELAY_3S);
      assertWhiteScreenReported(core);
    });

    it('排除面积小于 50x50 的元素', () => {
      const core = createMockCore();
      const plugin = createPlugin({ detectRounds: [DETECT_DELAY_3S], threshold: 2 });

      document.body.innerHTML = `
        <span style="width:10px;height:10px;display:inline-block;">.</span>
        <span style="width:10px;height:10px;display:inline-block;">.</span>
      `;
      installPlugin(plugin, core, 'interactive');

      vi.advanceTimersByTime(DETECT_DELAY_3S);
      assertWhiteScreenReported(core);
    });
  });

  // ── readyState 场景 ──

  describe('readyState 场景', () => {
    it('页面已加载时 install 立即调度检测', () => {
      const core = createMockCore();
      const plugin = createPlugin({ detectRounds: [DETECT_DELAY_3S] });

      clearPage();
      installPlugin(plugin, core, 'complete');

      vi.advanceTimersByTime(DETECT_DELAY_3S);
      assertWhiteScreenReported(core);
    });
  });
});
