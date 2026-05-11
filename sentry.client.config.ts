import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1, // 10% das requisicoes pra performance
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1, // 10% das sessoes com erro
    environment: process.env.NODE_ENV,
    // Reduz ruido
    ignoreErrors: [
      "Network request failed",
      "Failed to fetch",
      "AbortError",
      "Non-Error promise rejection captured",
    ],
  });
}
