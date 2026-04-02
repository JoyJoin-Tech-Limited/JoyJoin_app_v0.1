/**
 * Prometheus-style Metrics Middleware & Registry
 * 指标采集中间件（Prometheus 格式）
 *
 * Instruments every Express HTTP request and exposes process-level resource
 * metrics. The `/api/metrics` endpoint returns plain-text Prometheus
 * exposition format, which Prometheus (or Grafana Agent / Alloy) can scrape
 * directly.
 *
 * Collected metrics:
 *   http_requests_total{method, path, status_code}         — request counter
 *   http_request_duration_ms{method, path, status_code}    — latency histogram
 *     (buckets: 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000 ms)
 *   http_errors_total{method, path, status_code}           — 4xx/5xx counter
 *   process_cpu_user_seconds_total                         — CPU usage
 *   process_cpu_system_seconds_total                       — CPU system usage
 *   process_resident_memory_bytes                          — RSS memory
 *   process_heap_used_bytes                                — JS heap used
 *   process_heap_total_bytes                               — JS heap total
 *   nodejs_event_loop_delay_ms                             — event-loop lag
 *   process_uptime_seconds                                 — server uptime
 *
 * Usage — register in index.ts before routes:
 *   import { metricsMiddleware, getMetricsText } from './middleware/metrics';
 *   // Mount the middleware BEFORE route registration so all requests are instrumented.
 *   app.use(metricsMiddleware);
 *   // The /api/metrics route is registered in routes.ts using getMetricsText().
 *   // The /api/metrics path itself is excluded from instrumentation to avoid noise.
 *
 * Design notes:
 *   - No external dependencies — this is a hand-rolled minimal implementation
 *     so that no extra npm packages are required to keep the diff small.
 *   - Path normalisation collapses numeric/UUID path segments to ':id' to
 *     avoid cardinality explosion (e.g. /api/users/123 → /api/users/:id).
 *   - Histogram buckets are pre-defined constants. Update DURATION_BUCKETS
 *     if the latency profile of the service changes significantly.
 *   - The /api/metrics endpoint itself is excluded from instrumentation to
 *     avoid polluting the counters.
 */

import { type Request, type Response, type NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Histogram bucket boundaries (milliseconds)
// ---------------------------------------------------------------------------
const DURATION_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

// ---------------------------------------------------------------------------
// Internal data structures
// ---------------------------------------------------------------------------

interface CounterEntry {
  count: number;
  labels: Record<string, string>;
}

interface HistogramEntry {
  sum: number;
  count: number;
  buckets: number[]; // parallel to DURATION_BUCKETS, +Inf bucket appended
  labels: Record<string, string>;
}

const requestCounters = new Map<string, CounterEntry>();
const errorCounters = new Map<string, CounterEntry>();
const durationHistograms = new Map<string, HistogramEntry>();
const runtimeLLMFallbackCounters = new Map<string, CounterEntry>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collapse dynamic path segments to reduce metric cardinality. */
function normalisePath(rawPath: string): string {
  return rawPath
    .split('/')
    .map((segment) => {
      // UUID (8-4-4-4-12)
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
        return ':id';
      }
      // Pure numeric
      if (/^\d+$/.test(segment)) {
        return ':id';
      }
      return segment;
    })
    .join('/');
}

function labelKey(labels: Record<string, string>): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
}

function incCounter(
  store: Map<string, CounterEntry>,
  labels: Record<string, string>,
): void {
  const key = labelKey(labels);
  const existing = store.get(key);
  if (existing) {
    existing.count += 1;
  } else {
    store.set(key, { count: 1, labels });
  }
}

function observeHistogram(
  store: Map<string, HistogramEntry>,
  labels: Record<string, string>,
  valueMs: number,
): void {
  const key = labelKey(labels);
  const existing = store.get(key);
  if (existing) {
    existing.sum += valueMs;
    existing.count += 1;
    DURATION_BUCKETS.forEach((bound, i) => {
      if (valueMs <= bound) existing.buckets[i] += 1;
    });
    existing.buckets[DURATION_BUCKETS.length] += 1; // +Inf
  } else {
    const buckets = DURATION_BUCKETS.map((bound) => (valueMs <= bound ? 1 : 0));
    buckets.push(1); // +Inf always 1
    store.set(key, { sum: valueMs, count: 1, buckets, labels });
  }
}

// ---------------------------------------------------------------------------
// Exposition helpers
// ---------------------------------------------------------------------------

function renderCounter(
  name: string,
  help: string,
  store: Map<string, CounterEntry>,
): string {
  const lines: string[] = [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} counter`,
  ];
  for (const entry of store.values()) {
    const lstr = Object.entries(entry.labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    lines.push(`${name}{${lstr}} ${entry.count}`);
  }
  return lines.join('\n');
}

function renderHistogram(
  name: string,
  help: string,
  store: Map<string, HistogramEntry>,
): string {
  const lines: string[] = [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} histogram`,
  ];
  for (const entry of store.values()) {
    const baseLabelStr = Object.entries(entry.labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    const sep = baseLabelStr ? ',' : '';
    DURATION_BUCKETS.forEach((bound, i) => {
      lines.push(
        `${name}_bucket{${baseLabelStr}${sep}le="${bound}"} ${entry.buckets[i]}`,
      );
    });
    lines.push(
      `${name}_bucket{${baseLabelStr}${sep}le="+Inf"} ${entry.buckets[DURATION_BUCKETS.length]}`,
    );
    lines.push(`${name}_sum{${baseLabelStr}} ${entry.sum}`);
    lines.push(`${name}_count{${baseLabelStr}} ${entry.count}`);
  }
  return lines.join('\n');
}

function renderGauge(name: string, help: string, value: number): string {
  return [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} gauge`,
    `${name} ${value}`,
  ].join('\n');
}

function renderCounterValue(name: string, help: string, value: number): string {
  return [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} counter`,
    `${name} ${value}`,
  ].join('\n');
}

function renderProcessMetrics(): string {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  const sections: string[] = [
    renderGauge(
      'process_resident_memory_bytes',
      'Resident set size in bytes.',
      mem.rss,
    ),
    renderGauge(
      'process_heap_used_bytes',
      'Process heap memory used in bytes.',
      mem.heapUsed,
    ),
    renderGauge(
      'process_heap_total_bytes',
      'Process heap memory total in bytes.',
      mem.heapTotal,
    ),
    renderCounterValue(
      'process_cpu_user_seconds_total',
      'Total user CPU time used in seconds.',
      cpu.user / 1e6,
    ),
    renderCounterValue(
      'process_cpu_system_seconds_total',
      'Total system CPU time used in seconds.',
      cpu.system / 1e6,
    ),
    renderGauge(
      'process_uptime_seconds',
      'The number of seconds the process has been running.',
      process.uptime(),
    ),
  ];
  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Event-loop delay gauge (sampled at each metrics request)
// ---------------------------------------------------------------------------
let _lastEventLoopDelayMs = 0;

function measureEventLoopDelay(): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    setImmediate(() => {
      _lastEventLoopDelayMs = Date.now() - start;
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Express middleware — instrument every request with counters and latency
 * histogram. Mount this early in the middleware stack, before routes.
 */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Instrument API traffic only; skip Vite/dev assets and static files.
  if (!req.path.startsWith('/api') || req.path === '/api/metrics') {
    return next();
  }

  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const method = req.method.toUpperCase();
    const path = normalisePath(req.path);
    const statusCode = String(res.statusCode);

    const labels = { method, path, status_code: statusCode };

    incCounter(requestCounters, labels);
    observeHistogram(durationHistograms, labels, durationMs);

    if (res.statusCode >= 400) {
      incCounter(errorCounters, labels);
    }
  });

  next();
}

/**
 * Generate the full Prometheus plain-text exposition and return it as a string.
 * Call this inside the /api/metrics route handler.
 */
export async function getMetricsText(): Promise<string> {
  await measureEventLoopDelay();

  const sections: string[] = [
    renderCounter(
      'http_requests_total',
      'Total number of HTTP requests.',
      requestCounters,
    ),
    renderHistogram(
      'http_request_duration_ms',
      'HTTP request latency in milliseconds.',
      durationHistograms,
    ),
    renderCounter(
      'http_errors_total',
      'Total number of HTTP error responses (4xx and 5xx).',
      errorCounters,
    ),
    renderCounter(
      'inference_runtime_llm_fallback_total',
      'Total number of runtime LLM fallback outcomes by field.',
      runtimeLLMFallbackCounters,
    ),
    renderGauge(
      'nodejs_event_loop_delay_ms',
      'Approximate Node.js event-loop delay in milliseconds.',
      _lastEventLoopDelayMs,
    ),
    renderProcessMetrics(),
  ];

  return sections.join('\n\n') + '\n';
}

/** Reset all counters and histograms — intended for use in tests only. */
export function _resetMetricsForTest(): void {
  requestCounters.clear();
  errorCounters.clear();
  durationHistograms.clear();
  runtimeLLMFallbackCounters.clear();
}

export function recordRuntimeLLMFallbackMetric(
  field: string,
  outcome: 'applied' | 'rejected_unapproved' | 'rejected_low_confidence' | 'skipped_user_declared',
): void {
  const boundedField = outcome === 'rejected_unapproved' ? '__unapproved__' : field;
  incCounter(runtimeLLMFallbackCounters, { field: boundedField, outcome });
}
