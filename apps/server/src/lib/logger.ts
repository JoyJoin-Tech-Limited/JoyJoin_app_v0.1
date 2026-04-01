/**
 * Structured JSON Logger
 * 结构化 JSON 日志工具
 *
 * Provides a reusable, lightweight structured logging utility for all
 * backend services. Every log line is emitted as a single JSON object so
 * that Loki, CloudWatch Logs, Datadog, or any NDJSON-aware aggregator can
 * ingest and query it without post-processing.
 *
 * Included fields in every record:
 *   - timestamp  ISO-8601 UTC string
 *   - level      'debug' | 'info' | 'warn' | 'error'
 *   - service    Application name (defaults to env SERVICE_NAME or 'joyjoin-server')
 *   - message    Human-readable description
 *   - request_id Correlation ID for the current HTTP request (if available)
 *   - ...ctx     Any additional key/value context passed by the caller
 *
 * Usage:
 *   import { logger } from '../lib/logger';
 *
 *   logger.info('User registered', { userId: user.id });
 *   logger.error('Payment failed', { orderId, error: err.message });
 *
 *   // Bind a request-scoped child logger that automatically includes request_id:
 *   const reqLogger = logger.child({ request_id: req.requestId });
 *   reqLogger.info('Handling /api/auth/user');
 *
 * Design notes:
 *   - No PII in log messages. Avoid raw user content, passwords, or tokens.
 *   - Log level is controlled by the LOG_LEVEL env var (default: 'info').
 *   - In test environments (NODE_ENV=test) output is suppressed by default;
 *     set LOG_LEVEL=debug to re-enable.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveMinLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? '').toLowerCase() as LogLevel;
  if (raw in LOG_LEVELS) return raw;
  // Suppress debug noise in tests unless explicitly enabled
  if (process.env.NODE_ENV === 'test') return 'warn';
  return 'info';
}

export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  request_id?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, ctx?: Record<string, unknown>): void;
  info(message: string, ctx?: Record<string, unknown>): void;
  warn(message: string, ctx?: Record<string, unknown>): void;
  error(message: string, ctx?: Record<string, unknown>): void;
  /** Return a new Logger that merges `defaultCtx` into every record. */
  child(defaultCtx: Record<string, unknown>): Logger;
}

/**
 * Internal emit function — writes one JSON line to the appropriate stream.
 * stdout for debug/info, stderr for warn/error.
 */
function emit(
  level: LogLevel,
  message: string,
  service: string,
  minLevel: LogLevel,
  baseCtx: Record<string, unknown>,
  extraCtx?: Record<string, unknown>,
): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) return;

  const record: LogRecord = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    ...baseCtx,
    ...extraCtx,
  };

  const line = JSON.stringify(record);
  if (level === 'warn' || level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

function createLogger(
  service: string,
  minLevel: LogLevel,
  baseCtx: Record<string, unknown> = {},
): Logger {
  return {
    debug(message, ctx) {
      emit('debug', message, service, minLevel, baseCtx, ctx);
    },
    info(message, ctx) {
      emit('info', message, service, minLevel, baseCtx, ctx);
    },
    warn(message, ctx) {
      emit('warn', message, service, minLevel, baseCtx, ctx);
    },
    error(message, ctx) {
      emit('error', message, service, minLevel, baseCtx, ctx);
    },
    child(defaultCtx) {
      return createLogger(service, minLevel, { ...baseCtx, ...defaultCtx });
    },
  };
}

const SERVICE_NAME = process.env.SERVICE_NAME ?? 'joyjoin-server';

/**
 * Root application logger.
 * Import this directly for module-level logging, or call `.child()` to bind
 * per-request context such as `request_id`.
 */
export const logger: Logger = createLogger(SERVICE_NAME, resolveMinLevel());
