const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'gclid',
  'msclkid',
  'ref',
  'source',
]);

const EXTENSION_RE = /\.\w{2,5}$/;

export function normalizeUrl(url: string): string {
  const parsed = new URL(url);

  // Remove hash/anchor
  parsed.hash = '';

  // Remove tracking params
  for (const param of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(param)) {
      parsed.searchParams.delete(param);
    }
  }

  // Trailing slash: always present on paths without file extension
  if (!EXTENSION_RE.test(parsed.pathname)) {
    if (!parsed.pathname.endsWith('/')) {
      parsed.pathname += '/';
    }
  } else {
    // Remove trailing slash on paths with file extension
    if (parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
  }

  return parsed.toString();
}

export function isSameDomain(url: string, baseUrl: string): boolean {
  try {
    const urlHost = new URL(url).hostname.toLowerCase();
    const baseHost = new URL(baseUrl).hostname.toLowerCase();

    if (urlHost === baseHost) return true;

    // Check if one is a subdomain of the other
    // e.g. blog.example.com and example.com share the same base domain
    return urlHost.endsWith(`.${baseHost}`) || baseHost.endsWith(`.${urlHost}`);
  } catch {
    return false;
  }
}

export function deduplicateUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of urls) {
    const normalized = normalizeUrl(url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}
