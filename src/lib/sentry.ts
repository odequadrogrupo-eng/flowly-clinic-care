import * as SentryBrowser from "@sentry/browser";
import * as SentryNode from "@sentry/node";

let browserInitialized = false;
let serverInitialized = false;

export function initBrowserSentry(context: {
  dsn?: string;
  environment?: string;
  release?: string;
}) {
  if (browserInitialized) return;
  if (!context.dsn) return;

  const options = {
    dsn: context.dsn,
    ...(context.environment ? { environment: context.environment } : {}),
    ...(context.release ? { release: context.release } : {}),
    tracesSampleRate: 0.1,
    beforeSend: ((event: unknown) => sanitizeSentryEvent(event)) as never,
  };

  SentryBrowser.init(options);

  browserInitialized = true;
}

export function initServerSentry(context: {
  dsn?: string;
  environment?: string;
  release?: string;
}) {
  if (serverInitialized) return;
  if (!context.dsn) return;

  const options = {
    dsn: context.dsn,
    ...(context.environment ? { environment: context.environment } : {}),
    ...(context.release ? { release: context.release } : {}),
    tracesSampleRate: 0.1,
    beforeSend: ((event: unknown) => sanitizeSentryEvent(event)) as never,
  };

  SentryNode.init(options);

  serverInitialized = true;
}

function sanitizeSentryEvent(event: unknown) {
  const redact = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(redact);
    if (input && typeof input === "object") {
      const obj = input as Record<string, unknown>;
      const next: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (/password|senha|token|secret|service_role|cpf|prontuario/i.test(key)) {
          next[key] = "[REDACTED]";
          continue;
        }
        next[key] = redact(value);
      }
      return next;
    }
    return input;
  };

  return redact(event);
}
