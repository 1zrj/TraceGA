(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.TraceGASDK = {}));
})(this, (function (exports) { 'use strict';

  class EventBuffer {
    constructor(maxSize) {
      this.items = [];
      this.head = 0;
      this.maxSize = maxSize;
    }
    /**
     * 向缓冲区添加一条数据。
     * 若当前数量已达到最大容量，会先移除最旧的一条数据（O(1)），再添加新数据。
     *
     * @param item - 待添加的数据
     */
    push(item) {
      if (this.size() >= this.maxSize) {
        this.head++;
      }
      this.items.push(item);
    }
    /**
     * 移除并返回缓冲区中最旧的一条数据（O(1)）。
     *
     * @returns 最旧的数据，若缓冲区为空则返回 `undefined`
     */
    pop() {
      if (this.head >= this.items.length)
        return void 0;
      return this.items[this.head++];
    }
    /**
     * 当前缓冲区中的事件数。
     */
    size() {
      return this.items.length - this.head;
    }
    /**
     * 清空缓冲区。
     */
    clear() {
      this.items = [];
      this.head = 0;
    }
    /**
     * 取出缓冲区中全部数据并以数组形式返回，同时清空缓冲区。
     * 适用于批量上报场景。
     *
     * @returns 包含缓冲区中所有数据的数组（按入队顺序排列）
     */
    takeAll() {
      const all = this.items.slice(this.head);
      this.items = [];
      this.head = 0;
      return all;
    }
  }

  class PriorityScheduler {
    constructor(config) {
      this.destroyed = false;
      var _a, _b;
      this.maxBufferSize = config.maxBufferSize;
      this.urgentMaxSize = (_a = config.urgentMaxSize) != null ? _a : config.maxBufferSize;
      this.flushInterval = config.flushInterval;
      this.onFlush = config.onFlush;
      this.idleTimeoutFallback = (_b = config.idleTimeoutFallback) != null ? _b : 3e3;
      this.timerId = null;
      this.idleId = null;
      this.flushing = false;
      this.persister = config.persister;
      this.limiter = config.limiter;
      this.urgentBuffer = new EventBuffer(this.urgentMaxSize);
      this.highBuffer = new EventBuffer(this.maxBufferSize);
      this.normalBuffer = new EventBuffer(this.maxBufferSize);
      this.scheduleNext();
      this.scheduleIdle();
      this.recoverFailedCache();
    }
    /**
     * 按优先级向对应队列添加一条事件。
     * 若该队列达到容量上限，立即触发全量上报并重置定时器。
     *
     * @param priority - 优先级：`'urgent'` | `'high'` | `'normal'`
     * @param event - 待添加的埋点事件
     */
    add(priority, event) {
      const buffer = this.getBuffer(priority);
      buffer.push(event);
      if (this.shouldThresholdFlush(priority)) {
        this.clearTimer();
        this.doFlushAndSchedule();
      }
    }
    /**
     * 手动立即触发全量上报，取出所有队列数据合并后传递给 `onFlush`。
     * 执行后重置定时器。
     */
    flush() {
      this.clearTimer();
      this.doFlushAndSchedule();
    }
    /**
     * 暂停调度器定时器（不清空缓冲区），供页面隐藏时使用。
     */
    pause() {
      this.clearTimer();
    }
    /**
     * 取出所有队列中的全部数据（不触发上报），用于页面隐藏时通过 sendBeacon 发送。
     *
     * @returns 按 urgent → high → normal 顺序拼接的事件数组
     */
    takeAll() {
      return [...this.urgentBuffer.takeAll(), ...this.highBuffer.takeAll(), ...this.normalBuffer.takeAll()];
    }
    /**
     * 销毁调度器，清除定时器、空闲回调并清空所有缓冲区。
     */
    destroy() {
      this.destroyed = true;
      this.clearTimer();
      this.cancelIdle();
      this.urgentBuffer.clear();
      this.highBuffer.clear();
      this.normalBuffer.clear();
    }
    // ─── 定时器 ────────────────────────────────────────
    /**
     * 安排下一次定时全量上报。
     */
    scheduleNext() {
      this.timerId = setTimeout(() => {
        this.doScheduledFlush();
      }, this.flushInterval);
    }
    /**
     * 清除当前定时器。
     */
    clearTimer() {
      if (this.timerId !== null) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
    }
    /**
     * 初始化时检查 localStorage 残留缓存，若存在则立即以 urgent 优先级补发。
     * 补发后清除缓存，防止重复上报。
     */
    recoverFailedCache() {
      if (!this.persister)
        return;
      const cached = this.persister.load("trace_failed_cache");
      if (!cached)
        return;
      const events = Array.isArray(cached) ? cached : [cached];
      for (const event of events) {
        this.urgentBuffer.push(event);
      }
      this.persister.clear("trace_failed_cache");
      if (this.urgentBuffer.size() > 0) {
        this.clearTimer();
        this.doFlushAndSchedule();
      }
    }
    /**
     * 定时触发的全量上报，完成后安排下一次。
     * 上报失败静默处理（已在 transporter 中完成重试/缓存）。
     */
    async doScheduledFlush() {
      try {
        await this.doFlush();
      } catch (e) {
      }
      if (this.destroyed)
        return;
      this.scheduleNext();
    }
    /**
     * 阈值/手动触发后的全量上报，完成后重新安排定时器。
     * 上报失败静默处理（已在 transporter 中完成重试/缓存）。
     */
    async doFlushAndSchedule() {
      try {
        await this.doFlush();
      } catch (e) {
      }
      if (this.destroyed)
        return;
      this.scheduleNext();
    }
    // ─── 空闲调度 ──────────────────────────────────────
    /**
     * 注册空闲回调：使用 `requestIdleCallback`，降级为 `setTimeout`。
     */
    scheduleIdle() {
      if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        this.idleId = window.requestIdleCallback((deadline) => this.onIdle(deadline), { timeout: this.idleTimeoutFallback });
      } else {
        this.idleId = setTimeout(() => {
          this.onIdleFallback();
        }, this.idleTimeoutFallback);
      }
    }
    /**
     * 取消当前空闲回调。
     */
    cancelIdle() {
      if (this.idleId !== null) {
        if (typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(this.idleId);
        } else {
          clearTimeout(this.idleId);
        }
        this.idleId = null;
      }
    }
    /**
     * 空闲回调：仅取出 normal 队列数据上报，upper 级别不受影响。
     */
    async onIdle(_deadline) {
      if (this.destroyed)
        return;
      await this.flushNormalOnly();
      if (this.destroyed)
        return;
      this.scheduleIdle();
    }
    /**
     * 降级方案的空闲回调（setTimeout 模式）。
     */
    async onIdleFallback() {
      if (this.destroyed)
        return;
      await this.flushNormalOnly();
      if (this.destroyed)
        return;
      this.scheduleIdle();
    }
    /**
     * 仅上报 normal 队列数据，不触及 urgent/high。
     */
    async flushNormalOnly() {
      var _a, _b;
      if (this.flushing)
        return;
      const events = this.normalBuffer.takeAll();
      if (events.length === 0)
        return;
      this.flushing = true;
      try {
        await ((_a = this.limiter) == null ? void 0 : _a.acquire());
        try {
          await this.onFlush(events);
        } finally {
          (_b = this.limiter) == null ? void 0 : _b.release();
        }
      } finally {
        this.flushing = false;
      }
    }
    // ─── 全量上报 ──────────────────────────────────────
    /**
     * 执行全量上报：按 urgent → high → normal 顺序拼接所有队列数据。
     * 使用 `flushing` 锁防止并发。
     */
    async doFlush() {
      var _a, _b;
      if (this.flushing)
        return;
      const events = [...this.urgentBuffer.takeAll(), ...this.highBuffer.takeAll(), ...this.normalBuffer.takeAll()];
      if (events.length === 0)
        return;
      this.flushing = true;
      try {
        await ((_a = this.limiter) == null ? void 0 : _a.acquire());
        try {
          await this.onFlush(events);
        } finally {
          (_b = this.limiter) == null ? void 0 : _b.release();
        }
      } finally {
        this.flushing = false;
      }
    }
    // ─── 辅助 ──────────────────────────────────────────
    /**
     * 根据优先级返回对应的缓冲区。
     */
    getBuffer(priority) {
      switch (priority) {
        case "urgent":
          return this.urgentBuffer;
        case "high":
          return this.highBuffer;
        case "normal":
          return this.normalBuffer;
      }
    }
    /**
     * 判断对应优先级队列是否已达到阈值，应触发全量上报。
     */
    shouldThresholdFlush(priority) {
      switch (priority) {
        case "urgent":
          return this.urgentBuffer.size() >= this.urgentMaxSize;
        case "high":
          return this.highBuffer.size() >= this.maxBufferSize;
        case "normal":
          return this.normalBuffer.size() >= this.maxBufferSize;
      }
    }
  }

  class TimeoutError extends Error {
    constructor(timeout) {
      super(`\u8BF7\u6C42\u8D85\u65F6\uFF1A${timeout}ms`);
      this.name = "TimeoutError";
    }
  }
  class HttpTransporter {
    constructor(config) {
      var _a, _b;
      this.baseURL = config.baseURL;
      this.headers = (_a = config.headers) != null ? _a : {};
      this.timeout = (_b = config.timeout) != null ? _b : 1e4;
      this.maxRetries = 3;
      this.retryDelays = [1e3, 2e3, 4e3];
      this.persister = config.persister;
      this.listeners = /* @__PURE__ */ new Map();
    }
    /**
     * 注册事件监听器。
     *
     * @param event - 事件类型：`'success'` | `'failed'` | `'retry'`
     * @param callback - 回调函数，接收事件元数据
     */
    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }
    /**
     * 移除事件监听器。
     *
     * @param event - 事件类型
     * @param callback - 要移除的回调函数引用
     */
    off(event, callback) {
      const cbs = this.listeners.get(event);
      if (!cbs)
        return;
      const idx = cbs.indexOf(callback);
      if (idx !== -1)
        cbs.splice(idx, 1);
    }
    /**
     * 发送数据到服务端，失败时自动重试。
     *
     * @param data - 待发送的 JSON 数据
     * @param eventCount - 本次上报的事件数量，用于 success 钩子，默认 1
     * @returns 请求成功时 resolve 的 Promise
     * @throws 全部重试失败后 reject 最终错误
     */
    send(data, eventCount = 1) {
      const startTime = Date.now();
      return this.requestWithRetry(data, 0, startTime, eventCount);
    }
    /**
     * 触发事件，通知所有注册的监听器。
     */
    emit(event, meta) {
      const cbs = this.listeners.get(event);
      if (!cbs)
        return;
      for (const cb of cbs) {
        try {
          cb(meta);
        } catch (e) {
        }
      }
    }
    /**
     * 带重试的请求执行。
     *
     * @param data - 待发送的数据
     * @param attempt - 当前尝试次数（从 0 开始）
     * @param startTime - 请求开始时间戳
     * @param eventCount - 事件数量
     */
    async requestWithRetry(data, attempt, startTime, eventCount) {
      var _a;
      try {
        await this.doRequest(data);
        this.emit("success", {
          eventCount,
          duration: Date.now() - startTime
        });
      } catch (error) {
        if (attempt < this.maxRetries) {
          const delay = this.retryDelays[attempt];
          this.emit("retry", {
            currentRetry: attempt + 1,
            delay
          });
          await this.delay(delay);
          return this.requestWithRetry(data, attempt + 1, startTime, eventCount);
        }
        this.emit("failed", {
          error,
          retryTimes: this.maxRetries
        });
        (_a = this.persister) == null ? void 0 : _a.save("trace_failed_cache", data);
        throw error;
      }
    }
    /**
     * 执行单次 HTTP 请求，带超时控制。
     *
     * @param data - 待发送的 JSON 数据
     */
    async doRequest(data) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      try {
        const response = await fetch(this.baseURL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...this.headers
          },
          body: JSON.stringify(data),
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        if (error.name === "AbortError") {
          throw new TimeoutError(this.timeout);
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }
    /**
     * 返回一个在指定毫秒后 resolve 的 Promise。
     *
     * @param ms - 延迟毫秒数
     */
    delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
  }

  const MAX_BEACON_PAYLOAD = 60 * 1024;
  class LifecycleManager {
    constructor(config) {
      this.reportUrl = config.reportUrl;
      this.getRemainingEvents = config.getRemainingEvents;
      this.pauseScheduler = config.pauseScheduler;
      this.destroyScheduler = config.destroyScheduler;
      this.onVisibilityChange = null;
      this.onPageHide = null;
      this.bindEvents();
    }
    /**
     * 绑定 visibilitychange 和 pagehide 事件。
     */
    bindEvents() {
      if (typeof document === "undefined")
        return;
      this.onVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
          this.handlePageHidden();
        }
      };
      this.onPageHide = () => {
        this.handlePageHidden();
      };
      document.addEventListener("visibilitychange", this.onVisibilityChange);
      window.addEventListener("pagehide", this.onPageHide);
    }
    /**
     * 页面隐藏时的处理逻辑：暂停调度器 → 取出剩余数据 → 通过 sendBeacon/keepalive 发送。
     */
    handlePageHidden() {
      this.pauseScheduler();
      const events = this.getRemainingEvents();
      if (events.length === 0)
        return;
      this.sendWithBeacon(events);
    }
    /**
     * 使用 sendBeacon 发送事件数据，超长时分片。
     * 若 sendBeacon 不可用，降级为 fetch + keepalive。
     */
    sendWithBeacon(events) {
      const isBeaconAvailable = typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function";
      const json = JSON.stringify(events);
      const blob = new Blob([json], { type: "application/json" });
      if (blob.size <= MAX_BEACON_PAYLOAD) {
        if (isBeaconAvailable) {
          navigator.sendBeacon(this.reportUrl, blob);
        } else {
          this.sendKeepalive(json);
        }
        return;
      }
      const chunks = this.chunkEvents(events);
      for (const chunk of chunks) {
        const chunkJson = JSON.stringify(chunk);
        const chunkBlob = new Blob([chunkJson], { type: "application/json" });
        if (isBeaconAvailable) {
          navigator.sendBeacon(this.reportUrl, chunkBlob);
        } else {
          this.sendKeepalive(chunkJson);
        }
      }
    }
    /**
     * 将事件数组按 60KB 限制分片。
     * 每个分片尽量装填事件，直到加上下一条会超出 60KB 为止。
     */
    chunkEvents(events) {
      const chunks = [];
      let current = [];
      let currentSize = 0;
      for (const event of events) {
        const eventSize = new Blob([JSON.stringify(event)], { type: "application/json" }).size;
        if (currentSize + eventSize > MAX_BEACON_PAYLOAD && current.length > 0) {
          chunks.push(current);
          current = [];
          currentSize = 0;
        }
        current.push(event);
        currentSize += eventSize;
      }
      if (current.length > 0) {
        chunks.push(current);
      }
      return chunks;
    }
    /**
     * 降级方案：使用 fetch + keepalive 发送数据。
     */
    sendKeepalive(json) {
      try {
        fetch(this.reportUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: json,
          keepalive: true
        });
      } catch (e) {
      }
    }
    /**
     * 解绑事件并销毁调度器。
     */
    destroy() {
      if (typeof document !== "undefined") {
        if (this.onVisibilityChange) {
          document.removeEventListener("visibilitychange", this.onVisibilityChange);
        }
        if (this.onPageHide) {
          window.removeEventListener("pagehide", this.onPageHide);
        }
      }
      this.destroyScheduler();
    }
  }

  class StoragePersister {
    /**
     * 将数据序列化为 JSON 并存入 localStorage。
     *
     * @param key - 存储键名
     * @param data - 待存储的数据（需可序列化）
     * @returns 存储成功返回 `true`，QuotaExceeded 或序列化异常时返回 `false`
     */
    save(key, data) {
      try {
        const json = JSON.stringify(data);
        localStorage.setItem(key, json);
        return true;
      } catch (error) {
        if (error.name === "QuotaExceededError" || error.code === 22) {
          return false;
        }
        return false;
      }
    }
    /**
     * 从 localStorage 读取并反序列化数据。
     *
     * @param key - 存储键名
     * @returns 反序列化后的数据，不存在或异常时返回 `null`
     */
    load(key) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null)
          return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    /**
     * 删除指定键的数据。
     *
     * @param key - 存储键名
     */
    clear(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
      }
    }
  }

  class ConcurrencyLimiter {
    /**
     * @param maxConcurrent - 最大并发数（必须 >= 1）
     */
    constructor(maxConcurrent) {
      if (maxConcurrent < 1) {
        throw new Error("maxConcurrent must be at least 1");
      }
      this.maxConcurrent = maxConcurrent;
      this.active = 0;
      this.waitQueue = [];
    }
    /**
     * 获取一个执行槽位。
     * 若当前活跃数已满，则返回一个 pending 的 Promise，等待释放后唤醒。
     *
     * @returns 获取到槽位时 resolve 的 Promise
     */
    acquire() {
      if (this.active < this.maxConcurrent) {
        this.active++;
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        this.waitQueue.push(() => {
          this.active++;
          resolve();
        });
      });
    }
    /**
     * 释放一个执行槽位，并唤醒等待队列中的下一个（若存在）。
     */
    release() {
      if (this.active > 0) {
        this.active--;
      }
      const next = this.waitQueue.shift();
      if (next) {
        next();
      }
    }
    /**
     * 销毁并发限制器，清空等待队列并重置活跃计数。
     */
    destroy() {
      this.waitQueue = [];
      this.active = 0;
    }
    /**
     * 返回当前活跃的请求数。
     */
    getActiveCount() {
      return this.active;
    }
    /**
     * 返回当前排队等待的请求数。
     */
    getWaitingCount() {
      return this.waitQueue.length;
    }
  }

  const DEFAULT_CONFIG$2 = {
    sampleRate: 1,
    maxBufferSize: 30,
    flushInterval: 5e3
  };
  class Reporter {
    constructor(config) {
      this.commonParams = {};
      this.listeners = /* @__PURE__ */ new Map();
      this.registered = false;
      if (config) {
        this.register(config);
      }
    }
    /**
     * 注册（或重新注册）Reporter，初始化所有子模块。
     * 若已注册会先销毁旧实例。
     */
    register(config) {
      if (this.registered) {
        this.destroy();
      }
      this.config = { ...DEFAULT_CONFIG$2, ...config };
      this.commonParams = {};
      this.envInfo = this.collectEnvInfo();
      this.persister = new StoragePersister();
      this.limiter = new ConcurrencyLimiter(5);
      this.transporter = new HttpTransporter({
        baseURL: this.config.reportUrl,
        timeout: 1e4,
        persister: this.persister
      });
      this.transporter.on("success", (meta) => this.emit("success", meta));
      this.transporter.on("failed", (meta) => this.emit("failed", meta));
      this.transporter.on("retry", (meta) => this.emit("retry", meta));
      this.scheduler = new PriorityScheduler({
        maxBufferSize: this.config.maxBufferSize,
        flushInterval: this.config.flushInterval,
        onFlush: async (events) => {
          await this.transporter.send(events, events.length);
        },
        persister: this.persister,
        limiter: this.limiter
      });
      this.lifecycle = new LifecycleManager({
        reportUrl: this.config.reportUrl,
        getRemainingEvents: () => this.scheduler.takeAll(),
        pauseScheduler: () => this.scheduler.pause(),
        destroyScheduler: () => this.scheduler.destroy()
      });
      this.registered = true;
    }
    /**
     * 注册事件监听器，支持 `'success'`、`'failed'`、`'retry'` 三种事件。
     *
     * @param event - 事件类型
     * @param callback - 回调函数
     */
    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }
    /**
     * 移除事件监听器。
     */
    off(event, callback) {
      const cbs = this.listeners.get(event);
      if (!cbs)
        return;
      const idx = cbs.indexOf(callback);
      if (idx !== -1)
        cbs.splice(idx, 1);
    }
    /**
     * 触发事件，通知所有注册的监听器。
     */
    emit(event, meta) {
      const cbs = this.listeners.get(event);
      if (!cbs)
        return;
      for (const cb of cbs) {
        try {
          cb(meta);
        } catch (e) {
        }
      }
    }
    /**
     * 埋点上报：组装 TrackEventData 并以指定优先级入队。
     *
     * @param eventName - 事件名称
     * @param params - 自定义参数
     * @param priority - 优先级，默认 'normal'
     */
    trackEvent(eventName, params, priority = "normal") {
      if (!this.registered)
        return;
      if (this.config.sampleRate !== void 0 && this.config.sampleRate < 1 && Math.random() > this.config.sampleRate) {
        return;
      }
      const event = {
        eventType: "custom",
        eventName,
        appId: this.config.appId,
        properties: { ...this.commonParams, ...params != null ? params : {} },
        timestamp: Date.now(),
        url: this.envInfo.url,
        referrer: this.envInfo.referrer,
        customParams: params != null ? params : {},
        commonParams: { ...this.commonParams },
        envInfo: this.envInfo
      };
      this.scheduler.add(priority, event);
    }
    /**
     * 添加公共参数，后续所有 trackEvent 调用都会携带。
     */
    addCommonParams(params) {
      Object.assign(this.commonParams, params);
    }
    /**
     * 移除指定 key 的公共参数。
     */
    removeCommonParams(keys) {
      for (const key of keys) {
        delete this.commonParams[key];
      }
    }
    /**
     * 设置用户 ID，会同时更新 envInfo 和公共参数。
     */
    setUser(userId) {
      this.envInfo.uid = userId;
      this.commonParams["uid"] = userId;
    }
    /**
     * 获取当前环境信息。
     */
    getEnvInfo() {
      return { ...this.envInfo };
    }
    /**
     * 手动立即刷新上报所有缓冲数据。
     */
    flush() {
      var _a;
      (_a = this.scheduler) == null ? void 0 : _a.flush();
    }
    /**
     * 销毁 Reporter 及所有子模块。
     */
    destroy() {
      var _a, _b;
      (_a = this.lifecycle) == null ? void 0 : _a.destroy();
      (_b = this.limiter) == null ? void 0 : _b.destroy();
      this.registered = false;
    }
    /**
     * 采集当前浏览器环境信息。
     */
    collectEnvInfo() {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const screenWidth = typeof screen !== "undefined" ? screen.width : 0;
      const screenHeight = typeof screen !== "undefined" ? screen.height : 0;
      const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
      return {
        browser: this.detectBrowser(ua),
        browserVersion: "",
        os: this.detectOS(ua),
        osVersion: "",
        screenWidth,
        screenHeight,
        viewportWidth,
        viewportHeight,
        uid: "",
        url: typeof location !== "undefined" ? location.href : "",
        referrer: typeof document !== "undefined" ? document.referrer : "",
        userAgent: ua
      };
    }
    /**
     * 简易浏览器检测。
     */
    detectBrowser(ua) {
      if (ua.includes("Edg/"))
        return "Edge";
      if (ua.includes("Chrome/"))
        return "Chrome";
      if (ua.includes("Firefox/"))
        return "Firefox";
      if (ua.includes("Safari/") && !ua.includes("Chrome/"))
        return "Safari";
      return "Unknown";
    }
    /**
     * 简易操作系统检测。
     */
    detectOS(ua) {
      if (ua.includes("Windows"))
        return "Windows";
      if (ua.includes("Mac OS"))
        return "macOS";
      if (ua.includes("Linux"))
        return "Linux";
      if (ua.includes("Android"))
        return "Android";
      if (ua.includes("iPhone") || ua.includes("iPad"))
        return "iOS";
      return "Unknown";
    }
  }

  function isPlainObject(value) {
    if (Object.prototype.toString.call(value) !== "[object Object]") {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || prototype === Object.prototype;
  }
  function copyOwnProperties(source, target, cache) {
    Reflect.ownKeys(source).forEach((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (!descriptor) {
        return;
      }
      const clonedDescriptor = "value" in descriptor ? { ...descriptor, value: deepClone(descriptor.value, cache) } : descriptor;
      Object.defineProperty(target, key, clonedDescriptor);
    });
  }
  function deepClone(value, cache = /* @__PURE__ */ new WeakMap()) {
    if (value === null || typeof value !== "object") {
      return value;
    }
    if (cache.has(value)) {
      return cache.get(value);
    }
    if (value instanceof Date) {
      return new Date(value.getTime());
    }
    if (value instanceof RegExp) {
      return new RegExp(value.source, value.flags);
    }
    if (value instanceof URL) {
      return new URL(value.href);
    }
    if (value instanceof ArrayBuffer) {
      return value.slice(0);
    }
    if (ArrayBuffer.isView(value)) {
      const copiedBuffer = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
      if (value instanceof DataView) {
        return new DataView(copiedBuffer);
      }
      const TypedArrayConstructor = value.constructor;
      return new TypedArrayConstructor(copiedBuffer);
    }
    if (value instanceof Map) {
      const cloned2 = /* @__PURE__ */ new Map();
      cache.set(value, cloned2);
      value.forEach((item, key) => {
        cloned2.set(deepClone(key, cache), deepClone(item, cache));
      });
      return cloned2;
    }
    if (value instanceof Set) {
      const cloned2 = /* @__PURE__ */ new Set();
      cache.set(value, cloned2);
      value.forEach((item) => {
        cloned2.add(deepClone(item, cache));
      });
      return cloned2;
    }
    if (Array.isArray(value)) {
      const cloned2 = new Array(value.length);
      cache.set(value, cloned2);
      copyOwnProperties(value, cloned2, cache);
      return cloned2;
    }
    const cloned = Object.create(Object.getPrototypeOf(value));
    cache.set(value, cloned);
    copyOwnProperties(value, cloned, cache);
    return cloned;
  }
  function safeJsonStringify(value) {
    const seen = /* @__PURE__ */ new WeakSet();
    try {
      const result = JSON.stringify(value, (_key, currentValue) => {
        if (typeof currentValue === "bigint") {
          return currentValue.toString();
        }
        if (typeof currentValue === "function") {
          return "[Function]";
        }
        if (typeof currentValue === "symbol") {
          return currentValue.toString();
        }
        if (typeof currentValue === "object" && currentValue !== null) {
          if (seen.has(currentValue)) {
            return "[Circular]";
          }
          seen.add(currentValue);
        }
        return currentValue;
      });
      return result != null ? result : "";
    } catch (e) {
      return "";
    }
  }
  function generateUUID() {
    const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : void 0;
    if (typeof (cryptoApi == null ? void 0 : cryptoApi.randomUUID) === "function") {
      return cryptoApi.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = Math.floor(Math.random() * 16);
      const value = char === "x" ? random : random & 3 | 8;
      return value.toString(16);
    });
  }
  function parseUserAgent(userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "") {
    var _a, _b, _c, _d, _e, _f, _g;
    const browserRules = [
      ["Edge", /(?:Edg|EdgiOS|EdgA)\/([\d.]+)/],
      ["Opera", /(?:OPR|Opera)\/([\d.]+)/],
      ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
      ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
      ["Safari", /Version\/([\d.]+).*Safari/]
    ];
    const osRules = [
      ["iOS", /(?:iPhone|iPad|iPod).*OS ([\d_]+)/],
      ["Android", /Android ([\d.]+)/],
      ["Windows", /Windows NT ([\d.]+)/],
      ["macOS", /Mac OS X ([\d_]+)/],
      ["Linux", /Linux/]
    ];
    const browserRule = browserRules.find(([, rule]) => rule.test(userAgent));
    const osRule = osRules.find(([, rule]) => rule.test(userAgent));
    return {
      browser: (_a = browserRule == null ? void 0 : browserRule[0]) != null ? _a : "Unknown",
      browserVersion: (_c = (_b = browserRule == null ? void 0 : browserRule[1].exec(userAgent)) == null ? void 0 : _b[1]) != null ? _c : "",
      os: (_d = osRule == null ? void 0 : osRule[0]) != null ? _d : "Unknown",
      osVersion: (_g = (_f = (_e = osRule == null ? void 0 : osRule[1].exec(userAgent)) == null ? void 0 : _e[1]) == null ? void 0 : _f.replace(/_/g, ".")) != null ? _g : ""
    };
  }
  function throttle(fn, wait) {
    const delay = Math.max(0, wait);
    let lastInvokeTime = 0;
    let timer = null;
    let latestArgs = null;
    let latestThis;
    const invoke = () => {
      timer = null;
      lastInvokeTime = Date.now();
      if (latestArgs) {
        const args = latestArgs;
        latestArgs = null;
        fn.apply(latestThis, args);
      }
    };
    return function throttled(...args) {
      latestArgs = args;
      latestThis = this;
      const remaining = delay - (Date.now() - lastInvokeTime);
      if (remaining <= 0 || remaining > delay) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        invoke();
        return;
      }
      if (!timer) {
        timer = setTimeout(invoke, remaining);
      }
    };
  }
  function debounce(fn, wait) {
    const delay = Math.max(0, wait);
    let timer = null;
    return function debounced(...args) {
      if (timer) {
        clearTimeout(timer);
      }
      const context = this;
      timer = setTimeout(() => {
        timer = null;
        fn.apply(context, args);
      }, delay);
    };
  }

  const UID_STORAGE_KEY = "__tracega_uid__";
  let memoryUid = "";
  const DEFAULT_ENV_OPTIONS = Object.freeze({
    includeQuery: false,
    includeHash: false
  });
  function getUid() {
    var _a, _b;
    if (memoryUid) {
      return memoryUid;
    }
    try {
      const storedUid = (_a = globalThis.localStorage) == null ? void 0 : _a.getItem(UID_STORAGE_KEY);
      if (storedUid) {
        memoryUid = storedUid;
        return storedUid;
      }
      memoryUid = generateUUID();
      (_b = globalThis.localStorage) == null ? void 0 : _b.setItem(UID_STORAGE_KEY, memoryUid);
      return memoryUid;
    } catch (e) {
      if (!memoryUid) {
        memoryUid = generateUUID();
      }
      return memoryUid;
    }
  }
  function sanitizeEnvironmentUrl(rawUrl, options = DEFAULT_ENV_OPTIONS) {
    var _a, _b, _c;
    if (!rawUrl) {
      return "";
    }
    try {
      const baseUrl = typeof window !== "undefined" && ((_a = window.location) == null ? void 0 : _a.href) ? window.location.href : "http://tracega.local/";
      const parsedUrl = new URL(rawUrl, baseUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return "";
      }
      parsedUrl.username = "";
      parsedUrl.password = "";
      if (!((_b = options.includeQuery) != null ? _b : DEFAULT_ENV_OPTIONS.includeQuery)) {
        parsedUrl.search = "";
      }
      if (!((_c = options.includeHash) != null ? _c : DEFAULT_ENV_OPTIONS.includeHash)) {
        parsedUrl.hash = "";
      }
      return parsedUrl.href.slice(0, 2048);
    } catch (e) {
      return "";
    }
  }
  function readDynamicEnvInfo(options) {
    var _a, _b, _c, _d, _e, _f, _g;
    const hasWindow = typeof window !== "undefined";
    const hasDocument = typeof document !== "undefined";
    return {
      screenWidth: hasWindow ? (_b = (_a = window.screen) == null ? void 0 : _a.width) != null ? _b : 0 : 0,
      screenHeight: hasWindow ? (_d = (_c = window.screen) == null ? void 0 : _c.height) != null ? _d : 0 : 0,
      viewportWidth: hasWindow ? (_e = window.innerWidth) != null ? _e : 0 : 0,
      viewportHeight: hasWindow ? (_f = window.innerHeight) != null ? _f : 0 : 0,
      referrer: sanitizeEnvironmentUrl(hasDocument ? document.referrer : "", options),
      url: sanitizeEnvironmentUrl(hasWindow ? (_g = window.location) == null ? void 0 : _g.href : "", options)
    };
  }
  function collectEnvInfo(options = DEFAULT_ENV_OPTIONS) {
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const parsedUserAgent = parseUserAgent(userAgent);
    return {
      userAgent,
      browser: parsedUserAgent.browser,
      browserVersion: parsedUserAgent.browserVersion,
      os: parsedUserAgent.os,
      osVersion: parsedUserAgent.osVersion,
      ...readDynamicEnvInfo(options),
      uid: getUid()
    };
  }
  function refreshEnvInfo(baseEnvInfo, options = DEFAULT_ENV_OPTIONS) {
    const dynamicEnvInfo = readDynamicEnvInfo(options);
    const urlChanged = Boolean(dynamicEnvInfo.url) && dynamicEnvInfo.url !== baseEnvInfo.url;
    return {
      ...baseEnvInfo,
      ...dynamicEnvInfo,
      referrer: urlChanged ? baseEnvInfo.url : baseEnvInfo.referrer || dynamicEnvInfo.referrer
    };
  }

  var ErrorEventName = /* @__PURE__ */ ((ErrorEventName2) => {
    ErrorEventName2["JsError"] = "js-error";
    ErrorEventName2["PromiseError"] = "promise-error";
    ErrorEventName2["ResourceError"] = "resource-error";
    ErrorEventName2["HttpError"] = "http-error";
    return ErrorEventName2;
  })(ErrorEventName || {});
  function sanitizeErrorUrl(rawUrl) {
    if (!rawUrl) {
      return void 0;
    }
    const sanitized = sanitizeEnvironmentUrl(rawUrl);
    if (!sanitized) {
      return void 0;
    }
    if (/^[a-z][a-z\d+.-]*:/i.test(rawUrl) || rawUrl.startsWith("//")) {
      return sanitized;
    }
    const parsed = new URL(sanitized);
    return rawUrl.startsWith("/") ? parsed.pathname : parsed.pathname.replace(/^\//, "");
  }
  function getBrowserContext() {
    return {
      url: typeof window !== "undefined" ? sanitizeEnvironmentUrl(window.location.href) : void 0,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : void 0
    };
  }

  class JsErrorHandler {
    constructor() {
      this.core = null;
      this.handleError = (event) => {
        if (!this.core || !this.isJsError(event)) {
          return;
        }
        this.core.trackEvent("js-error", this.normalizeError(event), "urgent", "error");
      };
    }
    install(core) {
      if (typeof window === "undefined") {
        return;
      }
      this.core = core;
      window.addEventListener("error", this.handleError, true);
    }
    uninstall() {
      if (typeof window === "undefined") {
        return;
      }
      window.removeEventListener("error", this.handleError, true);
      this.core = null;
    }
    isJsError(event) {
      return event instanceof ErrorEvent && Boolean(event.message || event.error);
    }
    normalizeError(event) {
      const error = event.error instanceof Error ? event.error : null;
      return {
        type: "js-error",
        message: event.message || (error == null ? void 0 : error.message) || "Unknown JavaScript error",
        occurredAt: Date.now(),
        filename: sanitizeErrorUrl(event.filename),
        lineno: event.lineno || void 0,
        colno: event.colno || void 0,
        errorName: error == null ? void 0 : error.name,
        stack: error == null ? void 0 : error.stack,
        ...getBrowserContext()
      };
    }
  }

  const SENSITIVE_KEYS = ["password", "token", "authorization", "cookie", "email", "secret", "key", "credential", "passwd", "ssn", "credit"];
  const MAX_SANITIZE_DEPTH = 3;
  const MAX_FIELDS = 20;
  const MAX_ARRAY_LENGTH = 10;
  const MAX_STRING_LENGTH = 200;
  function isSensitiveKey(key) {
    const lower = key.toLowerCase();
    return SENSITIVE_KEYS.some((k) => lower.includes(k));
  }
  function sanitizeReasonValue(value, depth = 0) {
    var _a;
    if (depth > MAX_SANITIZE_DEPTH) {
      return "[MaxDepth]";
    }
    if (value === null || value === void 0) {
      return value;
    }
    if (typeof value === "string") {
      return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) + "\u2026" : value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: (_a = value.stack) == null ? void 0 : _a.slice(0, 500)
      };
    }
    if (Array.isArray(value)) {
      return value.slice(0, MAX_ARRAY_LENGTH).map((v) => sanitizeReasonValue(v, depth + 1));
    }
    if (typeof value === "object") {
      const result = {};
      const keys = Object.keys(value).slice(0, MAX_FIELDS);
      for (const key of keys) {
        if (isSensitiveKey(key)) {
          result[key] = "[REDACTED]";
        } else {
          try {
            result[key] = sanitizeReasonValue(value[key], depth + 1);
          } catch (e) {
            result[key] = "[Unserializable]";
          }
        }
      }
      return result;
    }
    if (typeof value === "function") {
      return "[Function]";
    }
    if (typeof value === "symbol") {
      return value.toString();
    }
    try {
      return String(value).slice(0, MAX_STRING_LENGTH);
    } catch (e) {
      return "[Unserializable]";
    }
  }
  class PromiseErrorHandler {
    constructor() {
      this.core = null;
      this.handleUnhandledRejection = (event) => {
        if (!this.core) {
          return;
        }
        this.core.trackEvent("promise-error", this.normalizeRejection(event.reason), "urgent", "error");
      };
    }
    install(core) {
      if (typeof window === "undefined") {
        return;
      }
      this.core = core;
      window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
    }
    uninstall() {
      if (typeof window === "undefined") {
        return;
      }
      window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
      this.core = null;
    }
    normalizeRejection(reason) {
      var _a;
      if (reason instanceof Error) {
        return {
          type: "promise-error",
          message: reason.message || "Unhandled promise rejection",
          occurredAt: Date.now(),
          reasonType: "Error",
          errorName: reason.name,
          stack: (_a = reason.stack) == null ? void 0 : _a.slice(0, 1e3),
          ...getBrowserContext()
        };
      }
      const reasonType = this.getReasonType(reason);
      const sanitized = this.sanitizeReason(reason);
      return {
        type: "promise-error",
        message: `Unhandled ${reasonType} rejection`,
        occurredAt: Date.now(),
        reasonType,
        reason: sanitized,
        ...getBrowserContext()
      };
    }
    getReasonType(reason) {
      if (reason === null) {
        return "null";
      }
      if (Array.isArray(reason)) {
        return "array";
      }
      return typeof reason;
    }
    sanitizeReason(reason) {
      if (reason === void 0) {
        return void 0;
      }
      if (typeof reason === "string") {
        return reason.length > MAX_STRING_LENGTH ? reason.slice(0, MAX_STRING_LENGTH) + "\u2026" : reason;
      }
      try {
        const sanitized = sanitizeReasonValue(reason);
        return JSON.stringify(sanitized);
      } catch (e) {
        try {
          const s = String(reason);
          return s.length > MAX_STRING_LENGTH ? s.slice(0, MAX_STRING_LENGTH) + "\u2026" : s;
        } catch (e2) {
          return "[Unserializable]";
        }
      }
    }
  }

  class ResourceErrorHandler {
    constructor() {
      this.core = null;
      this.handleResourceError = (event) => {
        if (!this.core || !this.isResourceError(event)) {
          return;
        }
        this.core.trackEvent("resource-error", this.normalizeResourceError(event), "urgent", "error");
      };
    }
    install(core) {
      if (typeof window === "undefined") {
        return;
      }
      this.core = core;
      window.addEventListener("error", this.handleResourceError, true);
    }
    uninstall() {
      if (typeof window === "undefined") {
        return;
      }
      window.removeEventListener("error", this.handleResourceError, true);
      this.core = null;
    }
    isResourceError(event) {
      return event.target instanceof Element;
    }
    normalizeResourceError(event) {
      const target = event.target;
      const resourceUrl = this.getResourceUrl(target);
      const tagName = target.tagName.toLowerCase();
      return {
        type: "resource-error",
        message: `Resource load failed: ${tagName}`,
        occurredAt: Date.now(),
        tagName,
        resourceUrl: sanitizeErrorUrl(resourceUrl),
        ...getBrowserContext()
      };
    }
    getResourceUrl(target) {
      if (target instanceof HTMLImageElement) {
        return target.currentSrc || target.src || void 0;
      }
      if (target instanceof HTMLScriptElement || target instanceof HTMLIFrameElement) {
        return target.src || void 0;
      }
      if (target instanceof HTMLLinkElement) {
        return target.href || void 0;
      }
      if (target instanceof HTMLSourceElement) {
        return target.src || void 0;
      }
      return target.getAttribute("src") || target.getAttribute("href") || void 0;
    }
  }

  const FETCH_PATCH_KEY = Symbol.for("__tracega_http_fetch_patched__");
  const XHR_PATCH_KEY = Symbol.for("__tracega_http_xhr_patched__");
  let fetchSubscriberCount = 0;
  let nativeFetch = null;
  let patchedFetchRef = null;
  let xhrSubscriberCount = 0;
  let nativeXhrOpen = null;
  let nativeXhrSend = null;
  let patchedXhrOpenRef = null;
  let patchedXhrSendRef = null;
  const sharedXhrMeta = /* @__PURE__ */ new WeakMap();
  function isReportUrlStatic(url, reportUrl) {
    if (!url || !reportUrl) {
      return false;
    }
    if (url === reportUrl) {
      return true;
    }
    try {
      const base = typeof location !== "undefined" ? location.origin : "http://localhost";
      const candidate = new URL(url, base);
      const report = new URL(reportUrl, base);
      return candidate.origin === report.origin && (candidate.pathname === report.pathname || candidate.pathname.startsWith(report.pathname + "/"));
    } catch (e) {
      return false;
    }
  }
  class HttpErrorHandler {
    constructor(reportUrl) {
      this.core = null;
      this.installed = false;
      this.boundReporter = (payload) => {
        this.reportHttpError(payload);
      };
      this.reportUrl = sanitizeErrorUrl(reportUrl);
    }
    install(core) {
      if (typeof window === "undefined") {
        return;
      }
      if (this.installed) {
        return;
      }
      this.core = core;
      try {
        this.installFetchPatch();
        this.installXhrPatch();
        errorReporters.set(this.boundReporter, this.reportUrl);
        this.installed = true;
      } catch (error) {
        this.uninstall();
        throw error;
      }
    }
    uninstall() {
      if (typeof window === "undefined") {
        return;
      }
      errorReporters.delete(this.boundReporter);
      this.uninstallFetchPatch();
      this.uninstallXhrPatch();
      this.core = null;
      this.installed = false;
    }
    installFetchPatch() {
      if (typeof window.fetch !== "function") {
        return;
      }
      if (!nativeFetch) {
        nativeFetch = window.fetch.bind(window);
      }
      fetchSubscriberCount++;
      if (window[FETCH_PATCH_KEY]) {
        return;
      }
      window[FETCH_PATCH_KEY] = true;
      const capturedFetch = nativeFetch;
      const patched = async function(input, init) {
        const startedAt = Date.now();
        const requestUrl = getFetchUrlStatic(input);
        if (fetchSubscriberCount > 0) {
          for (const reportUrl of errorReporters.values()) {
            if (isReportUrlStatic(requestUrl, reportUrl)) {
              return capturedFetch.call(this, input, init);
            }
          }
        }
        try {
          const response = await capturedFetch.call(this, input, init);
          if (!response.ok && fetchSubscriberCount > 0) {
            const occurredAt = Date.now();
            const method = getFetchMethodStatic(input, init);
            queueHttpError({
              type: "http-error",
              requestType: "fetch",
              message: `HTTP request failed: ${response.status}`,
              occurredAt,
              method,
              requestUrl,
              status: response.status,
              statusText: response.statusText,
              duration: occurredAt - startedAt,
              ...getBrowserContext()
            });
          }
          return response;
        } catch (error) {
          if (fetchSubscriberCount > 0) {
            const occurredAt = Date.now();
            const method = getFetchMethodStatic(input, init);
            queueHttpError({
              type: "http-error",
              requestType: "fetch",
              message: error instanceof Error ? error.message : "Fetch request failed",
              occurredAt,
              method,
              requestUrl,
              errorName: error instanceof Error ? error.name : void 0,
              stack: error instanceof Error ? error.stack : void 0,
              duration: occurredAt - startedAt,
              ...getBrowserContext()
            });
          }
          throw error;
        }
      };
      patchedFetchRef = patched;
      window.fetch = patched;
    }
    uninstallFetchPatch() {
      if (fetchSubscriberCount <= 0) {
        return;
      }
      fetchSubscriberCount--;
      if (fetchSubscriberCount === 0) {
        if (patchedFetchRef && window.fetch === patchedFetchRef && nativeFetch) {
          window.fetch = nativeFetch;
        }
        delete window[FETCH_PATCH_KEY];
        nativeFetch = null;
        patchedFetchRef = null;
      }
    }
    installXhrPatch() {
      if (typeof XMLHttpRequest === "undefined") {
        return;
      }
      if (!nativeXhrOpen) {
        nativeXhrOpen = XMLHttpRequest.prototype.open;
      }
      if (!nativeXhrSend) {
        nativeXhrSend = XMLHttpRequest.prototype.send;
      }
      xhrSubscriberCount++;
      if (window[XHR_PATCH_KEY]) {
        return;
      }
      window[XHR_PATCH_KEY] = true;
      const capturedOpen = nativeXhrOpen;
      const capturedSend = nativeXhrSend;
      const patchedOpen = function patchedOpen2(method, url) {
        var _a;
        sharedXhrMeta.set(this, {
          method,
          url: (_a = sanitizeErrorUrl(String(url))) != null ? _a : String(url)
        });
        return capturedOpen.apply(this, arguments);
      };
      const patchedSend = function patchedSend2() {
        const xhr = this;
        const startedAt = Date.now();
        const handleLoadEnd = () => {
          if (xhrSubscriberCount === 0) {
            return;
          }
          const meta = sharedXhrMeta.get(xhr);
          if (!meta || xhr.status < 400) {
            return;
          }
          const occurredAt = Date.now();
          queueHttpError({
            type: "http-error",
            requestType: "xhr",
            message: `HTTP request failed: ${xhr.status}`,
            occurredAt,
            method: meta.method,
            requestUrl: meta.url,
            status: xhr.status,
            statusText: xhr.statusText,
            duration: occurredAt - startedAt,
            ...getBrowserContext()
          });
        };
        const handleNetworkError = () => {
          if (xhrSubscriberCount === 0) {
            return;
          }
          const meta = sharedXhrMeta.get(xhr);
          if (!meta) {
            return;
          }
          const occurredAt = Date.now();
          queueHttpError({
            type: "http-error",
            requestType: "xhr",
            message: "XMLHttpRequest failed",
            occurredAt,
            method: meta.method,
            requestUrl: meta.url,
            status: xhr.status || void 0,
            statusText: xhr.statusText || void 0,
            duration: occurredAt - startedAt,
            ...getBrowserContext()
          });
        };
        xhr.addEventListener("loadend", handleLoadEnd, { once: true });
        xhr.addEventListener("error", handleNetworkError, { once: true });
        xhr.addEventListener("timeout", handleNetworkError, { once: true });
        xhr.addEventListener("abort", handleNetworkError, { once: true });
        return capturedSend.apply(this, arguments);
      };
      patchedXhrOpenRef = patchedOpen;
      patchedXhrSendRef = patchedSend;
      XMLHttpRequest.prototype.open = patchedOpen;
      XMLHttpRequest.prototype.send = patchedSend;
    }
    uninstallXhrPatch() {
      if (xhrSubscriberCount <= 0) {
        return;
      }
      xhrSubscriberCount--;
      if (xhrSubscriberCount === 0) {
        if (typeof XMLHttpRequest !== "undefined") {
          if (patchedXhrOpenRef && XMLHttpRequest.prototype.open === patchedXhrOpenRef && nativeXhrOpen) {
            XMLHttpRequest.prototype.open = nativeXhrOpen;
          }
          if (patchedXhrSendRef && XMLHttpRequest.prototype.send === patchedXhrSendRef && nativeXhrSend) {
            XMLHttpRequest.prototype.send = nativeXhrSend;
          }
        }
        delete window[XHR_PATCH_KEY];
        nativeXhrOpen = null;
        nativeXhrSend = null;
        patchedXhrOpenRef = null;
        patchedXhrSendRef = null;
      }
    }
    reportHttpError(payload) {
      if (!this.core) {
        return;
      }
      if (isReportUrlStatic(payload.requestUrl, this.reportUrl)) {
        return;
      }
      this.core.trackEvent("http-error", payload, "urgent", "error");
    }
  }
  function getFetchMethodStatic(input, init) {
    if (init == null ? void 0 : init.method) {
      return init.method;
    }
    if (typeof Request !== "undefined" && input instanceof Request) {
      return input.method;
    }
    return "GET";
  }
  function getFetchUrlStatic(input) {
    if (typeof input === "string") {
      return sanitizeErrorUrl(input);
    }
    if (input instanceof URL) {
      return sanitizeErrorUrl(input.href);
    }
    if (typeof Request !== "undefined" && input instanceof Request) {
      return sanitizeErrorUrl(input.url);
    }
    return void 0;
  }
  const errorReporters = /* @__PURE__ */ new Map();
  function queueHttpError(payload) {
    errorReporters.forEach((reportUrl, reporter) => {
      if (isReportUrlStatic(payload.requestUrl, reportUrl)) {
        return;
      }
      try {
        reporter(payload);
      } catch (e) {
      }
    });
  }

  class ErrorPlugin {
    constructor(options) {
      this.name = "error";
      this.core = null;
      this.handlers = [];
      this.options = options != null ? options : {};
    }
    install(core) {
      var _a, _b;
      this.core = core;
      const cfg = this.options;
      if (cfg.js !== false) {
        this.handlers.push(new JsErrorHandler());
      }
      if (cfg.promise !== false) {
        this.handlers.push(new PromiseErrorHandler());
      }
      if (cfg.resource !== false) {
        this.handlers.push(new ResourceErrorHandler());
      }
      if (cfg.http !== false) {
        this.handlers.push(new HttpErrorHandler(cfg.reportUrl));
      }
      for (const handler of this.handlers) {
        try {
          handler.install(core);
        } catch (error) {
          (_b = (_a = this.options).onError) == null ? void 0 : _b.call(_a, error, "error.install.handler");
        }
      }
    }
    uninstall() {
      for (const handler of this.handlers) {
        try {
          handler.uninstall();
        } catch (e) {
        }
      }
      this.handlers = [];
      this.core = null;
    }
  }

  const BehaviorEventName = {
    CLICK: "behavior_click",
    PAGE_VIEW: "page_view",
    EXPOSURE: "element_exposure"
  };

  const MAX_SELECTORS = 20;
  const MAX_SELECTOR_LENGTH = 256;
  const MAX_ATTRIBUTE_LENGTH = 128;
  const MAX_URL_LENGTH = 2048;
  const IGNORE_SELECTOR = "[data-trace-ignore]";
  function truncateString(value, maxLength = MAX_ATTRIBUTE_LENGTH) {
    if (typeof value !== "string") {
      return void 0;
    }
    const normalized = value.trim();
    if (!normalized) {
      return void 0;
    }
    return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
  }
  function safeGetAttribute(element, attributeName) {
    try {
      return truncateString(element.getAttribute(attributeName));
    } catch (e) {
      return void 0;
    }
  }
  function sanitizeUrl(rawUrl, options) {
    var _a;
    if (!rawUrl) {
      return "";
    }
    try {
      const baseUrl = typeof window !== "undefined" && ((_a = window.location) == null ? void 0 : _a.href) ? window.location.href : "http://tracega.local/";
      const parsedUrl = new URL(rawUrl, baseUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return "";
      }
      parsedUrl.username = "";
      parsedUrl.password = "";
      if (!options.includeQuery) {
        parsedUrl.search = "";
      }
      if (!options.includeHash) {
        parsedUrl.hash = "";
      }
      return parsedUrl.href.slice(0, MAX_URL_LENGTH);
    } catch (e) {
      return "";
    }
  }
  function getCurrentPageUrl(options) {
    var _a;
    if (typeof window === "undefined") {
      return "";
    }
    return sanitizeUrl((_a = window.location) == null ? void 0 : _a.href, options);
  }
  function validateSelectors(selectors) {
    if (!Array.isArray(selectors) || selectors.length === 0) {
      throw new TypeError("selectors must contain at least one CSS selector");
    }
    if (selectors.length > MAX_SELECTORS) {
      throw new RangeError(`selectors cannot contain more than ${MAX_SELECTORS} entries`);
    }
    const normalizedSelectors = Array.from(
      new Set(
        selectors.map((selector) => {
          if (typeof selector !== "string") {
            throw new TypeError("each selector must be a string");
          }
          const normalized = selector.trim();
          if (!normalized) {
            throw new TypeError("selector cannot be empty");
          }
          if (normalized.length > MAX_SELECTOR_LENGTH) {
            throw new RangeError(`selector cannot exceed ${MAX_SELECTOR_LENGTH} characters`);
          }
          return normalized;
        })
      )
    );
    if (typeof document !== "undefined") {
      normalizedSelectors.forEach((selector) => {
        document.querySelector(selector);
      });
    }
    return Object.freeze(normalizedSelectors);
  }
  function validateSelector(selector) {
    return validateSelectors([selector])[0];
  }
  function getSelectorAttributeFilter(selector) {
    const attributes = /* @__PURE__ */ new Set(["data-trace-ignore"]);
    const attributePattern = /\[\s*([a-zA-Z_][\w:.-]*)/g;
    let match;
    while (match = attributePattern.exec(selector)) {
      attributes.add(match[1]);
    }
    if (selector.includes(".")) {
      attributes.add("class");
    }
    if (selector.includes("#")) {
      attributes.add("id");
    }
    const stateAttributes = ["checked", "disabled", "hidden", "open", "required", "selected"];
    stateAttributes.forEach((attribute) => {
      if (selector.includes(`:${attribute}`)) {
        attributes.add(attribute);
      }
    });
    return Array.from(attributes);
  }
  function getEventElements(event) {
    if (typeof Element === "undefined") {
      return [];
    }
    try {
      const eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];
      const candidates = eventPath.length > 0 ? eventPath : [event.target];
      return candidates.filter((candidate) => candidate instanceof Element);
    } catch (e) {
      return event.target instanceof Element ? [event.target] : [];
    }
  }
  function safeMatches(element, selector) {
    try {
      return element.matches(selector);
    } catch (e) {
      return false;
    }
  }
  function findMatchedElement(event, selectors) {
    const elements = getEventElements(event);
    if (elements.some((element) => isIgnoredElement(element))) {
      return null;
    }
    for (const element of elements) {
      for (const selector of selectors) {
        if (safeMatches(element, selector)) {
          return { element, selector };
        }
      }
    }
    return null;
  }
  function isIgnoredElement(element) {
    var _a, _b;
    try {
      let current = element;
      while (current) {
        if ((_a = current.matches) == null ? void 0 : _a.call(current, IGNORE_SELECTOR)) {
          return true;
        }
        const root = (_b = current.getRootNode) == null ? void 0 : _b.call(current);
        current = current.parentElement || (root instanceof ShadowRoot ? root.host : null);
      }
      return false;
    } catch (e) {
      return false;
    }
  }
  const SENSITIVE_ID_PATTERN = /@|password|token|secret|key|auth|credential|ssn|credit|email|phone|mobile|account/i;
  function isSensitiveElementId(id) {
    return SENSITIVE_ID_PATTERN.test(id);
  }
  function getElementMetadata(element, options = {}) {
    var _a;
    let tagName = "unknown";
    try {
      tagName = (_a = truncateString(element.tagName.toLowerCase())) != null ? _a : "unknown";
    } catch (e) {
    }
    let elementId;
    if (options.collectElementId) {
      const rawId = safeGetAttribute(element, "id");
      if (rawId && !isSensitiveElementId(rawId)) {
        elementId = rawId;
      }
    }
    return {
      tagName,
      traceId: safeGetAttribute(element, "data-trace-id"),
      elementId,
      role: safeGetAttribute(element, "role"),
      inputType: safeGetAttribute(element, "type")
    };
  }
  function normalizeIntersectionRatio(ratio) {
    if (!Number.isFinite(ratio)) {
      return 0;
    }
    const boundedRatio = Math.min(1, Math.max(0, ratio));
    return Math.round(boundedRatio * 1e4) / 1e4;
  }

  class ClickTracker {
    constructor(options, reportError) {
      this.options = options;
      this.reportError = reportError;
      this.core = null;
      this.installed = false;
      this.selectors = [];
      this.handleClick = (event) => {
        try {
          if (!this.core) {
            return;
          }
          const matched = findMatchedElement(event, this.selectors);
          if (!matched) {
            return;
          }
          const metadata = getElementMetadata(matched.element, { collectElementId: false });
          const payload = {
            type: "click",
            ...metadata,
            matchedSelector: matched.selector,
            mouseButton: Number.isFinite(event.button) ? event.button : 0,
            pageUrl: getCurrentPageUrl(this.options)
          };
          this.core.trackEvent(BehaviorEventName.CLICK, payload, "high", "click");
        } catch (error) {
          this.reportError(error, "behavior.click.event");
        }
      };
    }
    install(core) {
      if (this.installed || typeof document === "undefined") {
        return;
      }
      this.selectors = validateSelectors(this.options.selectors);
      this.core = core;
      document.addEventListener("click", this.handleClick, {
        capture: true,
        passive: true
      });
      this.installed = true;
    }
    uninstall() {
      if (!this.installed) {
        return;
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("click", this.handleClick, true);
      }
      this.core = null;
      this.selectors = [];
      this.installed = false;
    }
  }

  class ExposureTracker {
    constructor(options, reportError) {
      this.options = options;
      this.reportError = reportError;
      this.core = null;
      this.installed = false;
      this.selector = "";
      this.intersectionObserver = null;
      this.mutationObserver = null;
      this.observedElements = /* @__PURE__ */ new Set();
      this.exposedElements = /* @__PURE__ */ new WeakSet();
      this.pendingAddedNodes = /* @__PURE__ */ new Set();
      this.pendingRemovedNodes = /* @__PURE__ */ new Set();
      this.pendingAttributeElements = /* @__PURE__ */ new Set();
      this.cancelScheduledScan = null;
      this.handleIntersections = (entries) => {
        entries.forEach((entry) => {
          try {
            if (!this.core || !(entry.target instanceof Element) || !entry.isIntersecting || entry.intersectionRatio < this.options.threshold) {
              return;
            }
            const element = entry.target;
            if (!element.isConnected || isIgnoredElement(element)) {
              this.unobserveElement(element);
              return;
            }
            if (this.options.once && this.exposedElements.has(element)) {
              return;
            }
            const metadata = getElementMetadata(element, { collectElementId: false });
            const payload = {
              type: "exposure",
              ...metadata,
              matchedSelector: this.selector,
              intersectionRatio: normalizeIntersectionRatio(entry.intersectionRatio),
              pageUrl: getCurrentPageUrl(this.options)
            };
            this.core.trackEvent(BehaviorEventName.EXPOSURE, payload, "high", "exposure");
            if (this.options.once) {
              this.exposedElements.add(element);
              this.unobserveElement(element);
            }
          } catch (error) {
            this.reportError(error, "behavior.exposure.intersection");
          }
        });
      };
      this.handleMutations = (records) => {
        try {
          records.forEach((record) => {
            if (record.type === "attributes" && record.target instanceof Element) {
              this.pendingAttributeElements.add(record.target);
            }
            record.addedNodes.forEach((node) => {
              this.pendingAddedNodes.add(node);
            });
            record.removedNodes.forEach((node) => {
              this.pendingRemovedNodes.add(node);
            });
          });
          this.scheduleMutationScan();
        } catch (error) {
          this.reportError(error, "behavior.exposure.mutation");
        }
      };
    }
    install(core) {
      var _a;
      if (this.installed || typeof document === "undefined") {
        return;
      }
      this.validateOptions();
      this.selector = validateSelector(this.options.selector);
      this.core = core;
      this.installed = true;
      if (typeof IntersectionObserver === "undefined") {
        return;
      }
      try {
        this.intersectionObserver = new IntersectionObserver(this.handleIntersections, {
          threshold: this.options.threshold,
          rootMargin: this.options.rootMargin
        });
        this.observeInitialElements();
        this.installMutationObserver();
      } catch (error) {
        this.installed = false;
        this.core = null;
        this.selector = "";
        (_a = this.intersectionObserver) == null ? void 0 : _a.disconnect();
        this.intersectionObserver = null;
        throw error;
      }
    }
    uninstall() {
      var _a, _b, _c;
      if (!this.installed) {
        return;
      }
      try {
        (_a = this.mutationObserver) == null ? void 0 : _a.disconnect();
        (_b = this.intersectionObserver) == null ? void 0 : _b.disconnect();
      } finally {
        this.mutationObserver = null;
        this.intersectionObserver = null;
        this.observedElements.clear();
        this.exposedElements = /* @__PURE__ */ new WeakSet();
        this.pendingAddedNodes.clear();
        this.pendingRemovedNodes.clear();
        this.pendingAttributeElements.clear();
        (_c = this.cancelScheduledScan) == null ? void 0 : _c.call(this);
        this.cancelScheduledScan = null;
        this.selector = "";
        this.core = null;
        this.installed = false;
      }
    }
    validateOptions() {
      const { threshold, rootMargin } = this.options;
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
        throw new RangeError("exposure threshold must be between 0 and 1");
      }
      if (typeof rootMargin !== "string" || rootMargin.length > 128) {
        throw new TypeError("exposure rootMargin must be a valid string");
      }
    }
    observeInitialElements() {
      document.querySelectorAll(this.selector).forEach((element) => this.observeElement(element));
    }
    installMutationObserver() {
      if (typeof MutationObserver === "undefined" || !document.documentElement) {
        return;
      }
      this.mutationObserver = new MutationObserver(this.handleMutations);
      this.mutationObserver.observe(document.documentElement, {
        attributeFilter: getSelectorAttributeFilter(this.selector),
        attributes: true,
        childList: true,
        subtree: true
      });
    }
    scheduleMutationScan() {
      if (this.cancelScheduledScan) {
        return;
      }
      const runScan = () => {
        this.cancelScheduledScan = null;
        if (!this.installed) {
          this.pendingAddedNodes.clear();
          this.pendingRemovedNodes.clear();
          this.pendingAttributeElements.clear();
          return;
        }
        try {
          this.pendingRemovedNodes.forEach((node) => {
            this.unobserveNodeTree(node);
          });
          this.pendingAddedNodes.forEach((node) => {
            this.observeNodeTree(node);
          });
          this.getMinimalAttributeRoots().forEach((element) => {
            this.refreshNodeTree(element);
          });
        } catch (error) {
          this.reportError(error, "behavior.exposure.scan");
        } finally {
          this.pendingAddedNodes.clear();
          this.pendingRemovedNodes.clear();
          this.pendingAttributeElements.clear();
        }
      };
      if (typeof requestAnimationFrame === "function") {
        const frameId = requestAnimationFrame(runScan);
        this.cancelScheduledScan = () => cancelAnimationFrame(frameId);
        return;
      }
      const timeoutId = setTimeout(runScan, 0);
      this.cancelScheduledScan = () => clearTimeout(timeoutId);
    }
    getMinimalAttributeRoots() {
      const roots = Array.from(this.pendingAttributeElements).filter((element) => element.isConnected);
      return roots.filter((element) => !roots.some((other) => other !== element && other.contains(element)));
    }
    observeNodeTree(node) {
      if (!(node instanceof Element)) {
        return;
      }
      if (this.safeMatches(node)) {
        this.observeElement(node);
      }
      node.querySelectorAll(this.selector).forEach((element) => this.observeElement(element));
    }
    unobserveNodeTree(node) {
      if (!(node instanceof Element)) {
        return;
      }
      Array.from(this.observedElements).forEach((element) => {
        if (element === node || node.contains(element)) {
          this.unobserveElement(element);
        }
      });
    }
    refreshNodeTree(root) {
      Array.from(this.observedElements).forEach((element) => {
        if ((element === root || root.contains(element)) && (!element.isConnected || !this.safeMatches(element) || isIgnoredElement(element))) {
          this.unobserveElement(element);
        }
      });
      if (!root.isConnected) {
        return;
      }
      this.observeNodeTree(root);
    }
    observeElement(element) {
      if (!this.intersectionObserver || this.observedElements.has(element) || isIgnoredElement(element) || this.options.once && this.exposedElements.has(element)) {
        return;
      }
      this.intersectionObserver.observe(element);
      this.observedElements.add(element);
    }
    unobserveElement(element) {
      var _a;
      if (!this.observedElements.has(element)) {
        return;
      }
      try {
        (_a = this.intersectionObserver) == null ? void 0 : _a.unobserve(element);
      } finally {
        this.observedElements.delete(element);
      }
    }
    safeMatches(element) {
      try {
        return element.matches(this.selector);
      } catch (e) {
        return false;
      }
    }
  }

  const listeners = /* @__PURE__ */ new Set();
  let originalPushState = null;
  let originalReplaceState = null;
  let wrappedPushState = null;
  let wrappedReplaceState = null;
  let lastKnownUrl = "";
  function readCurrentUrl() {
    try {
      return window.location.href;
    } catch (e) {
      return "";
    }
  }
  function notifyRouteChange(navigationType, previousUrl = lastKnownUrl) {
    const pageUrl = readCurrentUrl();
    if (!pageUrl || pageUrl === previousUrl) {
      lastKnownUrl = pageUrl || lastKnownUrl;
      return;
    }
    lastKnownUrl = pageUrl;
    const change = {
      navigationType,
      previousUrl,
      pageUrl
    };
    Array.from(listeners).forEach((listener) => {
      try {
        listener(change);
      } catch (e) {
      }
    });
  }
  const handlePopState = () => {
    notifyRouteChange("popstate");
  };
  const handleHashChange = (event) => {
    notifyRouteChange("hashchange", event.oldURL || lastKnownUrl);
  };
  function installRouteObserver() {
    if (typeof window === "undefined" || typeof history === "undefined") {
      return;
    }
    lastKnownUrl = readCurrentUrl();
    const capturedPushState = history.pushState;
    const capturedReplaceState = history.replaceState;
    originalPushState = capturedPushState;
    originalReplaceState = capturedReplaceState;
    wrappedPushState = function patchedPushState(data, unused, url) {
      const previousUrl = readCurrentUrl();
      capturedPushState.call(this, data, unused, url);
      notifyRouteChange("pushState", previousUrl);
    };
    wrappedReplaceState = function patchedReplaceState(data, unused, url) {
      const previousUrl = readCurrentUrl();
      capturedReplaceState.call(this, data, unused, url);
      notifyRouteChange("replaceState", previousUrl);
    };
    try {
      history.pushState = wrappedPushState;
      history.replaceState = wrappedReplaceState;
      window.addEventListener("popstate", handlePopState);
      window.addEventListener("hashchange", handleHashChange);
    } catch (error) {
      if (wrappedPushState && history.pushState === wrappedPushState) {
        history.pushState = capturedPushState;
      }
      if (wrappedReplaceState && history.replaceState === wrappedReplaceState) {
        history.replaceState = capturedReplaceState;
      }
      originalPushState = null;
      originalReplaceState = null;
      wrappedPushState = null;
      wrappedReplaceState = null;
      lastKnownUrl = "";
      throw error;
    }
  }
  function uninstallRouteObserver() {
    if (typeof window === "undefined" || typeof history === "undefined") {
      return;
    }
    window.removeEventListener("popstate", handlePopState);
    window.removeEventListener("hashchange", handleHashChange);
    if (originalPushState && wrappedPushState && history.pushState === wrappedPushState) {
      history.pushState = originalPushState;
    }
    if (originalReplaceState && wrappedReplaceState && history.replaceState === wrappedReplaceState) {
      history.replaceState = originalReplaceState;
    }
    originalPushState = null;
    originalReplaceState = null;
    wrappedPushState = null;
    wrappedReplaceState = null;
    lastKnownUrl = "";
  }
  function subscribeRouteChanges(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("route listener must be a function");
    }
    if (typeof window === "undefined" || typeof history === "undefined") {
      return () => void 0;
    }
    listeners.add(listener);
    if (listeners.size === 1) {
      try {
        installRouteObserver();
      } catch (error) {
        listeners.delete(listener);
        throw error;
      }
    }
    let subscribed = true;
    return () => {
      if (!subscribed) {
        return;
      }
      subscribed = false;
      listeners.delete(listener);
      if (listeners.size === 0) {
        uninstallRouteObserver();
      }
    };
  }

  class PageViewTracker {
    constructor(options, reportError) {
      this.options = options;
      this.reportError = reportError;
      this.core = null;
      this.installed = false;
      this.currentPageUrl = "";
      this.unsubscribeRoute = null;
      this.handleRouteChange = (change) => {
        try {
          const pageUrl = sanitizeUrl(change.pageUrl, this.options);
          if (!pageUrl || pageUrl === this.currentPageUrl) {
            return;
          }
          const previousUrl = this.currentPageUrl || sanitizeUrl(change.previousUrl, this.options);
          this.currentPageUrl = pageUrl;
          this.trackPageView(change.navigationType, pageUrl, previousUrl || void 0);
        } catch (error) {
          this.reportError(error, "behavior.pageView.route");
        }
      };
    }
    install(core) {
      if (this.installed || typeof window === "undefined") {
        return;
      }
      this.core = core;
      this.currentPageUrl = getCurrentPageUrl(this.options);
      this.unsubscribeRoute = subscribeRouteChanges(this.handleRouteChange);
      this.installed = true;
      if (this.options.trackInitial) {
        const previousUrl = typeof document !== "undefined" ? sanitizeUrl(document.referrer, this.options) : "";
        this.trackPageView("initial", this.currentPageUrl, previousUrl || void 0);
      }
    }
    uninstall() {
      var _a;
      if (!this.installed) {
        return;
      }
      try {
        (_a = this.unsubscribeRoute) == null ? void 0 : _a.call(this);
      } finally {
        this.unsubscribeRoute = null;
        this.currentPageUrl = "";
        this.core = null;
        this.installed = false;
      }
    }
    trackPageView(navigationType, pageUrl, previousUrl) {
      try {
        if (!this.core || !pageUrl) {
          return;
        }
        const payload = {
          type: "page_view",
          pageUrl,
          previousUrl,
          navigationType
        };
        this.core.trackEvent(BehaviorEventName.PAGE_VIEW, payload, "high", "page_view");
      } catch (error) {
        this.reportError(error, "behavior.pageView.track");
      }
    }
  }

  const DEFAULT_CLICK_SELECTORS = Object.freeze(["button", "a", "input", "select", "textarea", '[role="button"]', "[data-trace-id]"]);
  class BehaviorPlugin {
    constructor(options = {}) {
      this.name = "BehaviorPlugin";
      this.installed = false;
      this.activeTrackers = [];
      this.reportError = (error, context) => {
        var _a, _b;
        try {
          (_b = (_a = this.options).onError) == null ? void 0 : _b.call(_a, error, context);
        } catch (e) {
        }
      };
      this.options = this.resolveOptions(options);
    }
    install(core) {
      if (this.installed) {
        return;
      }
      if (typeof window === "undefined" || typeof document === "undefined") {
        return;
      }
      try {
        if (!core || typeof core.trackEvent !== "function") {
          throw new TypeError("BehaviorPlugin requires a valid TraceCore");
        }
      } catch (error) {
        this.reportError(error, "behavior.install.core");
        return;
      }
      this.installed = true;
      const trackers = this.createTrackers();
      trackers.forEach((tracker) => {
        try {
          tracker.install(core);
          this.activeTrackers.push(tracker);
        } catch (error) {
          this.reportError(error, "behavior.install.tracker");
        }
      });
    }
    uninstall() {
      if (!this.installed) {
        return;
      }
      const trackers = [...this.activeTrackers].reverse();
      this.activeTrackers = [];
      this.installed = false;
      trackers.forEach((tracker) => {
        try {
          tracker.uninstall();
        } catch (error) {
          this.reportError(error, "behavior.uninstall.tracker");
        }
      });
    }
    createTrackers() {
      const trackers = [];
      if (this.options.click) {
        trackers.push(new ClickTracker(this.options.click, this.reportError));
      }
      if (this.options.pageView) {
        trackers.push(new PageViewTracker(this.options.pageView, this.reportError));
      }
      if (this.options.exposure) {
        trackers.push(new ExposureTracker(this.options.exposure, this.reportError));
      }
      return trackers;
    }
    resolveOptions(options) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
      const click = options.click === false ? false : Object.freeze({
        selectors: Object.freeze([...(_b = (_a = options.click) == null ? void 0 : _a.selectors) != null ? _b : DEFAULT_CLICK_SELECTORS]),
        includeQuery: (_d = (_c = options.click) == null ? void 0 : _c.includeQuery) != null ? _d : false,
        includeHash: (_f = (_e = options.click) == null ? void 0 : _e.includeHash) != null ? _f : false
      });
      const pageView = options.pageView === false ? false : Object.freeze({
        trackInitial: (_h = (_g = options.pageView) == null ? void 0 : _g.trackInitial) != null ? _h : true,
        includeQuery: (_j = (_i = options.pageView) == null ? void 0 : _i.includeQuery) != null ? _j : false,
        includeHash: (_l = (_k = options.pageView) == null ? void 0 : _k.includeHash) != null ? _l : false
      });
      const exposure = options.exposure === false ? false : Object.freeze({
        selector: (_n = (_m = options.exposure) == null ? void 0 : _m.selector) != null ? _n : "[data-trace-exposure]",
        threshold: (_p = (_o = options.exposure) == null ? void 0 : _o.threshold) != null ? _p : 0.5,
        rootMargin: (_r = (_q = options.exposure) == null ? void 0 : _q.rootMargin) != null ? _r : "0px",
        once: (_t = (_s = options.exposure) == null ? void 0 : _s.once) != null ? _t : true,
        includeQuery: (_v = (_u = options.exposure) == null ? void 0 : _u.includeQuery) != null ? _v : false,
        includeHash: (_x = (_w = options.exposure) == null ? void 0 : _w.includeHash) != null ? _x : false
      });
      return Object.freeze({
        click,
        pageView,
        exposure,
        onError: typeof options.onError === "function" ? options.onError : void 0
      });
    }
  }

  const PERFORMANCE_EVENT_NAME = "performance";
  var PerformanceMetricName = /* @__PURE__ */ ((PerformanceMetricName2) => {
    PerformanceMetricName2["FCP"] = "FCP";
    PerformanceMetricName2["LCP"] = "LCP";
    PerformanceMetricName2["CLS"] = "CLS";
    return PerformanceMetricName2;
  })(PerformanceMetricName || {});

  class PerformancePlugin {
    constructor(config = {}) {
      this.name = "PerformancePlugin";
      this.installed = false;
      this.core = null;
      this.observers = [];
      this.clsValue = 0;
      this.lcpValue = null;
      this.config = {
        webVitals: true,
        resource: false,
        ...config
      };
    }
    install(core) {
      if (this.installed) {
        return;
      }
      this.core = core;
      this.installed = true;
      if (this.config.resource) {
        console.warn("[TraceGA] PerformancePlugin: resource tracking is not yet implemented. The `resource` config option has no effect.");
      }
      if (!this.config.webVitals) {
        return;
      }
      try {
        this.observeFCP();
        this.observeLCP();
        this.observeCLS();
      } catch (e) {
        this.uninstall();
      }
    }
    uninstall() {
      if (!this.installed) {
        return;
      }
      this.observers.forEach((observer) => {
        try {
          observer.disconnect();
        } catch (e) {
        }
      });
      this.observers = [];
      this.core = null;
      this.clsValue = 0;
      this.lcpValue = null;
      this.installed = false;
    }
    observeFCP() {
      if (!this.canUsePerformanceObserver()) {
        this.reportExistingFCP();
        return;
      }
      const observer = new PerformanceObserver((list) => {
        try {
          const entry = list.getEntries().find((item) => item.name === "first-contentful-paint");
          if (!entry) {
            return;
          }
          this.reportMetric(PerformanceMetricName.FCP, entry.startTime);
          observer.disconnect();
        } catch (e) {
        }
      });
      this.observe(observer, { type: "paint", buffered: true });
    }
    observeLCP() {
      if (!this.canUsePerformanceObserver()) {
        return;
      }
      const observer = new PerformanceObserver((list) => {
        try {
          const entries = list.getEntries();
          const latest = entries[entries.length - 1];
          if (!latest) {
            return;
          }
          this.lcpValue = latest.startTime;
          this.reportMetric(PerformanceMetricName.LCP, latest.startTime);
        } catch (e) {
        }
      });
      this.observe(observer, { type: "largest-contentful-paint", buffered: true });
    }
    observeCLS() {
      if (!this.canUsePerformanceObserver()) {
        return;
      }
      const observer = new PerformanceObserver((list) => {
        try {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (!entry.hadRecentInput) {
              this.clsValue += entry.value;
            }
          });
          this.reportMetric(PerformanceMetricName.CLS, this.clsValue);
        } catch (e) {
        }
      });
      this.observe(observer, { type: "layout-shift", buffered: true });
    }
    reportExistingFCP() {
      if (typeof performance === "undefined" || typeof performance.getEntriesByName !== "function") {
        return;
      }
      try {
        const [entry] = performance.getEntriesByName("first-contentful-paint");
        if (entry) {
          this.reportMetric(PerformanceMetricName.FCP, entry.startTime);
        }
      } catch (e) {
      }
    }
    observe(observer, options) {
      try {
        observer.observe(options);
        this.observers.push(observer);
      } catch (e) {
        try {
          observer.disconnect();
        } catch (e2) {
        }
      }
    }
    reportMetric(metric, value) {
      if (!this.core) {
        return;
      }
      const payload = {
        metric,
        value,
        timestamp: Date.now()
      };
      this.core.trackEvent(PERFORMANCE_EVENT_NAME, payload, "normal", "performance");
    }
    canUsePerformanceObserver() {
      return typeof PerformanceObserver !== "undefined";
    }
  }

  const EXCLUDED_TAGS = /* @__PURE__ */ new Set(["SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT", "BR", "HR"]);
  const PIXEL_SAMPLE_HEIGHT = 100;
  const PIXEL_SAMPLE_MAX_WIDTH = 800;
  const DEFAULT_DETECT_ROUNDS = Object.freeze([3e3, 6e3, 1e4]);
  const DEFAULT_CONFIG$1 = {
    threshold: 2,
    sampleRate: 1,
    loadDetectDelay: 1e3,
    detectRounds: [...DEFAULT_DETECT_ROUNDS],
    pixelVarianceThreshold: 100,
    enablePixelCompare: false,
    minElementArea: 2500,
    reportPriority: "high"
  };
  class WhiteScreenPlugin {
    constructor(config = {}) {
      this.name = "WhiteScreenPlugin";
      this.core = null;
      this.installed = false;
      this.hasReportedWhiteScreen = false;
      this.hasReportedRecovered = false;
      this.timers = [];
      this.onDomReady = null;
      this.onLoad = null;
      this.domReadyFired = false;
      this.loadFired = false;
      this.config = { ...DEFAULT_CONFIG$1, ...config };
    }
    // ─── 公开 API ───
    /** 安装插件，注册事件监听并启动白屏检测。 */
    install(core) {
      if (this.installed)
        return;
      if (typeof window === "undefined" || typeof document === "undefined")
        return;
      this.core = core;
      this.installed = true;
      this.resetState();
      if (this.shouldSkipBySampleRate())
        return;
      this.bindEvents();
    }
    /** 卸载插件，清除所有定时器和事件监听。 */
    uninstall() {
      if (!this.installed)
        return;
      this.clearAllTimers();
      this.unbindEvents();
      this.core = null;
      this.installed = false;
      this.resetState();
    }
    // ─── 事件绑定 ───
    bindEvents() {
      const state = document.readyState;
      if (state === "complete" || state === "interactive") {
        this.onDomReadyHandler();
      } else {
        this.onDomReady = () => this.onDomReadyHandler();
        document.addEventListener("DOMContentLoaded", this.onDomReady);
      }
      if (state === "complete") {
        this.onLoadHandler();
      } else {
        this.onLoad = () => this.onLoadHandler();
        window.addEventListener("load", this.onLoad);
      }
    }
    unbindEvents() {
      if (this.onDomReady) {
        document.removeEventListener("DOMContentLoaded", this.onDomReady);
        this.onDomReady = null;
      }
      if (this.onLoad) {
        window.removeEventListener("load", this.onLoad);
        this.onLoad = null;
      }
    }
    // ─── 事件处理 ───
    onDomReadyHandler() {
      if (this.domReadyFired)
        return;
      this.domReadyFired = true;
      this.scheduleRounds();
    }
    onLoadHandler() {
      if (this.loadFired)
        return;
      this.loadFired = true;
      this.scheduleTimer(this.config.loadDetectDelay);
    }
    // ─── 调度 ───
    scheduleRounds() {
      for (const delay of this.config.detectRounds) {
        this.scheduleTimer(delay);
      }
    }
    scheduleTimer(delay) {
      this.timers.push(setTimeout(() => this.performDetection(), delay));
    }
    // ─── 核心检测 ───
    performDetection() {
      if (!this.installed)
        return;
      const result = this.detectByElementCount();
      if (result.isWhiteScreen) {
        this.handleWhiteScreen(result);
      } else {
        this.handleRecovery(result);
      }
    }
    handleWhiteScreen(result) {
      if (this.hasReportedWhiteScreen)
        return;
      this.hasReportedWhiteScreen = true;
      this.hasReportedRecovered = false;
      this.reportEvent("white_screen", result);
    }
    handleRecovery(result) {
      if (!this.hasReportedWhiteScreen || this.hasReportedRecovered)
        return;
      this.hasReportedRecovered = true;
      this.reportEvent("white_screen_recovered", result);
    }
    // ─── 策略一：元素数量法 ───
    detectByElementCount() {
      var _a, _b;
      const elements = (_b = (_a = document.body) == null ? void 0 : _a.querySelectorAll("*")) != null ? _b : [];
      let count = 0;
      for (const el of elements) {
        if (EXCLUDED_TAGS.has(el.tagName))
          continue;
        if (!this.isElementVisible(el))
          continue;
        if (!this.isElementLargeEnough(el))
          continue;
        count++;
      }
      const isWhiteScreen = count < this.config.threshold;
      if (!isWhiteScreen || !this.config.enablePixelCompare) {
        return { isWhiteScreen, elementCount: count, detectMethod: "elementCount" };
      }
      const pixel = this.detectByPixelCompare();
      return {
        isWhiteScreen: pixel.isWhiteScreen,
        elementCount: count,
        detectMethod: "pixelCompare"
      };
    }
    // ─── 策略二：像素对比法 ───
    detectByPixelCompare() {
      if (!document.body)
        return { isWhiteScreen: false, variance: 0 };
      try {
        const canvas = document.createElement("canvas");
        const w = Math.min(window.innerWidth, PIXEL_SAMPLE_MAX_WIDTH);
        const h = PIXEL_SAMPLE_HEIGHT;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx)
          return { isWhiteScreen: false, variance: 0 };
        const bgColor = window.getComputedStyle(document.body).backgroundColor || "#ffffff";
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);
        const variance = this.calcPixelVariance(ctx.getImageData(0, 0, w, h).data);
        return {
          isWhiteScreen: variance < this.config.pixelVarianceThreshold,
          variance: Math.round(variance)
        };
      } catch (e) {
        return { isWhiteScreen: false, variance: 0 };
      }
    }
    /** 计算像素数据的灰度方差 */
    calcPixelVariance(pixels) {
      const grayValues = [];
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
    isElementVisible(el) {
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    }
    isElementLargeEnough(el) {
      const { width, height } = el.getBoundingClientRect();
      return width * height > this.config.minElementArea;
    }
    // ─── 上报 ───
    reportEvent(eventName, result) {
      if (!this.core)
        return;
      this.core.trackEvent(
        eventName,
        {
          detectMethod: result.detectMethod,
          elementCount: result.elementCount,
          viewWidth: window.innerWidth,
          viewHeight: window.innerHeight,
          url: location.href,
          timestamp: Date.now()
        },
        this.config.reportPriority,
        "error"
      );
    }
    // ─── 工具 ───
    shouldSkipBySampleRate() {
      return this.config.sampleRate < 1 && Math.random() > this.config.sampleRate;
    }
    resetState() {
      this.hasReportedWhiteScreen = false;
      this.hasReportedRecovered = false;
      this.domReadyFired = false;
      this.loadFired = false;
    }
    clearAllTimers() {
      for (const timer of this.timers) {
        clearTimeout(timer);
      }
      this.timers.length = 0;
    }
  }

  const MAX_RETRY_ATTEMPTS = 2;
  function getBatchUrl(reportUrl) {
    var _a;
    const baseUrl = typeof window !== "undefined" && ((_a = window.location) == null ? void 0 : _a.href) ? window.location.href : "http://tracega.local/";
    const parsedUrl = new URL(reportUrl, baseUrl);
    if (!parsedUrl.pathname.endsWith("/batch")) {
      parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/$/, "")}/batch`;
    }
    parsedUrl.hash = "";
    return parsedUrl.href;
  }
  class DefaultReporter {
    constructor(config, handleError) {
      this.handleError = handleError;
      this.eventQueue = [];
      this.jobQueue = [];
      this.activeJobs = 0;
      this.timer = null;
      this.destroyed = false;
      this.transportUnavailableReported = false;
      this.handlePageHide = () => {
        this.flushWithBeacon();
      };
      this.handleVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
          this.flushWithBeacon();
        }
      };
      this.batchUrl = getBatchUrl(config.reportUrl);
      this.maxBufferSize = config.maxBufferSize;
      this.flushInterval = config.flushInterval;
      this.maxConcurrentRequests = config.maxConcurrentRequests;
      this.fetchImpl = this.captureFetch();
      if (typeof window !== "undefined") {
        window.addEventListener("pagehide", this.handlePageHide);
      }
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
      }
    }
    report(event, priority) {
      if (this.destroyed) {
        return;
      }
      if (!this.fetchImpl && !this.canUseBeacon()) {
        if (!this.transportUnavailableReported) {
          this.transportUnavailableReported = true;
          this.handleError(new Error("TraceGA reporting requires fetch or sendBeacon"), "report.transport.unavailable");
        }
        return;
      }
      this.eventQueue.push(deepClone(event));
      if (priority === "urgent" || this.eventQueue.length >= this.maxBufferSize) {
        this.flush();
        return;
      }
      this.scheduleFlush(this.flushInterval);
    }
    flush() {
      if (this.destroyed || !this.fetchImpl && !this.canUseBeacon()) {
        return;
      }
      this.clearTimer();
      this.createBatchJobs();
      this.pumpJobs();
    }
    /** 清空队列、销毁 reporter，返回未发送的事件列表 */
    drainEvents() {
      this.clearTimer();
      const drained = [];
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        drained.push({ event, priority: "normal" });
      }
      while (this.jobQueue.length > 0) {
        const job = this.jobQueue.shift();
        job.events.forEach((event) => {
          drained.push({ event, priority: "normal" });
        });
      }
      this.destroyed = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("pagehide", this.handlePageHide);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", this.handleVisibilityChange);
      }
      return drained;
    }
    destroy() {
      if (this.destroyed) {
        return;
      }
      this.flushWithBeacon();
      this.destroyed = true;
      this.clearTimer();
      if (typeof window !== "undefined") {
        window.removeEventListener("pagehide", this.handlePageHide);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", this.handleVisibilityChange);
      }
      this.eventQueue = [];
      this.jobQueue = [];
    }
    captureFetch() {
      if (typeof window !== "undefined" && typeof window.fetch === "function") {
        return window.fetch.bind(window);
      }
      return null;
    }
    createBatchJobs() {
      while (this.eventQueue.length > 0) {
        this.jobQueue.push({
          attempts: 0,
          events: this.eventQueue.splice(0, this.maxBufferSize)
        });
      }
    }
    pumpJobs() {
      if (this.destroyed) {
        return;
      }
      if (!this.fetchImpl) {
        if (this.canUseBeacon()) {
          this.sendJobsWithBeacon();
        }
        return;
      }
      while (this.activeJobs < this.maxConcurrentRequests && this.jobQueue.length > 0) {
        const job = this.jobQueue.shift();
        if (!job) {
          break;
        }
        this.activeJobs += 1;
        void this.sendJob(job).finally(() => {
          this.activeJobs -= 1;
          if (this.jobQueue.length > 0) {
            this.pumpJobs();
          } else if (this.eventQueue.length > 0) {
            this.scheduleFlush(this.flushInterval);
          }
        });
      }
    }
    async sendJob(job) {
      try {
        const response = await this.fetchImpl(this.batchUrl, {
          body: safeJsonStringify({ events: job.events }),
          headers: { "content-type": "application/json" },
          keepalive: true,
          method: "POST"
        });
        if (!response.ok) {
          throw new Error(`TraceGA report failed with status ${response.status}`);
        }
        try {
          const body = await response.clone().json();
          if (body && typeof body === "object" && body.failedCount > 0) {
            const reasons = Array.isArray(body.failures) ? body.failures.map((f) => {
              var _a, _b;
              return `${(_a = f.index) != null ? _a : "?"}:${(_b = f.reason) != null ? _b : "unknown"}`;
            }).join("; ") : `failedCount=${body.failedCount}`;
            this.handleError(new Error(`TraceGA batch partial failure: ${reasons}`), "report.transport");
          }
        } catch (e) {
        }
      } catch (error) {
        if (!this.destroyed && job.attempts < MAX_RETRY_ATTEMPTS) {
          const attempts = job.attempts + 1;
          this.jobQueue.push({ ...job, attempts });
          return;
        }
        this.handleError(error, "report.transport");
      }
    }
    scheduleFlush(delay) {
      if (this.destroyed || this.timer) {
        return;
      }
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flush();
      }, delay);
    }
    clearTimer() {
      if (!this.timer) {
        return;
      }
      clearTimeout(this.timer);
      this.timer = null;
    }
    canUseBeacon() {
      return typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function";
    }
    flushWithBeacon() {
      if (this.destroyed)
        return;
      this.clearTimer();
      this.createBatchJobs();
      if (!this.canUseBeacon()) {
        this.sendJobsWithFetch();
        return;
      }
      const unsentJobs = [];
      this.jobQueue.forEach((job) => {
        try {
          const payload = safeJsonStringify({ events: job.events });
          const body = new Blob([payload], { type: "application/json" });
          if (!navigator.sendBeacon(this.batchUrl, body)) {
            unsentJobs.push(job);
          }
        } catch (error) {
          unsentJobs.push(job);
          this.handleError(error, "report.beacon");
        }
      });
      this.jobQueue = unsentJobs;
      if (this.jobQueue.length > 0) {
        this.scheduleFlush(this.flushInterval);
      }
    }
    /** 降级方案：使用 sendBeacon 发送所有 job（pumpJobs 中 fetch 不可用时的兜底） */
    sendJobsWithBeacon() {
      const unsentJobs = [];
      this.jobQueue.forEach((job) => {
        try {
          const payload = safeJsonStringify({ events: job.events });
          const body = new Blob([payload], { type: "application/json" });
          if (!navigator.sendBeacon(this.batchUrl, body)) {
            unsentJobs.push(job);
          }
        } catch (error) {
          unsentJobs.push(job);
          this.handleError(error, "report.beacon");
        }
      });
      this.jobQueue = unsentJobs;
      if (this.jobQueue.length > 0) {
        this.scheduleFlush(this.flushInterval);
      }
    }
    /** 降级方案：使用 fetch + keepalive 发送所有 job */
    sendJobsWithFetch() {
      if (!this.fetchImpl) {
        this.handleError(new Error("TraceGA: no transport available (fetch + beacon both missing)"), "report.transport.unavailable");
        return;
      }
      this.jobQueue.forEach((job) => {
        try {
          this.fetchImpl(this.batchUrl, {
            body: safeJsonStringify({ events: job.events }),
            headers: { "content-type": "application/json" },
            keepalive: true,
            method: "POST"
          }).catch((error) => {
            this.handleError(error, "report.beacon.fallback");
          });
        } catch (error) {
          this.handleError(error, "report.beacon.fallback");
        }
      });
      this.jobQueue = [];
    }
  }

  const DEFAULT_CONFIG = {
    sampleRate: 1,
    maxBufferSize: 20,
    flushInterval: 3e3,
    maxConcurrentRequests: 3,
    enableAutoError: false,
    enableDebug: false,
    includeUrlQuery: false,
    includeUrlHash: false
  };
  const MAX_BATCH_SIZE = 20;
  class TraceCore {
    constructor() {
      this.config = null;
      this.commonParams = /* @__PURE__ */ Object.create(null);
      this.envInfo = null;
      this.reporter = null;
      this.managedReporter = null;
      this.reporterOverridden = false;
      this.errorPlugin = null;
      this.behaviorPlugin = null;
      this.performancePlugin = null;
      this.whiteScreenPlugin = null;
    }
    register(config) {
      let hooks;
      try {
        hooks = this.resolveHooks(config);
        this.assertConfig(config);
        const resolvedConfig = Object.freeze({
          ...DEFAULT_CONFIG,
          appId: this.resolveAppId(config),
          reportUrl: config.reportUrl.trim(),
          sampleRate: this.resolveSampleRate(config.sampleRate, DEFAULT_CONFIG.sampleRate),
          maxBufferSize: this.resolveBufferSize(config.maxBufferSize, DEFAULT_CONFIG.maxBufferSize),
          flushInterval: this.resolvePositiveInteger(config.flushInterval, DEFAULT_CONFIG.flushInterval, "flushInterval"),
          maxConcurrentRequests: this.resolvePositiveInteger(config.maxConcurrentRequests, DEFAULT_CONFIG.maxConcurrentRequests, "maxConcurrentRequests"),
          enableAutoError: this.resolveBoolean(config.enableAutoError, DEFAULT_CONFIG.enableAutoError, "enableAutoError"),
          enableDebug: this.resolveBoolean(config.enableDebug, DEFAULT_CONFIG.enableDebug, "enableDebug"),
          includeUrlQuery: this.resolveBoolean(config.includeUrlQuery, DEFAULT_CONFIG.includeUrlQuery, "includeUrlQuery"),
          includeUrlHash: this.resolveBoolean(config.includeUrlHash, DEFAULT_CONFIG.includeUrlHash, "includeUrlHash"),
          plugins: this.resolvePluginConfig(config.plugins, "plugins"),
          errorPlugin: this.resolvePluginConfig(config.errorPlugin, "errorPlugin"),
          eventPlugin: this.resolvePluginConfig(config.eventPlugin, "eventPlugin"),
          performancePlugin: this.resolvePluginConfig(config.performancePlugin, "performancePlugin"),
          whiteScreenPlugin: this.resolvePluginConfig(config.whiteScreenPlugin, "whiteScreenPlugin"),
          hooks: Object.freeze(hooks)
        });
        this.disposeBuiltinPlugins();
        const pendingEvents = this.drainManagedReporter();
        this.config = resolvedConfig;
        this.envInfo = collectEnvInfo(this.getEnvCollectionOptions());
        this.configureManagedReporter(resolvedConfig);
        if (pendingEvents.length > 0 && this.reporter) {
          for (const { event, priority } of pendingEvents) {
            try {
              this.reporter.report(event, priority);
            } catch (e) {
            }
          }
        }
        this.syncBuiltinPlugins(resolvedConfig);
        const configSnapshot = deepClone(resolvedConfig);
        this.runHook(() => {
          var _a, _b;
          return (_b = (_a = resolvedConfig.hooks).onReady) == null ? void 0 : _b.call(_a, configSnapshot);
        }, "onReady");
      } catch (error) {
        this.handleError(error, "register", hooks);
      }
    }
    // Supports two signatures:
    // New: trackEvent(eventName, params?, priority?, eventType?)
    // Old (compat): trackEvent(eventType, eventName, params?)
    trackEvent(arg1, arg2 = {}, arg3 = "normal", arg4 = "custom") {
      var _a, _b, _c, _d;
      try {
        let eventName;
        let params;
        let priority;
        let eventType;
        if (typeof arg2 === "string") {
          eventType = arg1;
          eventName = arg2;
          params = typeof arg3 === "object" && arg3 !== null ? arg3 : {};
          priority = "normal";
        } else {
          eventName = arg1;
          params = arg2;
          priority = typeof arg3 === "string" ? arg3 : "normal";
          eventType = arg4;
        }
        if (!this.config || !this.envInfo) {
          return;
        }
        const normalizedEventName = eventName == null ? void 0 : eventName.trim();
        if (!normalizedEventName) {
          throw new TypeError("eventName must be a non-empty string");
        }
        if (!isPlainObject(params)) {
          throw new TypeError("params must be a plain object");
        }
        if (!["urgent", "high", "normal"].includes(priority)) {
          throw new TypeError("priority must be urgent, high, or normal");
        }
        const normalizedEventType = this.resolveEventType(eventType);
        if (!this.shouldSample()) {
          return;
        }
        const currentEnvInfo = refreshEnvInfo(this.envInfo, this.getEnvCollectionOptions());
        this.envInfo = currentEnvInfo;
        const commonParams = this.getCommonParams();
        const properties = this.buildProperties(commonParams, params, currentEnvInfo);
        let event = {
          eventType: normalizedEventType,
          eventName: normalizedEventName,
          appId: this.config.appId,
          userId: this.readIdentity(commonParams, ["userId", "user_id"]),
          sessionId: this.readIdentity(commonParams, ["sessionId", "session_id"]),
          properties,
          timestamp: Date.now(),
          url: (_a = this.readEventLocation(params, "pageUrl")) != null ? _a : currentEnvInfo.url,
          referrer: (_b = this.readEventLocation(params, "previousUrl")) != null ? _b : currentEnvInfo.referrer
        };
        const beforeTrackResult = (_d = (_c = this.config.hooks).onBeforeTrack) == null ? void 0 : _d.call(_c, event);
        if (beforeTrackResult === false) {
          return;
        }
        if (beforeTrackResult) {
          event = beforeTrackResult;
        }
        event = this.normalizeEvent(event);
        this.report(event, priority);
        this.runHook(() => {
          var _a2, _b2, _c2;
          return (_c2 = (_a2 = this.config) == null ? void 0 : (_b2 = _a2.hooks).onTrack) == null ? void 0 : _c2.call(_b2, event);
        }, "onTrack");
      } catch (error) {
        this.handleError(error, "trackEvent");
      }
    }
    addCommonParams(params) {
      try {
        if (!isPlainObject(params)) {
          throw new TypeError("common params must be a plain object");
        }
        const clonedParams = deepClone(params);
        Object.keys(clonedParams).forEach((key) => {
          const descriptor = Object.getOwnPropertyDescriptor(clonedParams, key);
          if (!descriptor || !("value" in descriptor)) {
            throw new TypeError("common params cannot contain accessor properties");
          }
          Object.defineProperty(this.commonParams, key, {
            configurable: true,
            enumerable: true,
            value: descriptor.value,
            writable: true
          });
        });
      } catch (error) {
        this.handleError(error, "addCommonParams");
      }
    }
    removeCommonParams(keys) {
      try {
        if (!Array.isArray(keys)) {
          throw new TypeError("keys must be an array");
        }
        keys.forEach((key) => {
          if (typeof key === "string") {
            delete this.commonParams[key];
          }
        });
      } catch (error) {
        this.handleError(error, "removeCommonParams");
      }
    }
    getCommonParams() {
      try {
        return deepClone(this.commonParams);
      } catch (error) {
        this.handleError(error, "getCommonParams");
        return /* @__PURE__ */ Object.create(null);
      }
    }
    setUser(userId) {
      try {
        if (typeof userId !== "string" || !userId.trim()) {
          throw new TypeError("userId must be a non-empty string");
        }
        this.commonParams.userId = userId.trim();
        delete this.commonParams.user_id;
      } catch (error) {
        this.handleError(error, "setUser");
      }
    }
    getEnvInfo() {
      try {
        if (!this.envInfo || !this.config) {
          return null;
        }
        this.envInfo = refreshEnvInfo(this.envInfo, this.getEnvCollectionOptions());
        return deepClone(this.envInfo);
      } catch (error) {
        this.handleError(error, "getEnvInfo");
        return null;
      }
    }
    getConfig() {
      try {
        return this.config ? deepClone(this.config) : null;
      } catch (error) {
        this.handleError(error, "getConfig");
        return null;
      }
    }
    setReporter(reporter) {
      try {
        if (reporter !== null && typeof reporter.report !== "function") {
          throw new TypeError("reporter must implement report(event)");
        }
        this.disposeManagedReporter();
        this.reporterOverridden = true;
        this.reporter = reporter;
      } catch (error) {
        this.handleError(error, "setReporter");
      }
    }
    flush() {
      var _a, _b;
      try {
        (_b = (_a = this.reporter) == null ? void 0 : _a.flush) == null ? void 0 : _b.call(_a);
      } catch (error) {
        this.handleError(error, "flush");
      }
    }
    destroy() {
      try {
        this.disposeBuiltinPlugins();
        const reporter = this.reporter;
        this.reporter = null;
        this.managedReporter = null;
        this.disposeReporter(reporter);
        this.config = null;
        this.envInfo = null;
        this.commonParams = /* @__PURE__ */ Object.create(null);
        this.reporterOverridden = false;
      } catch (error) {
        this.handleError(error, "destroy");
      }
    }
    shouldSample() {
      var _a, _b;
      const sampleRate = (_b = (_a = this.config) == null ? void 0 : _a.sampleRate) != null ? _b : 0;
      if (sampleRate <= 0) {
        return false;
      }
      if (sampleRate >= 1) {
        return true;
      }
      return Math.random() < sampleRate;
    }
    resolveEventType(eventType) {
      if (typeof eventType !== "string" || !eventType.trim()) {
        throw new TypeError("eventType must be a non-empty string");
      }
      return eventType.trim();
    }
    buildProperties(commonParams, customParams, envInfo) {
      const properties = /* @__PURE__ */ Object.create(null);
      const environmentProperties = {
        uid: envInfo.uid,
        userAgent: envInfo.userAgent,
        browser: envInfo.browser,
        browserVersion: envInfo.browserVersion,
        os: envInfo.os,
        osVersion: envInfo.osVersion,
        screenWidth: envInfo.screenWidth,
        screenHeight: envInfo.screenHeight,
        viewportWidth: envInfo.viewportWidth,
        viewportHeight: envInfo.viewportHeight
      };
      this.copyProperties(properties, environmentProperties);
      this.copyProperties(properties, commonParams, /* @__PURE__ */ new Set(["userId", "user_id", "sessionId", "session_id"]));
      this.copyProperties(properties, deepClone(customParams));
      return properties;
    }
    copyProperties(target, source, excludedKeys = /* @__PURE__ */ new Set()) {
      Object.keys(source).forEach((key) => {
        if (excludedKeys.has(key)) {
          return;
        }
        const descriptor = Object.getOwnPropertyDescriptor(source, key);
        if (!descriptor || !("value" in descriptor)) {
          throw new TypeError("event properties cannot contain accessors");
        }
        Object.defineProperty(target, key, {
          configurable: true,
          enumerable: true,
          value: descriptor.value,
          writable: true
        });
      });
    }
    readIdentity(params, keys) {
      for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(params, key);
        if (!descriptor || !("value" in descriptor)) {
          continue;
        }
        if (typeof descriptor.value === "string" && descriptor.value.trim()) {
          return descriptor.value.trim();
        }
      }
      return void 0;
    }
    readEventLocation(params, key) {
      const descriptor = Object.getOwnPropertyDescriptor(params, key);
      if (descriptor && "value" in descriptor && typeof descriptor.value === "string" && descriptor.value.trim()) {
        return descriptor.value.trim();
      }
      return void 0;
    }
    assertEvent(event) {
      if (!event || typeof event.eventType !== "string" || !event.eventType.trim() || typeof event.eventName !== "string" || !event.eventName.trim() || typeof event.appId !== "string" || !event.appId.trim() || !isPlainObject(event.properties) || typeof event.timestamp !== "number" || !Number.isFinite(event.timestamp) || typeof event.url !== "string" || typeof event.referrer !== "string") {
        throw new TypeError("track event does not match the backend schema");
      }
    }
    normalizeEvent(event) {
      this.assertEvent(event);
      const properties = /* @__PURE__ */ Object.create(null);
      this.copyProperties(properties, deepClone(event.properties));
      const normalizedEvent = {
        eventType: event.eventType.trim(),
        eventName: event.eventName.trim(),
        appId: event.appId.trim(),
        properties,
        timestamp: event.timestamp,
        url: event.url,
        referrer: event.referrer
      };
      const userId = this.normalizeOptionalIdentity(event.userId, "userId");
      const sessionId = this.normalizeOptionalIdentity(event.sessionId, "sessionId");
      if (userId) {
        normalizedEvent.userId = userId;
      }
      if (sessionId) {
        normalizedEvent.sessionId = sessionId;
      }
      return normalizedEvent;
    }
    normalizeOptionalIdentity(value, fieldName) {
      if (value === void 0) {
        return void 0;
      }
      if (typeof value !== "string" || !value.trim()) {
        throw new TypeError(`${fieldName} must be a non-empty string`);
      }
      return value.trim();
    }
    report(event, priority) {
      var _a;
      try {
        const reportResult = (_a = this.reporter) == null ? void 0 : _a.report(event, priority);
        if (reportResult) {
          void Promise.resolve(reportResult).catch((error) => {
            this.handleError(error, "report");
          });
        }
      } catch (error) {
        this.handleError(error, "report");
      }
    }
    assertConfig(config) {
      if (!config || typeof config !== "object") {
        throw new TypeError("config is required");
      }
      const appId = (config.appId || config.projectId || "").trim();
      if (!appId) {
        throw new TypeError("appId must be a non-empty string");
      }
      if (typeof config.reportUrl !== "string" || !config.reportUrl.trim()) {
        throw new TypeError("reportUrl must be a non-empty string");
      }
      const parsedUrl = new URL(config.reportUrl, "http://tracega.local");
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new TypeError("reportUrl must use http or https");
      }
      if (config.appId && config.projectId && config.appId !== config.projectId && config.enableDebug) {
        console.warn("[TraceGA] Both appId and projectId provided; appId takes precedence.");
      }
    }
    resolveAppId(config) {
      return (config.appId || config.projectId || "").trim();
    }
    resolveHooks(config) {
      if (!config || typeof config !== "object") {
        return {};
      }
      const rawHooks = config.hooks;
      if (rawHooks === void 0 || rawHooks === null) {
        return {};
      }
      if (!isPlainObject(rawHooks)) {
        throw new TypeError("hooks must be a plain object");
      }
      const { onReady, onBeforeTrack, onTrack, onError } = rawHooks;
      const hookEntries = [onReady, onBeforeTrack, onTrack, onError];
      if (hookEntries.some((hook) => hook !== void 0 && typeof hook !== "function")) {
        throw new TypeError("hooks must be functions");
      }
      return { onReady, onBeforeTrack, onTrack, onError };
    }
    resolveSampleRate(value, fallback) {
      if (value === void 0) {
        return fallback;
      }
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError("sampleRate must be between 0 and 1");
      }
      return value;
    }
    resolveBufferSize(value, fallback) {
      const resolved = this.resolvePositiveInteger(value, fallback, "maxBufferSize");
      if (resolved > MAX_BATCH_SIZE) {
        throw new RangeError(`maxBufferSize cannot exceed ${MAX_BATCH_SIZE}`);
      }
      return resolved;
    }
    resolvePositiveInteger(value, fallback, fieldName) {
      if (value === void 0) {
        return fallback;
      }
      if (!Number.isInteger(value) || value <= 0) {
        throw new RangeError(`${fieldName} must be a positive integer`);
      }
      return value;
    }
    resolveBoolean(value, fallback, fieldName) {
      if (value === void 0) {
        return fallback;
      }
      if (typeof value !== "boolean") {
        throw new TypeError(`${fieldName} must be a boolean`);
      }
      return value;
    }
    resolvePluginConfig(value, fieldName) {
      if (value === void 0) {
        return Object.freeze({});
      }
      if (!isPlainObject(value)) {
        throw new TypeError(`${fieldName} must be a plain object`);
      }
      if (Object.values(value).some((option) => typeof option !== "boolean")) {
        throw new TypeError(`${fieldName} options must be booleans`);
      }
      return Object.freeze({ ...value });
    }
    getEnvCollectionOptions() {
      var _a, _b, _c, _d;
      return {
        includeQuery: (_b = (_a = this.config) == null ? void 0 : _a.includeUrlQuery) != null ? _b : false,
        includeHash: (_d = (_c = this.config) == null ? void 0 : _c.includeUrlHash) != null ? _d : false
      };
    }
    configureManagedReporter(config) {
      if (this.reporterOverridden || typeof window === "undefined") {
        return;
      }
      const reporter = new DefaultReporter(config, (error, context) => {
        this.handleError(error, context);
      });
      this.managedReporter = reporter;
      this.reporter = reporter;
    }
    drainManagedReporter() {
      if (!this.managedReporter) {
        return [];
      }
      try {
        const drained = this.managedReporter.drainEvents();
        const reporter = this.managedReporter;
        this.managedReporter = null;
        if (this.reporter === reporter) {
          this.reporter = null;
        }
        return drained;
      } catch (e) {
        this.disposeManagedReporter();
        return [];
      }
    }
    disposeManagedReporter() {
      if (!this.managedReporter) {
        return;
      }
      const reporter = this.managedReporter;
      this.managedReporter = null;
      if (this.reporter === reporter) {
        this.reporter = null;
      }
      this.disposeReporter(reporter);
    }
    disposeReporter(reporter) {
      var _a;
      try {
        const result = (_a = reporter == null ? void 0 : reporter.destroy) == null ? void 0 : _a.call(reporter);
        if (result) {
          void Promise.resolve(result).catch((error) => {
            this.handleError(error, "reporter.destroy");
          });
        }
      } catch (error) {
        this.handleError(error, "reporter.destroy");
      }
    }
    syncBuiltinPlugins(config) {
      if (config.enableAutoError || config.plugins.error) {
        this.errorPlugin = new ErrorPlugin({
          ...config.errorPlugin,
          reportUrl: config.reportUrl,
          onError: (error, context) => this.handleError(error, context)
        });
        this.errorPlugin.install(this);
      }
      if (config.plugins.event) {
        this.behaviorPlugin = new BehaviorPlugin({
          click: config.eventPlugin.click === false ? false : void 0,
          pageView: config.eventPlugin.route === false ? false : void 0,
          exposure: config.eventPlugin.exposure === false ? false : void 0,
          onError: (error, context) => this.handleError(error, context)
        });
        this.behaviorPlugin.install(this);
      }
      if (config.plugins.performance) {
        this.performancePlugin = new PerformancePlugin(config.performancePlugin);
        this.performancePlugin.install(this);
      }
      if (config.plugins.whiteScreen) {
        this.whiteScreenPlugin = new WhiteScreenPlugin(config.whiteScreenPlugin);
        this.whiteScreenPlugin.install(this);
      }
    }
    disposeBuiltinPlugins() {
      var _a, _b, _c, _d;
      (_a = this.performancePlugin) == null ? void 0 : _a.uninstall();
      this.performancePlugin = null;
      (_b = this.whiteScreenPlugin) == null ? void 0 : _b.uninstall();
      this.whiteScreenPlugin = null;
      (_c = this.behaviorPlugin) == null ? void 0 : _c.uninstall();
      this.behaviorPlugin = null;
      (_d = this.errorPlugin) == null ? void 0 : _d.uninstall();
      this.errorPlugin = null;
    }
    runHook(callback, context) {
      try {
        callback();
      } catch (error) {
        this.handleError(error, context);
      }
    }
    handleError(error, context, hooks) {
      var _a, _b, _c;
      try {
        (_c = (_b = hooks != null ? hooks : (_a = this.config) == null ? void 0 : _a.hooks) == null ? void 0 : _b.onError) == null ? void 0 : _c.call(_b, error, context);
      } catch (e) {
      }
    }
  }
  const traceCore = new TraceCore();

  const register = traceCore.register.bind(traceCore);
  const trackEvent = traceCore.trackEvent.bind(traceCore);
  const addCommonParams = traceCore.addCommonParams.bind(traceCore);
  const getCommonParams = traceCore.getCommonParams.bind(traceCore);
  const removeCommonParams = traceCore.removeCommonParams.bind(traceCore);
  const setUser = traceCore.setUser.bind(traceCore);
  const getEnvInfo = traceCore.getEnvInfo.bind(traceCore);
  const getConfig = traceCore.getConfig.bind(traceCore);
  const setReporter = traceCore.setReporter.bind(traceCore);
  const flush = traceCore.flush.bind(traceCore);
  const destroy = traceCore.destroy.bind(traceCore);
  const EventTypeConstants = {
    CUSTOM: "custom",
    CLICK: "click",
    PAGE_VIEW: "page_view",
    EXPOSURE: "exposure",
    ERROR: "error",
    PERFORMANCE: "performance"
  };
  const SDK_VERSION = typeof __SDK_VERSION__ !== "undefined" ? __SDK_VERSION__ : "0.0.1";

  exports.BehaviorEventName = BehaviorEventName;
  exports.BehaviorPlugin = BehaviorPlugin;
  exports.DefaultReporter = DefaultReporter;
  exports.ErrorEventName = ErrorEventName;
  exports.ErrorPlugin = ErrorPlugin;
  exports.EventTypeConstants = EventTypeConstants;
  exports.PERFORMANCE_EVENT_NAME = PERFORMANCE_EVENT_NAME;
  exports.PerformanceMetricName = PerformanceMetricName;
  exports.PerformancePlugin = PerformancePlugin;
  exports.Reporter = Reporter;
  exports.SDK_VERSION = SDK_VERSION;
  exports.TraceCore = TraceCore;
  exports.WhiteScreenPlugin = WhiteScreenPlugin;
  exports.addCommonParams = addCommonParams;
  exports.collectEnvInfo = collectEnvInfo;
  exports.debounce = debounce;
  exports.deepClone = deepClone;
  exports.destroy = destroy;
  exports.findMatchedElement = findMatchedElement;
  exports.flush = flush;
  exports.generateUUID = generateUUID;
  exports.getCommonParams = getCommonParams;
  exports.getConfig = getConfig;
  exports.getCurrentPageUrl = getCurrentPageUrl;
  exports.getElementMetadata = getElementMetadata;
  exports.getEnvInfo = getEnvInfo;
  exports.getEventElements = getEventElements;
  exports.getSelectorAttributeFilter = getSelectorAttributeFilter;
  exports.isIgnoredElement = isIgnoredElement;
  exports.isPlainObject = isPlainObject;
  exports.normalizeIntersectionRatio = normalizeIntersectionRatio;
  exports.parseUserAgent = parseUserAgent;
  exports.refreshEnvInfo = refreshEnvInfo;
  exports.register = register;
  exports.removeCommonParams = removeCommonParams;
  exports.safeGetAttribute = safeGetAttribute;
  exports.safeJsonStringify = safeJsonStringify;
  exports.sanitizeEnvironmentUrl = sanitizeEnvironmentUrl;
  exports.sanitizeUrl = sanitizeUrl;
  exports.setReporter = setReporter;
  exports.setUser = setUser;
  exports.subscribeRouteChanges = subscribeRouteChanges;
  exports.throttle = throttle;
  exports.traceCore = traceCore;
  exports.trackEvent = trackEvent;
  exports.truncateString = truncateString;
  exports.validateSelector = validateSelector;
  exports.validateSelectors = validateSelectors;

}));
//# sourceMappingURL=index.umd.js.map
