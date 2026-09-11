import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224;
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized.startsWith('::ffff:')) {
    return isPrivateIpv4(normalized.slice('::ffff:'.length));
  }
  return normalized === '::1'
    || normalized === '::'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || /^fe[89ab]/.test(normalized);
}

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  return (version === 4 && isPrivateIpv4(address))
    || (version === 6 && isPrivateIpv6(address));
}

/** Synchronous first line of defence against obvious SSRF targets. */
export function isAllowedAuditUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (url.username || url.password) return false;
    if (process.env.RGAAUDIT_ALLOW_PRIVATE_NETWORKS === 'true') return true;

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      hostname === 'localhost'
      || hostname.endsWith('.localhost')
      || hostname.endsWith('.local')
      || hostname.endsWith('.internal')
    ) return false;

    const version = isIP(hostname);
    if (version === 4 && isPrivateIpv4(hostname)) return false;
    if (version === 6 && isPrivateIpv6(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

const dnsCache = new Map<string, { allowed: boolean; expiresAt: number }>();

/** Resolves hostnames as well, so redirects and page subresources cannot target a private network. */
export async function isPublicNetworkUrl(value: string): Promise<boolean> {
  if (!isAllowedAuditUrl(value)) return false;
  if (process.env.RGAAUDIT_ALLOW_PRIVATE_NETWORKS === 'true') return true;
  const hostname = new URL(value).hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) return !isPrivateAddress(hostname);

  const cached = dnsCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) return cached.allowed;

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    const allowed = addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address));
    dnsCache.set(hostname, { allowed, expiresAt: Date.now() + 60_000 });
    return allowed;
  } catch {
    return false;
  }
}
