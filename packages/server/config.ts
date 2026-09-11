/**
 * Centralized server configuration.
 * Values come from environment variables with sensible defaults.
 */

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envString(key: string, fallback: string): string {
  const raw = process.env[key]?.trim();
  return raw || fallback;
}

export const config = {
  /** Express server port */
  port: envInt('PORT', 3001),

  /** Persistent files. Docker mounts its data volume here. */
  dataDir: envString('RGAAUDIT_DATA_DIR', ''),

  /** Optional development frontend origin. Production remains same-origin. */
  corsOrigin: process.env.CORS_ORIGIN?.trim() || null,

  /** Audit limits */
  audit: {
    /** Maximum URLs per audit request */
    maxUrls: envInt('AUDIT_MAX_URLS', 50),
    /** Maximum concurrent Playwright contexts (1-3) */
    maxConcurrent: envInt('AUDIT_MAX_CONCURRENT', 2),
    /** TTL for completed audit events kept in memory (ms) */
    completedTtlMs: envInt('AUDIT_COMPLETED_TTL_MS', 30 * 60 * 1000),
    /** Global browser-heavy audits allowed at once. */
    maxRunning: envInt('AUDIT_MAX_RUNNING', 1),
  },

  /** Crawl settings */
  crawl: {
    /** Sitemap fetch timeout (ms) */
    timeoutMs: envInt('CRAWL_TIMEOUT_MS', 30_000),
  },
} as const;
