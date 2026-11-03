import { BRANDS, DEMO_BRAND, IDENTITY_HOSTS } from './brands';
import { domainInfo, matchesDomain, distance } from './domains';
import { predictUrl } from './model';
import type { Brand, Finding, RawPage, Report, Settings, Verdict } from './types';

const containsAlias = (text: string, alias: string) => new RegExp(`(?:^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`, 'i').test(text);
const level = (points: number): Verdict => points >= 65 ? 'high' : points >= 25 ? 'review' : 'clear';

export function analyzePage(page: RawPage, settings: Settings): Report {
  const site = domainInfo(page.url);
  if (!site || !['http:', 'https:'].includes(site.url.protocol)) throw new Error('Open a regular HTTP or HTTPS webpage to scan.');
  const findings: Finding[] = [];
  let points = 0;
  const add = (finding: Finding, weight = 0) => { findings.push(finding); points += weight; };
  const brands = [...BRANDS, ...settings.customBrands, ...(site.local ? [DEMO_BRAND] : [])];
  const claimedBrands = brands.filter(brand => brand.aliases.some(alias => containsAlias(page.identityText, alias)));
  const ownBrand = claimedBrands.find(brand => brand.domains.some(domain => matchesDomain(site.hostname, domain)));
  const claimedBrand: Brand | undefined = ownBrand || claimedBrands[0];
  const recognized = !!claimedBrand?.domains.some(domain => matchesDomain(site.hostname, domain));
  const credentials = page.passwordCount > 0;

  if (credentials && claimedBrand && !recognized) add({ id: 'brand-domain-mismatch', severity: 'medium', title: 'Brand and domain differ', explanation: `The page mentions ${claimedBrand.name}, but its address is outside the configured domain list. The mention may be incidental.`, evidence: { brand: claimedBrand.name, observed: site.hostname, configured: claimedBrand.domains.join(', ') } }, 45);

  if (credentials && !recognized) {
    const match = brands.flatMap(brand => brand.domains.map(domain => ({ brand, domain, info: domainInfo(domain)! }))).find(candidate => {
      if (matchesDomain(site.hostname, candidate.domain)) return false;
      const a = site.label.toLowerCase(); const b = candidate.info.label.toLowerCase();
      const skeleton = (value: string) => value.replace(/0/g, 'o').replace(/[1!]/g, 'l').replace(/5/g, 's');
      return b.length >= 4 && a !== b && (distance(a, b) <= 1 || skeleton(a) === skeleton(b));
    });
    if (match) add({ id: 'lookalike-domain', severity: 'medium', title: 'Possible lookalike domain', explanation: `This address resembles a configured ${match.brand.name} domain. Similar spelling alone does not prove impersonation.`, evidence: { observed: site.domain, resembles: match.domain } }, 30);
    const nested = brands.flatMap(brand => brand.domains).find(domain => site.hostname.includes(`${domain}.`) && !matchesDomain(site.hostname, domain));
    if (nested) add({ id: 'nested-brand-domain', severity: 'medium', title: 'Familiar domain inside a different address', explanation: 'The familiar domain is part of a subdomain. The actual site domain is shown below.', evidence: { familiarText: nested, actualDomain: site.domain } }, 30);
  }

  const targets = page.passwordFormTargets.map(value => domainInfo(value)).filter((item): item is NonNullable<typeof item> => !!item);
  const unsupportedTargets = page.passwordFormTargets.filter(value => { try { return !['http:', 'https:'].includes(new URL(value).protocol); } catch { return true; } });
  const insecure = targets.filter(target => target.url.protocol === 'http:' && !target.local);
  if (credentials && insecure.length) add({ id: 'insecure-submission', severity: 'high', title: 'Password form points to HTTP', explanation: 'The HTML form target uses an unencrypted connection. JavaScript may change where it submits.', evidence: { destinations: [...new Set(insecure.map(target => target.hostname))].join(', ') } }, 70);
  if (credentials && site.url.protocol === 'http:' && !site.local) add({ id: 'insecure-login-page', severity: 'high', title: 'Login page loaded over HTTP', explanation: 'This page has a visible password field and was loaded without HTTPS.', evidence: { hostname: site.hostname, protocol: 'HTTP' } }, 45);

  const external = targets.filter(target => target.domain !== site.domain && target.url.protocol.startsWith('http'));
  const isIdp = (host: string) => IDENTITY_HOSTS.includes(host) || (site.local && host === 'identity.localhost');
  const unrecognized = external.filter(target => !isIdp(target.hostname) && !claimedBrand?.domains.some(domain => matchesDomain(target.hostname, domain)));
  if (credentials && unrecognized.length) add({ id: 'external-password-form', severity: 'medium', title: 'Password form points to another domain', explanation: 'The HTML form points outside this site’s configured domains. External sign-in can legitimately use another domain.', evidence: { pageDomain: site.domain, targetDomains: [...new Set(unrecognized.map(target => target.domain))].join(', ') } }, 30);
  const idps = external.filter(target => isIdp(target.hostname));
  if (idps.length) add({ id: 'recognized-identity-provider', severity: 'info', title: 'Recognized sign-in provider', explanation: 'The target is a known sign-in provider. This does not confirm that the page is authorized to use it.', evidence: { destinations: [...new Set(idps.map(target => target.hostname))].join(', ') } });

  const linkMismatches = page.misleadingLinks.filter(link => domainInfo(link.displayedHost)?.domain !== domainInfo(link.actualHost)?.domain);
  if (linkMismatches.length) add({ id: 'misleading-link', severity: 'medium', title: 'A displayed URL leads to a different domain', explanation: 'The link displays a different domain from its destination. Tracking and redirect links can also cause this.', evidence: { displayed: linkMismatches[0].displayedHost, destination: linkMismatches[0].actualHost, count: linkMismatches.length } }, 25);
  if (credentials && site.isIp && !site.local) add({ id: 'ip-login', severity: 'medium', title: 'Login page uses an IP address', explanation: 'This page requests a password at a numeric address. Internal tools can also use this pattern.', evidence: { address: site.hostname } }, 25);
  if (site.hostname.includes('xn--')) add({ id: 'internationalized-domain', severity: 'info', title: 'Internationalized domain', explanation: 'This address contains encoded international characters. That alone is not suspicious.', evidence: { asciiHostname: site.hostname } });
  if (site.url.username || site.url.password) add({ id: 'url-userinfo', severity: 'medium', title: 'URL contains text before an @ sign', explanation: 'Text before @ is not the destination. The actual hostname is shown below.', evidence: { actualHostname: site.hostname } }, 25);

  const ruleVerdict = level(points);
  let verdict = ruleVerdict;
  const configuredDomain = brands.some(brand => brand.domains.some(domain => matchesDomain(site.hostname, domain)));
  const prediction = settings.includeModel && !site.local && !configuredDomain ? predictUrl(page.url) : null;
  const modelStatus: Report['modelStatus'] = !settings.includeModel ? 'off' : site.local ? 'skipped-local' : configuredDomain ? 'skipped-known-domain' : prediction ? 'applied' : 'unavailable';
  const model = prediction ? { version: prediction.version, signal: prediction.elevated ? 'elevated' as const : 'low' as const, experimental: true as const, topSignals: prediction.topSignals } : null;
  if (prediction?.elevated) {
    add({ id: 'url-model', severity: 'medium', title: 'Hostname model flagged a pattern', explanation: 'The optional model flagged this hostname based on patterns in historical data. It has not verified the page or its owner.', evidence: { contributingFeatures: prediction.topSignals.join(', '), modelVersion: prediction.version } });
    if (verdict === 'clear') verdict = 'review';
  }
  const coverage = [
    'Only the main page was checked. Later changes may be missed.',
    'Form targets came from HTML. Actual submissions, redirects, and network requests were not checked.',
    'Domain ownership, reputation lists, and visual similarity were not checked.',
  ];
  if (page.iframeCount) coverage.push(`${page.iframeCount} embedded frame(s) were not inspected.`);
  if (page.unownedPasswordCount) coverage.push('Some password fields have no HTML form; their submission destinations are unknown.');
  if (unsupportedTargets.length) coverage.push('Some form targets use unsupported schemes or could not be parsed.');
  if (page.truncated) coverage.push('Collection limits were reached; some elements were not inspected.');
  if (site.local) coverage.push('Local address: HTTP alone is not treated as a public-network warning.');
  if (settings.includeModel && site.local) coverage.push('The hostname model is skipped on local development addresses.');
  else if (settings.includeModel && configuredDomain) coverage.push('The model is skipped on configured brand domains. Rules still run; domain recognition does not confirm safety.');
  else if (settings.includeModel && !prediction) coverage.push('The optional model is unavailable; only rules were applied.');
  return {
    schemaVersion: 1, scannedAt: new Date().toISOString(), hostname: site.hostname, domain: site.domain,
    protocol: site.url.protocol, verdict, ruleVerdict, findings, coverage,
    facts: { passwordFields: page.passwordCount, formDestinations: [...new Set(targets.map(target => target.hostname))], claimedBrand: claimedBrand?.name || null, localDemo: site.local && site.hostname.endsWith('.localhost') },
    model, modelStatus,
  };
}
