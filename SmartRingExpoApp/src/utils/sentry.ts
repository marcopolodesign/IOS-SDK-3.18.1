import * as Sentry from '@sentry/react-native';

type SeverityLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

interface ErrorContext {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Report an error to Sentry with optional context tags.
 * Sentry is disabled in dev (`enabled: !__DEV__`) so this is a no-op locally
 * unless you temporarily override that flag.
 */
export function reportError(
  error: unknown,
  context?: ErrorContext,
  level: SeverityLevel = 'error',
): void {
  const exception = error instanceof Error ? error : new Error((error as any)?.message ? String((error as any).message) : String(error));
  if (!context && level === 'error') {
    Sentry.captureException(exception);
    return;
  }
  Sentry.withScope(scope => {
    scope.setLevel(level);
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setTag(key, String(value ?? 'unknown'));
      });
    }
    Sentry.captureException(exception);
  });
}

/**
 * Report a non-error event (lifecycle, warning, info).
 */
export function reportMessage(
  message: string,
  level: SeverityLevel = 'info',
  context?: ErrorContext,
): void {
  if (!context) {
    Sentry.captureMessage(message, level);
    return;
  }
  Sentry.withScope(scope => {
    scope.setLevel(level);
    Object.entries(context).forEach(([key, value]) => {
      scope.setTag(key, String(value ?? 'unknown'));
    });
    Sentry.captureMessage(message);
  });
}

/**
 * Add a breadcrumb for tracing what happened before an error.
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: SeverityLevel = 'info',
): void {
  Sentry.addBreadcrumb({ category, message, data, level });
}

/**
 * Identify the current user so errors in Sentry show who was affected.
 * Call on login with user info, call with null on logout.
 */
export function setUserContext(user: { id: string; email?: string } | null): void {
  Sentry.setUser(user);
}

/**
 * Attach ring hardware context to all subsequent Sentry events.
 * Call after a successful ring connection.
 */
export function setRingContext(
  mac: string,
  sdkType: 'jstyle' | 'v8' | 'unknown',
  firmware?: string,
): void {
  Sentry.setContext('ring', { mac, sdkType, firmware: firmware ?? 'unknown' });
}
