/**
 * Structured Logging Utility
 * Production-grade logging with request tracking, context injection, and performance timing
 */

import { dev } from '$app/environment';

// =============================================================================
// Types
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  /** Unique request correlation ID */
  requestId?: string;
  /** User ID if authenticated */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** HTTP method */
  method?: string;
  /** Request path */
  path?: string;
  /** Client IP address */
  ip?: string;
  /** User agent string */
  userAgent?: string;
  /** Additional custom context */
  [key: string]: unknown;
}

export interface LogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Request correlation ID */
  requestId?: string;
  /** User context */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Duration in milliseconds (for performance logs) */
  duration?: number;
  /** Error details */
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  /** Additional metadata */
  meta?: Record<string, unknown>;
  /** Service/component name */
  service?: string;
  /** Environment */
  env?: string;
}

export interface PerformanceMark {
  name: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Configuration
// =============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LOG_LEVEL: LogLevel = dev ? 'debug' : 'info';
const SERVICE_NAME = 'guilloche-web';

// =============================================================================
// Logger Class
// =============================================================================

export class Logger {
  private context: LogContext;
  private performanceMarks: Map<string, PerformanceMark>;

  constructor(context: LogContext = {}) {
    this.context = context;
    this.performanceMarks = new Map();
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({
      ...this.context,
      ...additionalContext,
    });
  }

  /**
   * Set or update context
   */
  setContext(context: Partial<LogContext>): void {
    Object.assign(this.context, context);
  }

  /**
   * Get current request ID
   */
  getRequestId(): string | undefined {
    return this.context.requestId;
  }

  // ---------------------------------------------------------------------------
  // Log Level Methods
  // ---------------------------------------------------------------------------

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const errorDetails = this.formatError(error);
    this.log('error', message, { ...meta, ...(errorDetails && { error: errorDetails }) });
  }

  // ---------------------------------------------------------------------------
  // Performance Timing
  // ---------------------------------------------------------------------------

  /**
   * Start a performance timer
   */
  startTimer(name: string, metadata?: Record<string, unknown>): void {
    this.performanceMarks.set(name, {
      name,
      startTime: performance.now(),
      metadata,
    });
  }

  /**
   * End a performance timer and log the duration
   */
  endTimer(name: string, additionalMeta?: Record<string, unknown>): number | undefined {
    const mark = this.performanceMarks.get(name);
    if (!mark) {
      this.warn(`Performance timer "${name}" not found`);
      return undefined;
    }

    const duration = Math.round((performance.now() - mark.startTime) * 100) / 100;
    this.performanceMarks.delete(name);

    this.info(`Timer: ${name}`, {
      duration,
      ...mark.metadata,
      ...additionalMeta,
    });

    return duration;
  }

  /**
   * Time an async operation
   */
  async time<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    this.startTimer(name, metadata);
    try {
      const result = await operation();
      this.endTimer(name, { success: true });
      return result;
    } catch (error) {
      this.endTimer(name, { success: false, error: this.formatError(error) });
      throw error;
    }
  }

  /**
   * Time a sync operation
   */
  timeSync<T>(name: string, operation: () => T, metadata?: Record<string, unknown>): T {
    this.startTimer(name, metadata);
    try {
      const result = operation();
      this.endTimer(name, { success: true });
      return result;
    } catch (error) {
      this.endTimer(name, { success: false, error: this.formatError(error) });
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Request Logging
  // ---------------------------------------------------------------------------

  /**
   * Log an incoming request
   */
  request(method: string, path: string, meta?: Record<string, unknown>): void {
    this.info(`${method} ${path}`, {
      type: 'request',
      method,
      path,
      ...meta,
    });
  }

  /**
   * Log a completed response
   */
  response(
    method: string,
    path: string,
    status: number,
    duration: number,
    meta?: Record<string, unknown>
  ): void {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this.log(level, `${method} ${path} ${status} ${duration}ms`, {
      type: 'response',
      method,
      path,
      status,
      duration,
      ...meta,
    });
  }

  // ---------------------------------------------------------------------------
  // Database Query Logging
  // ---------------------------------------------------------------------------

  /**
   * Log a database query
   */
  query(operation: string, table: string, duration: number, meta?: Record<string, unknown>): void {
    const level: LogLevel = duration > 1000 ? 'warn' : 'debug';
    this.log(level, `DB: ${operation} ${table}`, {
      type: 'database',
      operation,
      table,
      duration,
      slow: duration > 1000,
      ...meta,
    });
  }

  // ---------------------------------------------------------------------------
  // External API Logging
  // ---------------------------------------------------------------------------

  /**
   * Log an external API call
   */
  api(
    service: string,
    endpoint: string,
    status: number,
    duration: number,
    meta?: Record<string, unknown>
  ): void {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this.log(level, `API: ${service} ${endpoint}`, {
      type: 'external_api',
      service,
      endpoint,
      status,
      duration,
      ...meta,
    });
  }

  // ---------------------------------------------------------------------------
  // Core Logging
  // ---------------------------------------------------------------------------

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    // Check log level threshold
    if (LOG_LEVELS[level] < LOG_LEVELS[MIN_LOG_LEVEL]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: SERVICE_NAME,
      env: dev ? 'development' : 'production',
      requestId: this.context.requestId,
      userId: this.context.userId,
      sessionId: this.context.sessionId,
      meta: {
        ...this.stripContext(),
        ...meta,
      },
    };

    // Clean up empty meta
    if (entry.meta && Object.keys(entry.meta).length === 0) {
      delete entry.meta;
    }

    // Extract error from meta if present
    if (meta?.error) {
      entry.error = meta.error as LogEntry['error'];
      if (entry.meta) {
        delete entry.meta.error;
      }
    }

    // Extract duration from meta if present
    if (typeof meta?.duration === 'number') {
      entry.duration = meta.duration;
      if (entry.meta) {
        delete entry.meta.duration;
      }
    }

    this.output(entry);
  }

  private output(entry: LogEntry): void {
    if (dev) {
      // Pretty console output for development
      this.prettyPrint(entry);
    } else {
      // Structured JSON for production
      console.log(JSON.stringify(entry));
    }
  }

  private prettyPrint(entry: LogEntry): void {
    const levelColors: Record<LogLevel, string> = {
      debug: '\x1b[90m', // Gray
      info: '\x1b[36m', // Cyan
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
    };
    const reset = '\x1b[0m';
    const color = levelColors[entry.level];
    const levelPad = entry.level.toUpperCase().padEnd(5);

    let output = `${color}[${levelPad}]${reset} ${entry.message}`;

    if (entry.duration !== undefined) {
      output += ` ${color}(${entry.duration}ms)${reset}`;
    }

    if (entry.requestId) {
      output += ` ${'\x1b[90m'}[${entry.requestId.substring(0, 8)}]${reset}`;
    }

    console.log(output);

    // Print meta in development for debugging
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      console.log('  ', entry.meta);
    }

    // Print error stack in development
    if (entry.error?.stack) {
      console.error('  ', entry.error.stack);
    }
  }

  private formatError(error: unknown): LogEntry['error'] | undefined {
    if (!error) return undefined;

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: dev ? error.stack : undefined,
        code: (error as Error & { code?: string }).code,
      };
    }

    if (typeof error === 'string') {
      return {
        name: 'Error',
        message: error,
      };
    }

    if (typeof error === 'object') {
      const err = error as Record<string, unknown>;
      return {
        name: String(err.name || 'Error'),
        message: String(err.message || 'Unknown error'),
        code: err.code as string | undefined,
      };
    }

    return {
      name: 'Error',
      message: String(error),
    };
  }

  private static readonly SENSITIVE_KEYS = new Set([
    'authorization',
    'cookie',
    'password',
    'token',
    'secret',
    'access_token',
    'refresh_token',
    'api_key',
    'x-api-key',
    'key',
  ]);

  private stripContext(): Record<string, unknown> {
    const { requestId: _requestId, userId: _userId, sessionId: _sessionId, ...rest } = this.context;
    return this.redactSensitive(rest);
  }

  private redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = Logger.SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
    }
    return result;
  }
}

// =============================================================================
// Request ID Generation
// =============================================================================

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Extract request ID from incoming request headers
 */
export function extractRequestId(request: Request): string {
  // Check common correlation ID headers
  const correlationHeaders = [
    'x-request-id',
    'x-correlation-id',
    'x-trace-id',
    'cf-ray', // Cloudflare Ray ID
  ];

  for (const header of correlationHeaders) {
    const value = request.headers.get(header);
    if (value) {
      return value;
    }
  }

  return generateRequestId();
}

// =============================================================================
// Global Logger Instance
// =============================================================================

/**
 * Global logger for non-request-scoped logging
 */
export const logger = new Logger();

// =============================================================================
// Request-Scoped Logger Factory
// =============================================================================

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(request: Request, additionalContext?: LogContext): Logger {
  const requestId = extractRequestId(request);
  const url = new URL(request.url);

  return new Logger({
    requestId,
    method: request.method,
    path: url.pathname,
    userAgent: request.headers.get('user-agent') || undefined,
    ...additionalContext,
  });
}

// =============================================================================
// Server Timing Helper
// =============================================================================

export interface ServerTimingEntry {
  name: string;
  duration?: number;
  description?: string;
}

/**
 * Build Server-Timing header value
 */
export function buildServerTimingHeader(entries: ServerTimingEntry[]): string {
  return entries
    .map((entry) => {
      let value = entry.name;
      if (entry.duration !== undefined) {
        value += `;dur=${entry.duration}`;
      }
      if (entry.description) {
        value += `;desc="${entry.description}"`;
      }
      return value;
    })
    .join(', ');
}
