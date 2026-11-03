import type { Report } from './types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let currentReport: Report | null = null;
let targetTabId: number | undefined;
const VERDICTS = {
  clear: { title: 'No warnings found', subtitle: 'These checks found no warnings. This does not confirm that the site is safe.' },
  review: { title: 'Review this page', subtitle: 'Check the findings before entering personal information.' },
  high: { title: 'Warning signs found', subtitle: 'Verify the site’s address before entering a password.' },
};
const EVIDENCE_LABELS: Record<string, string> = {
  brand: 'Brand', observed: 'This page', configured: 'Known domains', resembles: 'Similar to',
  familiarText: 'Text in address', actualDomain: 'Main domain', destinations: 'Form targets',
  hostname: 'Host', protocol: 'Connection', pageDomain: 'Page domain', targetDomains: 'Form targets',
  displayed: 'Link text', destination: 'Link target', count: 'Links', address: 'Address',
  asciiHostname: 'Encoded host', actualHostname: 'Actual host', contributingFeatures: 'Model features', modelVersion: 'Model',
};

function element(tag: string, className: string, text?: string): HTMLElement {
  const el = document.createElement(tag); el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function showReport(report: Report) {
  currentReport = report;
  const verdict = VERDICTS[report.verdict];
  $('empty').hidden = true; $('results').hidden = false;
  $('verdict-card').className = `verdict-card ${report.verdict}`;
  $('verdict-title').textContent = verdict.title;
  $('verdict-subtitle').textContent = verdict.subtitle;
  $('hostname').textContent = report.hostname;
  $('domain-value').textContent = report.domain;
  $('fields-value').textContent = String(report.facts.passwordFields);
  $('brand-value').textContent = report.facts.claimedBrand || 'None identified';
  $('timing').textContent = `${report.elapsedMs ?? 0} ms · ${new Date(report.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const warnings = report.findings.filter(f => f.severity !== 'info');
  const notes = report.findings.length - warnings.length;
  $('finding-count').textContent = `${warnings.length} warning${warnings.length === 1 ? '' : 's'}${notes ? ` · ${notes} note${notes === 1 ? '' : 's'}` : ''}`;
  const container = $('findings'); container.replaceChildren();
  for (const finding of report.findings) {
    const card = element('article', `finding ${finding.severity}`);
    const heading = element('div', 'finding-heading');
    heading.append(element('h3', '', finding.title));
    heading.append(element('span', 'finding-level', finding.severity === 'info' ? 'Note' : finding.severity === 'high' ? 'Warning' : 'Check'));
    card.append(heading, element('p', '', finding.explanation));
    const evidence = element('dl', 'evidence');
    for (const [key, value] of Object.entries(finding.evidence)) {
      evidence.append(element('dt', '', EVIDENCE_LABELS[key] || key.replace(/([A-Z])/g, ' $1')), element('dd', '', String(value)));
    }
    card.append(evidence); container.append(card);
  }
  if (!report.findings.length) container.append(element('p', 'quiet-note', 'Nothing to report from these checks.'));
  $('coverage').replaceChildren(...report.coverage.map(item => element('li', '', item)));
  $('engine-label').textContent = report.model ? 'Rules + hostname model' : 'Rules only';
  const modelStates: Record<Report['modelStatus'], string> = {
    off: 'The optional model is off. You can enable it in settings.',
    applied: `Model signal: ${report.model?.signal}. This is a hostname pattern match, not a safety rating.`,
    'skipped-local': 'The model is skipped on local addresses. Rules were applied.',
    'skipped-known-domain': 'The model is skipped on configured brand domains. Rules were applied.',
    unavailable: 'The model could not run. Rules were applied.',
  };
  $('model-state').textContent = modelStates[report.modelStatus];
  $('demo-label').hidden = !report.facts.localDemo;
  $<HTMLButtonElement>('export').disabled = false;
}

async function scan() {
  $('error').hidden = true;
  const button = $<HTMLButtonElement>('scan');
  button.disabled = true; button.textContent = 'Scanning…';
  currentReport = null; $<HTMLButtonElement>('export').disabled = true;
  $('results').hidden = true; $('empty').hidden = false;
  try {
    if (targetTabId === undefined) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      targetTabId = tab?.id;
    }
    const response = await chrome.runtime.sendMessage({ type: 'SCAN', tabId: targetTabId });
    if (!response?.ok) throw new Error(response?.error || 'The scan could not be completed.');
    showReport(response.report);
  } catch (error) {
    $('error').textContent = error instanceof Error ? error.message : 'The scan could not be completed.';
    $('error').hidden = false;
  } finally { button.disabled = false; button.textContent = 'Scan this page'; }
}

$('scan').addEventListener('click', scan);
$('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('export').addEventListener('click', () => {
  if (!currentReport) return;
  const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `sitelens-${currentReport.hostname.replace(/[^a-z\d.-]/gi, '_')}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});

const explicit = new URL(location.href).searchParams.get('tab');
if (explicit && /^\d+$/.test(explicit)) targetTabId = Number(explicit);
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (targetTabId === undefined) targetTabId = tab?.id;
  if (tab?.url?.startsWith('http')) $('hostname').textContent = new URL(tab.url).hostname;
}).catch(() => {});
