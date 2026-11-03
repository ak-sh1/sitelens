// Optional real-Chromium integration runner. The test-only copy grants access
// ONLY to local demo hosts, since headless automation cannot reliably invoke
// the toolbar action that grants activeTab. The shipped manifest is unchanged.
import { chromium } from 'playwright';
import { cp, mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { startDemoServer } from '../scripts/demo-server.mjs';

const temporary = await mkdtemp(path.join(tmpdir(), 'sitelens-browser-'));
const extension = path.join(temporary, 'extension');
await cp(new URL('../dist/', import.meta.url), extension, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['http://*.localhost/*', 'http://localhost/*'];
await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
const checks = [];
let context;
const server = await startDemoServer(0);
try {
  context = await chromium.launchPersistentContext(path.join(temporary, 'profile'), {
    ...(process.env.SITELENS_CHROMIUM_PATH ? { executablePath: process.env.SITELENS_CHROMIUM_PATH } : { channel: 'chromium' }),
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  const target = await context.newPage();
  const cases = [['northstar.localhost', '/login', 'No warnings found'], ['northstarr.localhost', '/login', 'Warning signs found'], ['northstar.localhost', '/external', 'Review this page'], ['northstar.localhost', '/sso', 'No warnings found'], ['northstar.localhost', '/insecure', 'Warning signs found'], ['northstar.localhost', '/misleading', 'Review this page'], ['northstar.localhost', '/js-only', 'No warnings found'], ['ordinary.localhost', '/ordinary', 'No warnings found']];
  for (const [host, route, expected] of cases) {
    const url = `http://${host}:${server.address().port}${route}`;
    await target.goto(url);
    const tabId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url)?.id, url);
    assert.ok(tabId);
    const popup = await context.newPage();
    const errors = []; popup.on('pageerror', error => errors.push(error.message));
    await popup.goto(`chrome-extension://${id}/popup.html?tab=${tabId}`);
    await popup.locator('#scan').click();
    await popup.locator('#results').waitFor({ state: 'visible' });
    assert.equal(await popup.locator('#verdict-title').innerText(), expected);
    assert.deepEqual(errors, []);
    const downloadPromise = popup.waitForEvent('download');
    await popup.locator('#export').click();
    const download = await downloadPromise;
    const report = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(report.hostname, host);
    checks.push({ scenario: host + route, verdict: report.verdict, elapsedMs: report.elapsedMs, passed: true });
    await popup.close();
  }
  const options = await context.newPage();
  await options.goto(`chrome-extension://${id}/options.html`);
  await options.locator('#model').check();
  await options.locator('#save').click();
  await options.locator('#status.success').waitFor();
  const stored = await worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  assert.equal(stored.includeModel, true);
  checks.push({ scenario: 'settings persisted', passed: true });
  await mkdir('reports', { recursive: true });
  await writeFile('reports/browser-integration.json', JSON.stringify({ status: 'passed', notice: 'Test-only manifest grants loopback host access. Production activeTab grant via toolbar needs the manual smoke test in docs/TESTING.md.', checks }, null, 2));
  console.log(`Real Chromium: ${checks.length} integration checks passed.`);
} catch (error) {
  await mkdir('reports', { recursive: true });
  await writeFile('reports/browser-integration.json', JSON.stringify({ status: 'blocked_or_failed', error: error.message, checks }, null, 2));
  throw error;
} finally {
  if (context) await context.close();
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
