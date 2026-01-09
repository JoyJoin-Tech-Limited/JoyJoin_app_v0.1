import { AsyncLocalStorage } from 'async_hooks';

export interface PerfMetrics {
  rid: string;
  dbCount: number;
  dbMs: number;
  dbMax: number;
  startTime: [number, number];
}

export const perfStorage = new AsyncLocalStorage<PerfMetrics>();

export function getPerfMetrics() {
  return perfStorage.getStore();
}

export function trackDbOp(ms: number) {
  const metrics = getPerfMetrics();
  if (metrics) {
    metrics.dbCount++;
    metrics.dbMs += ms;
    metrics.dbMax = Math.max(metrics.dbMax, ms);
  }
}
