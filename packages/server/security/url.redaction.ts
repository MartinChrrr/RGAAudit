import { createHash } from 'node:crypto';

/**
 * Returns a display-safe URL. Query strings and fragments are deliberately
 * removed because they may contain credentials, session identifiers or other
 * page-specific state. Invalid values never cross the public API boundary.
 */
export function redactUrl(value: string): string {
  if (!value || typeof value !== 'string') return '[URL masquée]';

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '[URL masquée]';
    }
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    // A few collected attributes may be relative URLs. Preserve their path,
    // but still strip query and fragment values.
    try {
      const parsed = new URL(value, 'https://rgaudit.invalid');
      return parsed.origin === 'https://rgaudit.invalid'
        ? `${parsed.pathname || '/'}${parsed.port ? `:${parsed.port}` : ''}`
        : '[URL masquée]';
    } catch {
      return '[URL masquée]';
    }
  }
}

/** Stable, opaque identity used by public review endpoints instead of URLs. */
export function pageIdForUrl(sessionId: string, pageUrl: string): string {
  const digest = createHash('sha256')
    .update(`${sessionId}\u001f${pageUrl}`)
    .digest('hex')
    .slice(0, 32);
  return `page-${digest}`;
}

/** Redacts absolute URLs embedded in evidence or user-entered notes. */
export function redactTextUrls(value: string): string {
  return value.replace(/https?:\/\/[^\s"'<>]+/gi, (candidate) => redactUrl(candidate));
}

/** Recursively redacts URL-looking strings in third-party evidence objects. */
export function redactStructuredText(value: unknown): unknown {
  if (typeof value === 'string') return redactTextUrls(value);
  if (Array.isArray(value)) return value.map(redactStructuredText);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, redactStructuredText(nested)]));
  }
  return value;
}
