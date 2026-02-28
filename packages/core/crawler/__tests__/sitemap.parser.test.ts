import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseSitemap } from '../sitemap.parser';

const BASE_URL = 'https://example.com';

function xmlSitemap(urls: string[]): string {
  const entries = urls.map((u) => `<url><loc>${u}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}

function xmlSitemapIndex(sitemapUrls: string[]): string {
  const entries = sitemapUrls.map((u) => `<sitemap><loc>${u}</loc></sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;
}

function mockFetchResponses(mapping: Record<string, { status: number; body: string } | 'timeout'>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = url.toString();
    const entry = mapping[urlStr];

    if (entry === 'timeout') {
      return new Promise<never>((_, reject) => {
        const onAbort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
        if (init?.signal?.aborted) {
          onAbort();
          return;
        }
        init?.signal?.addEventListener('abort', onAbort);
      });
    }

    if (entry) {
      return new Response(entry.body, {
        status: entry.status,
        headers: { 'Content-Type': 'application/xml' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('parseSitemap', () => {
  it('parse un sitemap.xml valide avec 10 URLs', async () => {
    const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/page-${i + 1}`);
    mockFetchResponses({
      'https://example.com/sitemap.xml': { status: 200, body: xmlSitemap(urls) },
    });

    const result = await parseSitemap(BASE_URL);

    expect(result.source).toBe('sitemap');
    expect(result.count).toBe(10);
    expect(result.urls).toHaveLength(10);
    expect(result.error).toBeUndefined();
    for (const url of result.urls) {
      expect(url).toMatch(/^https:\/\/example\.com\/page-\d+\/$/);
    }
  });

  it('parse un sitemap index pointant vers 3 sitemaps', async () => {
    const sitemap1Urls = ['https://example.com/a', 'https://example.com/b'];
    const sitemap2Urls = ['https://example.com/c', 'https://example.com/d'];
    const sitemap3Urls = ['https://example.com/e'];

    mockFetchResponses({
      'https://example.com/sitemap.xml': {
        status: 200,
        body: xmlSitemapIndex([
          'https://example.com/sitemap-1.xml',
          'https://example.com/sitemap-2.xml',
          'https://example.com/sitemap-3.xml',
        ]),
      },
      'https://example.com/sitemap-1.xml': { status: 200, body: xmlSitemap(sitemap1Urls) },
      'https://example.com/sitemap-2.xml': { status: 200, body: xmlSitemap(sitemap2Urls) },
      'https://example.com/sitemap-3.xml': { status: 200, body: xmlSitemap(sitemap3Urls) },
    });

    const result = await parseSitemap(BASE_URL);

    expect(result.source).toBe('sitemap_index');
    expect(result.count).toBe(5);
    expect(result.urls).toHaveLength(5);
  });

  it('déduplique les URLs identiques', async () => {
    const urls = [
      'https://example.com/page',
      'https://example.com/page/',
      'https://example.com/page#anchor',
      'https://example.com/page?utm_source=google',
    ];
    mockFetchResponses({
      'https://example.com/sitemap.xml': { status: 200, body: xmlSitemap(urls) },
    });

    const result = await parseSitemap(BASE_URL);

    expect(result.count).toBe(1);
    expect(result.urls).toEqual(['https://example.com/page/']);
  });

  it('ignore les URLs hors domaine', async () => {
    const urls = [
      'https://example.com/page-1',
      'https://example.com/page-2',
      'https://other-site.com/page',
      'https://evil.com/phishing',
    ];
    mockFetchResponses({
      'https://example.com/sitemap.xml': { status: 200, body: xmlSitemap(urls) },
    });

    const result = await parseSitemap(BASE_URL);

    expect(result.count).toBe(2);
    expect(result.urls).toEqual([
      'https://example.com/page-1/',
      'https://example.com/page-2/',
    ]);
  });

  it('retourne { urls: [], source: "not_found" } si 404 — sans throw', async () => {
    mockFetchResponses({
      'https://example.com/sitemap.xml': { status: 404, body: 'Not Found' },
      'https://example.com/sitemap_index.xml': { status: 404, body: 'Not Found' },
    });

    const result = await parseSitemap(BASE_URL);

    expect(result.urls).toEqual([]);
    expect(result.source).toBe('not_found');
    expect(result.count).toBe(0);
    expect(result.error).toBeUndefined();
  });

  it('retourne { urls: [], source: "not_found" } si timeout', async () => {
    mockFetchResponses({
      'https://example.com/sitemap.xml': 'timeout',
      'https://example.com/sitemap_index.xml': 'timeout',
    });

    const result = await parseSitemap(BASE_URL, { timeout: 50 });

    expect(result.urls).toEqual([]);
    expect(result.source).toBe('not_found');
    expect(result.count).toBe(0);
  });

  it('normalise les URLs (trailing slash, tracking params)', async () => {
    const urls = [
      'https://example.com/about?utm_source=sitemap',
      'https://example.com/contact?fbclid=abc123',
      'https://example.com/blog#latest',
    ];
    mockFetchResponses({
      'https://example.com/sitemap.xml': { status: 200, body: xmlSitemap(urls) },
    });

    const result = await parseSitemap(BASE_URL);

    expect(result.urls).toEqual([
      'https://example.com/about/',
      'https://example.com/contact/',
      'https://example.com/blog/',
    ]);
  });

  it('fallback sur /sitemap_index.xml si /sitemap.xml échoue', async () => {
    const urls = ['https://example.com/from-index'];
    mockFetchResponses({
      'https://example.com/sitemap.xml': { status: 404, body: 'Not Found' },
      'https://example.com/sitemap_index.xml': { status: 200, body: xmlSitemap(urls) },
    });

    const result = await parseSitemap(BASE_URL);

    expect(result.count).toBe(1);
    expect(result.urls).toEqual(['https://example.com/from-index/']);
  });

  it('respecte la profondeur max pour les sitemaps récursifs', async () => {
    mockFetchResponses({
      'https://example.com/sitemap.xml': {
        status: 200,
        body: xmlSitemapIndex(['https://example.com/level-1.xml']),
      },
      'https://example.com/level-1.xml': {
        status: 200,
        body: xmlSitemapIndex(['https://example.com/level-2.xml']),
      },
      'https://example.com/level-2.xml': {
        status: 200,
        body: xmlSitemap(['https://example.com/deep-page']),
      },
    });

    // maxDepth: 1 means it won't recurse into level-2
    const result = await parseSitemap(BASE_URL, { maxDepth: 1 });

    expect(result.urls).toEqual([]);
    expect(result.source).toBe('not_found');
  });
});
