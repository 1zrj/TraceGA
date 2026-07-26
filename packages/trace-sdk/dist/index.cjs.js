'use strict';

class TraceCore {
  constructor() {
    this.config = null;
    this.commonParams = {};
    this.envInfo = null;
  }
  register(config) {
    this.config = { ...config };
    console.log("[TraceGA SDK] Registered with config:", config);
  }
  trackEvent(eventName, params) {
    if (!this.config) {
      console.warn("[TraceGA SDK] Not registered, trackEvent ignored.");
      return;
    }
    const event = {
      eventName,
      timestamp: Date.now(),
      customParams: params || {},
      commonParams: this.commonParams,
      envInfo: this.envInfo
    };
    console.log("[TraceGA SDK] Event tracked:", event);
  }
  addCommonParams(params) {
    Object.assign(this.commonParams, params);
  }
  removeCommonParams(keys) {
    keys.forEach((key) => delete this.commonParams[key]);
  }
  setUser(userId) {
    this.commonParams.user_id = userId;
  }
  getEnvInfo() {
    return this.envInfo;
  }
}
const traceCore = new TraceCore();

const reporterVersion = "0.0.1";
const pluginVersion = "0.0.1";
const utilsVersion = "0.0.1";

exports.TraceCore = TraceCore;
exports.pluginVersion = pluginVersion;
exports.reporterVersion = reporterVersion;
exports.traceCore = traceCore;
exports.utilsVersion = utilsVersion;
//# sourceMappingURL=index.cjs.js.map
