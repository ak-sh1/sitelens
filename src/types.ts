export type Verdict = 'clear' | 'review' | 'high';
export interface Brand { name: string; aliases: string[]; domains: string[] }
export interface Settings { includeModel: boolean; customBrands: Brand[] }
export interface RawPage {
  url: string;
  identityText: string;
  passwordCount: number;
  passwordFormTargets: string[];
  unownedPasswordCount: number;
  misleadingLinks: { displayedHost: string; actualHost: string }[];
  iframeCount: number;
  truncated: boolean;
}
export interface Finding {
  id: string;
  severity: 'high' | 'medium' | 'info';
  title: string;
  explanation: string;
  evidence: Record<string, string | number>;
}
export interface Report {
  schemaVersion: 1;
  scannedAt: string;
  hostname: string;
  domain: string;
  protocol: string;
  verdict: Verdict;
  ruleVerdict: Verdict;
  findings: Finding[];
  coverage: string[];
  facts: { passwordFields: number; formDestinations: string[]; claimedBrand: string | null; localDemo: boolean };
  model: null | { version: string; signal: 'elevated' | 'low'; experimental: true; topSignals: string[] };
  modelStatus: 'off' | 'applied' | 'skipped-local' | 'skipped-known-domain' | 'unavailable';
  elapsedMs?: number;
}
