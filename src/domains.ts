import { parse } from 'tldts';

export function domainInfo(input: string) {
  let url: URL;
  try { url = new URL(input.includes('://') ? input : `https://${input}`); }
  catch { return null; }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const parsed = parse(hostname, { allowPrivateDomains: true });
  return {
    hostname,
    domain: parsed.domain || hostname,
    label: parsed.domainWithoutSuffix || hostname.split('.')[0],
    subdomain: parsed.subdomain || '',
    isIp: !!parsed.isIp,
    local: hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1' || hostname === '[::1]',
    url,
  };
}

export function matchesDomain(host: string, allowed: string): boolean {
  const normalized = host.toLowerCase().replace(/\.$/, '');
  return normalized === allowed || normalized.endsWith(`.${allowed}`);
}

export function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
    previous = current;
  }
  return previous[b.length];
}
