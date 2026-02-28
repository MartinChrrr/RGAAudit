import { XMLParser } from 'fast-xml-parser';
import { normalizeUrl, isSameDomain, deduplicateUrls } from './url.normalizer';

const FETCH_TIMEOUT = 10_000;
const MAX_DEPTH = 2;

export interface SitemapResult {
  urls: string[];
  source: 'sitemap' | 'sitemap_index' | 'not_found';
  count: number;
  error?: string;
}

interface SitemapOptions {
  timeout?: number;
  maxDepth?: number;
}

const parser = new XMLParser({
  ignoreAttributes: true,
  isArray: (tagName) => tagName === 'url' || tagName === 'sitemap',
});

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAndParseXml(url: string, timeout: number): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetchWithTimeout(url, timeout);
    if (!response.ok) return null;
    const text = await response.text();
    return parser.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractLocs(xml: Record<string, unknown>, tag: 'url' | 'sitemap'): string[] {
  const root = (xml['sitemapindex'] ?? xml['urlset']) as Record<string, unknown> | undefined;
  if (!root) return [];

  const entries = root[tag] as Array<{ loc?: string }> | undefined;
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry) => entry.loc)
    .filter((loc): loc is string => typeof loc === 'string');
}

async function parseSitemapRecursive(
  url: string,
  baseUrl: string,
  timeout: number,
  depth: number,
  maxDepth: number,
): Promise<{ urls: string[]; isIndex: boolean }> {
  const xml = await fetchAndParseXml(url, timeout);
  if (!xml) return { urls: [], isIndex: false };

  // Check if it's a sitemap index
  const sitemapLocs = extractLocs(xml, 'sitemap');
  if (sitemapLocs.length > 0) {
    if (depth >= maxDepth) return { urls: [], isIndex: true };

    const childResults = await Promise.all(
      sitemapLocs.map((loc) => parseSitemapRecursive(loc, baseUrl, timeout, depth + 1, maxDepth))
    );

    const allUrls = childResults.flatMap((r) => r.urls);
    return { urls: allUrls, isIndex: true };
  }

  // Regular sitemap — extract <url><loc>
  const urlLocs = extractLocs(xml, 'url');
  const sameDomainUrls = urlLocs.filter((loc) => isSameDomain(loc, baseUrl));
  return { urls: sameDomainUrls, isIndex: false };
}

export async function parseSitemap(baseUrl: string, options?: SitemapOptions): Promise<SitemapResult> {
  const timeout = options?.timeout ?? FETCH_TIMEOUT;
  const maxDepth = options?.maxDepth ?? MAX_DEPTH;

  // Try /sitemap.xml first
  const sitemapUrl = new URL('/sitemap.xml', baseUrl).toString();
  const result = await parseSitemapRecursive(sitemapUrl, baseUrl, timeout, 0, maxDepth);

  if (result.urls.length > 0) {
    const normalized = deduplicateUrls(result.urls.map((u) => normalizeUrl(u)));
    return {
      urls: normalized,
      source: result.isIndex ? 'sitemap_index' : 'sitemap',
      count: normalized.length,
    };
  }

  // Try /sitemap_index.xml
  const indexUrl = new URL('/sitemap_index.xml', baseUrl).toString();
  const indexResult = await parseSitemapRecursive(indexUrl, baseUrl, timeout, 0, maxDepth);

  if (indexResult.urls.length > 0) {
    const normalized = deduplicateUrls(indexResult.urls.map((u) => normalizeUrl(u)));
    return {
      urls: normalized,
      source: 'sitemap_index',
      count: normalized.length,
    };
  }

  return { urls: [], source: 'not_found', count: 0 };
}
