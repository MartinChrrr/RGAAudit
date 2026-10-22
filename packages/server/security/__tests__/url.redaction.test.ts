import { describe, expect, it } from 'vitest';
import { pageIdForUrl, redactTextUrls, redactUrl } from '../url.redaction';

describe('public URL redaction', () => {
  it('removes query strings and fragments while preserving the page path', () => {
    expect(redactUrl('https://example.com/audit?token=secret#step-1')).toBe('https://example.com/audit');
  });

  it('returns an opaque page identity that does not contain the URL', () => {
    const pageId = pageIdForUrl('session-1', 'https://example.com/audit?token=secret');
    expect(pageId).toMatch(/^page-[0-9a-f]{32}$/);
    expect(pageId).not.toContain('secret');
    expect(pageId).toBe(pageIdForUrl('session-1', 'https://example.com/audit?token=secret'));
  });

  it('redacts absolute URLs embedded in evidence text', () => {
    expect(redactTextUrls('Lien https://example.com/audit?token=secret à contrôler.'))
      .toBe('Lien https://example.com/audit à contrôler.');
  });
});
