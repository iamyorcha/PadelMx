import { APP_VERSION, BUILD_ID, BUILD_ENV } from '../version';

export interface ErrorContext {
  operation?: string;
  tournamentId?: string;
  tournamentFormat?: string;
  tournamentState?: string;
  round?: number;
  componentStack?: string;
  route?: string;
  extra?: Record<string, any>;
  [key: string]: any;
}

export interface TelemetryRecord {
  id: string;
  type: 'error' | 'event';
  name: string;
  message?: string;
  stack?: string;
  timestamp: string;
  isOnline: boolean;
  appVersion: string;
  buildId: string;
  env: string;
  context?: Record<string, any>;
}

// In-memory circular log ring buffer for live on-device diagnostics
const MAX_BUFFER_SIZE = 50;
const telemetryBuffer: TelemetryRecord[] = [];

// Sensitive field blacklist to guarantee zero credential leakage
const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'token',
  'accesstoken',
  'refreshtoken',
  'auth',
  'secret',
  'apikey',
  'authorization',
  'cookie',
  'credential',
  'privatekey'
]);

function sanitizeObject(obj: any, depth = 0): any {
  if (depth > 4) return '[MaxDepthExceeded]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.slice(0, 20).map(item => sanitizeObject(item, depth + 1));
  }

  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lowerKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    let isBlacklisted = false;
    for (const secretKey of SENSITIVE_KEYS) {
      if (lowerKey.includes(secretKey)) {
        isBlacklisted = true;
        break;
      }
    }

    if (isBlacklisted) {
      clean[k] = '[REDACTED_SENSITIVE]';
    } else {
      clean[k] = sanitizeObject(v, depth + 1);
    }
  }
  return clean;
}

export function reportError(error: unknown, context: ErrorContext = {}) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const currentRoute = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';

  const sanitizedContext = sanitizeObject({
    ...context,
    route: context.route || currentRoute,
    tournamentFormat: context.tournamentFormat,
    tournamentState: context.tournamentState,
    round: context.round,
    operation: context.operation,
  });

  const record: TelemetryRecord = {
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'error',
    name: error instanceof Error ? error.name : 'UnknownError',
    message,
    stack,
    timestamp: new Date().toISOString(),
    isOnline,
    appVersion: APP_VERSION,
    buildId: BUILD_ID,
    env: BUILD_ENV,
    context: sanitizedContext
  };

  telemetryBuffer.push(record);
  if (telemetryBuffer.length > MAX_BUFFER_SIZE) {
    telemetryBuffer.shift();
  }

  // Safe developer console output
  console.error(`[Telemetry Error] [${record.id}]`, message, sanitizedContext);

  // Dispatch custom event for testing / external monitors
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('app_telemetry_error', { detail: record }));
    } catch {
      // safe fallback
    }
  }

  // Pluggable provider hook (e.g., Sentry / Datadog / LogRocket)
  const externalSentry = typeof window !== 'undefined' ? (window as any)?.Sentry : undefined;
  if (externalSentry && typeof externalSentry.captureException === 'function') {
    try {
      externalSentry.captureException(error, { extra: sanitizedContext });
    } catch {
      // ignore
    }
  }
}

export function trackEvent(eventName: string, properties: Record<string, any> = {}) {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const sanitizedProps = sanitizeObject(properties);

  const record: TelemetryRecord = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'event',
    name: eventName,
    timestamp: new Date().toISOString(),
    isOnline,
    appVersion: APP_VERSION,
    buildId: BUILD_ID,
    env: BUILD_ENV,
    context: sanitizedProps
  };

  telemetryBuffer.push(record);
  if (telemetryBuffer.length > MAX_BUFFER_SIZE) {
    telemetryBuffer.shift();
  }

  if (BUILD_ENV === 'development') {
    console.debug(`[Telemetry Event] ${eventName}`, sanitizedProps);
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('app_telemetry_event', { detail: record }));
    } catch {
      // safe fallback
    }
  }
}

export function getTelemetryLogs(): readonly TelemetryRecord[] {
  return [...telemetryBuffer];
}

export function clearTelemetryLogs(): void {
  telemetryBuffer.length = 0;
}
