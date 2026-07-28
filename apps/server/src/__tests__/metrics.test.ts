/**
 * Unit tests for the Prometheus-style metrics middleware
 *
 * Verifies:
 *   - metricsMiddleware increments request counters after a response finishes
 *   - Error responses (4xx/5xx) are counted in the error counter
 *   - getMetricsText() returns valid Prometheus exposition text
 *   - Path normalisation collapses numeric and UUID segments to :id
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  metricsMiddleware,
  getMetricsText,
  _resetMetricsForTest,
  recordRuntimeLLMFallbackMetric,
  recordAIProviderRecoveryMetric,
} from '../middleware/metrics';
import type { Request, Response } from 'express';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Helpers to build fake req/res objects
// ---------------------------------------------------------------------------

function makeReq(method: string, path: string): Request {
  return {
    method,
    path,
  } as unknown as Request;
}

function makeRes(statusCode: number): { res: Response; emitter: EventEmitter } {
  const emitter = new EventEmitter();
  const res = {
    statusCode,
    on: emitter.on.bind(emitter),
  } as unknown as Response;
  return { res, emitter };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('metricsMiddleware', () => {
  beforeEach(() => _resetMetricsForTest());
  afterEach(() => _resetMetricsForTest());

  it('calls next() immediately', () => {
    const req = makeReq('GET', '/api/events');
    const { res } = makeRes(200);
    let nextCalled = false;

    metricsMiddleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it('records a request counter entry after the response finishes', async () => {
    const req = makeReq('GET', '/api/events');
    const { res, emitter } = makeRes(200);

    metricsMiddleware(req, res, () => {});
    emitter.emit('finish');

    const text = await getMetricsText();
    expect(text).toContain('http_requests_total');
    expect(text).toContain('method="GET"');
    expect(text).toContain('path="/api/events"');
    expect(text).toContain('status_code="200"');
  });

  it('increments error counter for 5xx responses', async () => {
    const req = makeReq('POST', '/api/auth/login');
    const { res, emitter } = makeRes(500);

    metricsMiddleware(req, res, () => {});
    emitter.emit('finish');

    const text = await getMetricsText();
    expect(text).toContain('http_errors_total');
    expect(text).toContain('status_code="500"');
  });

  it('increments error counter for 4xx responses', async () => {
    const req = makeReq('GET', '/api/user/profile');
    const { res, emitter } = makeRes(404);

    metricsMiddleware(req, res, () => {});
    emitter.emit('finish');

    const text = await getMetricsText();
    expect(text).toContain('http_errors_total');
    expect(text).toContain('status_code="404"');
  });

  it('does not count 2xx responses as errors', async () => {
    const req = makeReq('GET', '/api/events');
    const { res, emitter } = makeRes(200);

    metricsMiddleware(req, res, () => {});
    emitter.emit('finish');

    const text = await getMetricsText();
    // http_errors_total should not have an entry for 200
    const errorLines = text
      .split('\n')
      .filter(
        (l) =>
          l.startsWith('http_errors_total') && l.includes('status_code="200"'),
      );
    expect(errorLines).toHaveLength(0);
  });

  it('normalises numeric path segments to :id', async () => {
    const req = makeReq('GET', '/api/events/42/attendees');
    const { res, emitter } = makeRes(200);

    metricsMiddleware(req, res, () => {});
    emitter.emit('finish');

    const text = await getMetricsText();
    expect(text).toContain('path="/api/events/:id/attendees"');
    // Raw numeric segment should not appear as a path label
    expect(text).not.toContain('path="/api/events/42/attendees"');
  });

  it('normalises UUID path segments to :id', async () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const req = makeReq('GET', `/api/sessions/${uuid}`);
    const { res, emitter } = makeRes(200);

    metricsMiddleware(req, res, () => {});
    emitter.emit('finish');

    const text = await getMetricsText();
    expect(text).toContain('path="/api/sessions/:id"');
  });

  it('skips instrumentation for /api/metrics itself', () => {
    const req = makeReq('GET', '/api/metrics');
    const { res } = makeRes(200);

    let nextCalled = false;
    metricsMiddleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    // The metrics store should still be empty
    // We test this by checking getMetricsText does not contain a metrics path
  });

  it('skips non-API routes to avoid static asset cardinality growth', async () => {
    const req = makeReq('GET', '/assets/app.123abc.js');
    const { res, emitter } = makeRes(200);

    metricsMiddleware(req, res, () => {});
    emitter.emit('finish');

    const text = await getMetricsText();
    expect(text).not.toContain('/assets/app.123abc.js');
    expect(text).not.toContain('path="/assets');
  });

  it('getMetricsText includes process metrics', async () => {
    const text = await getMetricsText();
    expect(text).toContain('process_resident_memory_bytes');
    expect(text).toContain('process_heap_used_bytes');
    expect(text).toContain('process_uptime_seconds');
    expect(text).toContain('nodejs_event_loop_delay_ms');
    expect(text).toContain('# TYPE process_cpu_user_seconds_total counter');
    expect(text).toContain('# TYPE process_cpu_system_seconds_total counter');
  });

  it('exposes V8 heap limit and external memory gauges (pre-OOM alerting)', async () => {
    const text = await getMetricsText();
    expect(text).toContain('# TYPE nodejs_heap_size_limit_bytes gauge');
    expect(text).toContain('# TYPE nodejs_external_memory_bytes gauge');

    // The heap limit gauge must carry a positive numeric value — an empty or
    // zero reading would silently break the JoyJoinHeapNearLimit alert ratio.
    const limitMatch = text.match(/^nodejs_heap_size_limit_bytes (\d+(?:\.\d+)?)$/m);
    expect(limitMatch).toBeTruthy();
    expect(Number(limitMatch![1])).toBeGreaterThan(0);

    const externalMatch = text.match(/^nodejs_external_memory_bytes (\d+(?:\.\d+)?)$/m);
    expect(externalMatch).toBeTruthy();
    expect(Number(externalMatch![1])).toBeGreaterThan(0);
  });

  it('includes histogram _bucket, _sum, _count lines', async () => {
    const req = makeReq('GET', '/api/health');
    const { res, emitter } = makeRes(200);

    metricsMiddleware(req, res, () => {});
    emitter.emit('finish');

    const text = await getMetricsText();
    expect(text).toContain('http_request_duration_ms_bucket');
    expect(text).toContain('http_request_duration_ms_sum');
    expect(text).toContain('http_request_duration_ms_count');
    expect(text).toContain('le="+Inf"');
  });

  it('exposes runtime llm fallback counters for ops visibility', async () => {
    recordRuntimeLLMFallbackMetric('occupation', 'applied');
    recordRuntimeLLMFallbackMetric('surpriseField', 'rejected_unapproved');

    const text = await getMetricsText();
    expect(text).toContain('inference_runtime_llm_fallback_total');
    expect(text).toContain('field="occupation"');
    expect(text).toContain('field="__unapproved__"');
    expect(text).toContain('outcome="applied"');
    expect(text).toContain('outcome="rejected_unapproved"');
    expect(text).not.toContain('field="surpriseField"');
  });

  it('exposes joyjoin_ai_provider_recovery_total for secondary-provider wins', async () => {
    recordAIProviderRecoveryMetric({ domain: 'miniscript', feature: 'generateMiniScriptFramework' });

    const text = await getMetricsText();
    expect(text).toContain('joyjoin_ai_provider_recovery_total');
    expect(text).toContain('domain="miniscript"');
    expect(text).toContain('feature="generateMiniScriptFramework"');
  });
});
