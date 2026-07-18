export const PERFORMANCE_EVENT_NAME = 'performance';

export enum PerformanceMetricName {
  FCP = 'FCP',
  LCP = 'LCP',
  CLS = 'CLS',
}

export interface PerformanceMetricPayload {
  metric: PerformanceMetricName;
  value: number;
  timestamp: number;
}

export interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

export interface LargestContentfulPaintEntry extends PerformanceEntry {
  startTime: number;
}
