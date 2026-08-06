import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { logPlatformError } from "@/services/platform-monitoring";
import { initBrowserSentry } from "@/lib/sentry";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));

if (typeof window !== "undefined") {
  initBrowserSentry({
    dsn: import.meta.env["VITE_SENTRY_DSN"],
    environment: import.meta.env["VITE_SENTRY_ENVIRONMENT"] ?? import.meta.env.MODE,
    release: import.meta.env["VITE_SENTRY_RELEASE"] ?? "clinicflow-web",
  });

  window.addEventListener("error", (event) => {
    void logPlatformError({
      clinicId: null,
      source: "frontend",
      route: window.location.pathname,
      message: event.message || "Runtime error",
      severity: "error",
      appVersion: "2026.08",
      environment: import.meta.env.MODE,
      context: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    }).catch(() => undefined);
  });

  window.addEventListener("unhandledrejection", (event) => {
    void logPlatformError({
      clinicId: null,
      source: "frontend",
      route: window.location.pathname,
      message: event.reason instanceof Error ? event.reason.message : "Unhandled rejection",
      severity: "error",
      appVersion: "2026.08",
      environment: import.meta.env.MODE,
      context: { reason: String(event.reason) },
    }).catch(() => undefined);
  });
}
