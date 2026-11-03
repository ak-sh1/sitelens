import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzePage, domainInfo, matchesDomain, urlFeatures, FEATURE_NAMES, MODEL_METADATA, validateSettings, predictUrl } from '../.artifacts/core.mjs';
import { fixtures, snapshot } from './fixtures.mjs';

const settings = { includeModel: false, customBrands: [] };
for (const fixture of fixtures) test(fixture.name, () => {
  const report = analyzePage(fixture.page, settings);
  assert.equal(report.verdict, fixture.expected);
  if (fixture.id) assert.ok(report.findings.some(f => f.id === fixture.id));
  if (fixture.coverage) assert.ok(report.coverage.some(text => text.includes(fixture.coverage)));
  assert.equal(report.model, null);
});

test('PSL handles co.uk and private hosting boundaries', () => {
  assert.equal(domainInfo('https://a.bank.co.uk/login').domain, 'bank.co.uk');
  assert.equal(domainInfo('https://a.customer.github.io/login').domain, 'customer.github.io');
  assert.notEqual(domainInfo('https://alice.github.io').domain, domainInfo('https://bob.github.io').domain);
  assert.equal(matchesDomain('paypal.com.evil.example', 'paypal.com'), false);
  assert.equal(matchesDomain('evilpaypal.com', 'paypal.com'), false);
  assert.equal(matchesDomain('login.paypal.com', 'paypal.com'), true);
});

test('Sanitized report omits paths, queries, HTML, and userinfo', () => {
  const page = snapshot('https://secret-user:secret-pass@ordinary.example/private-path?token=private-token', { identityText: 'PERSONAL-TITLE-MARKER' });
  const json = JSON.stringify(analyzePage(page, { ...settings, includeModel: true }));
  for (const secret of ['secret-user', 'secret-pass', 'private-path', 'private-token', 'PERSONAL-TITLE-MARKER']) assert.equal(json.includes(secret), false);
});

test('URL feature vectors are finite, bounded, and match exported schema', () => {
  for (const input of ['https://example.com', 'https://xn--bcher-kva.de/login?x=20', 'http://127.0.0.1:4173/a', 'https://user@example.com/a%20b']) {
    const features = urlFeatures(input);
    assert.equal(features.length, FEATURE_NAMES.length);
    assert.ok(features.every(Number.isFinite));
  }
  assert.deepEqual(FEATURE_NAMES, MODEL_METADATA.featureNames);
});

test('JavaScript inference matches Python-exported reference scores', async () => {
  const references = JSON.parse(await readFile(new URL('../ml/parity.json', import.meta.url)));
  for (const { x, score } of references) {
    const logit = MODEL_METADATA.intercept + x.reduce((sum, value, i) => sum + ((value - MODEL_METADATA.mean[i]) / MODEL_METADATA.scale[i]) * MODEL_METADATA.coefficients[i], 0);
    const actual = 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, logit))));
    assert.ok(Math.abs(actual - score) < 1e-10);
  }
});

test('Optional model cannot suppress high rule warnings', () => {
  for (const fixture of fixtures.filter(f => f.expected === 'high')) {
    assert.equal(analyzePage(fixture.page, { ...settings, includeModel: true }).verdict, 'high');
  }
  assert.ok(predictUrl('https://example.com/'));
});

test('Custom brand registry is applied without changing built-in rules', () => {
  const custom = { includeModel: false, customBrands: [{ name: 'Acme', aliases: ['acme'], domains: ['acme.example'] }] };
  const report = analyzePage(snapshot('https://other.example/', { identityText: 'Acme login', passwordCount: 1 }), custom);
  assert.equal(report.verdict, 'review');
  assert.equal(report.facts.claimedBrand, 'Acme');
});

test('Settings reject invalid domains and preserve explicit model choice', () => {
  assert.deepEqual(validateSettings(settings), settings);
  for (const domain of ['https://bank.com', '*.bank.com', 'bank.com/path', 'bank..com', '-bank.com', 'bank.com@evil.com']) {
    assert.throws(() => validateSettings({ ...settings, customBrands: [{ name: 'Bank', aliases: ['bank'], domains: [domain] }] }));
  }
  assert.throws(() => validateSettings({ includeModel: 'true', customBrands: [] }));
});

test('Unsupported page protocols fail rather than imply safety', () => {
  assert.throws(() => analyzePage(snapshot('chrome://settings/'), settings));
  assert.throws(() => analyzePage(snapshot('file:///private/file.html'), settings));
});

test('Production manifest has no persistent site access or outbound connections', async () => {
  const manifest = JSON.parse(await readFile(new URL('../dist/manifest.json', import.meta.url)));
  assert.deepEqual(manifest.permissions.sort(), ['activeTab', 'scripting', 'storage'].sort());
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.ok(manifest.content_security_policy.extension_pages.includes("connect-src 'none'"));
});
