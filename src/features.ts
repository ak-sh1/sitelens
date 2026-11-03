import { domainInfo } from './domains';

// Hostname-only features deliberately omit scheme, paths and queries. The source
// dataset's legitimate rows are largely HTTPS homepages, which makes those URL
// features a misleading shortcut for classifying ordinary real-world login paths.
export const FEATURE_NAMES = ['hostname_length', 'domain_length', 'hostname_digit_ratio', 'hostname_hyphens', 'subdomain_count', 'ip_hostname', 'punycode', 'sensitive_hostname_words', 'hostname_entropy', 'domain_digit_ratio', 'longest_label', 'longest_digit_run'] as const;

export function urlFeatures(input: string): number[] {
  const info = domainInfo(input);
  if (!info) throw new Error('An absolute HTTP(S) URL is required.');
  const host = info.hostname.replace(/^www\./, '');
  const domain = info.domain;
  const subdomain = info.subdomain.replace(/^www(?:\.|$)/, '');
  const counts = new Map<string, number>();
  for (const ch of host) counts.set(ch, (counts.get(ch) || 0) + 1);
  let entropy = 0;
  for (const n of counts.values()) { const p = n / Math.max(host.length, 1); entropy -= p * Math.log2(p); }
  return [
    host.length, domain.length,
    (host.match(/\d/g) || []).length / Math.max(host.length, 1),
    (host.match(/-/g) || []).length,
    subdomain ? subdomain.split('.').length : 0,
    Number(info.isIp), Number(host.includes('xn--')),
    (host.match(/login|signin|verify|secure|update|account|billing|wallet/g) || []).length,
    entropy, (domain.match(/\d/g) || []).length / Math.max(domain.length, 1),
    Math.max(...host.split('.').map(label => label.length)), Math.max(0, ...(host.match(/\d+/g) || []).map(run => run.length)),
  ];
}
