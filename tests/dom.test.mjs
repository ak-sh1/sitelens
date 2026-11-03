import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { collectPage, analyzePage } from '../.artifacts/core.mjs';
import { startDemoServer } from '../scripts/demo-server.mjs';

const settings = { includeModel: false, customBrands: [] };
function documentAt(html, url) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  // jsdom has no layout engine. Visibility is approximated here; real Chrome
  // getClientRects behavior remains covered by the separate browser runner.
  dom.window.HTMLElement.prototype.getClientRects = function () { return this.isConnected ? [{}] : []; };
  dom.window.fetch = () => { throw new Error('Network access is forbidden in scanning.'); };
  return dom;
}
function collect(dom) { return dom.window.eval(`(${collectPage.toString()})()`); }
const plain = '<title>Portal</title><h1>Portal</h1><form action="/submit"><input type="password" value="PRIVATE-INPUT-MARKER"><button>Go</button></form>';

test('DOM collector finds visible forms without reading password values', () => {
  const dom = documentAt(plain + '<input type="password" style="display:none">', 'https://portal.example/login?private=TOKEN');
  try {
    const page = collect(dom);
    assert.equal(page.passwordCount, 1);
    assert.equal(page.passwordFormTargets[0], 'https://portal.example/submit');
    assert.equal(JSON.stringify(page).includes('PRIVATE-INPUT-MARKER'), false);
    const report = analyzePage(page, settings);
    assert.equal(report.verdict, 'clear');
    assert.equal(JSON.stringify(report).includes('TOKEN'), false);
  } finally { dom.window.close(); }
});

test('Collector respects base URL and submit-button action overrides', () => {
  const dom = documentAt('<base href="https://base.example/dir/"><form id="login" action="submit"><input type="password"><button formaction="https://outside.example/receive">Go</button></form><button form="login" formaction="https://another.example/receive">Other</button>', 'https://portal.example/');
  try {
    const targets = Array.from(collect(dom).passwordFormTargets);
    assert.deepEqual(targets.sort(), ['https://base.example/dir/submit', 'https://outside.example/receive', 'https://another.example/receive'].sort());
  } finally { dom.window.close(); }
});

test('Collector extracts visible URL mismatches and flags collection limits', () => {
  const dom = documentAt('<a href="https://outside.example/">https://paypal.com</a>' + '<a href="/normal">Normal text</a>'.repeat(1501), 'https://portal.example/');
  try {
    const page = collect(dom);
    assert.equal(page.misleadingLinks.length, 1);
    assert.equal(page.misleadingLinks[0].actualHost, 'outside.example');
    assert.equal(page.truncated, true);
  } finally { dom.window.close(); }
});

test('All eight served demo scenarios produce their documented rule outcomes', async () => {
  const server = await startDemoServer(0);
  try {
    const port = server.address().port;
    const examples = [
      ['northstar.localhost', '/login', 'clear'], ['northstarr.localhost', '/login', 'high'],
      ['northstar.localhost', '/external', 'review'], ['northstar.localhost', '/sso', 'clear'],
      ['northstar.localhost', '/insecure', 'high'], ['northstar.localhost', '/misleading', 'review'],
      ['northstar.localhost', '/js-only', 'clear'], ['ordinary.localhost', '/ordinary', 'clear'],
    ];
    for (const [host, path, expected] of examples) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-security-policy').includes("form-action 'none'"));
      const dom = documentAt(await response.text(), `http://${host}:${port}${path}`);
      try { assert.equal(analyzePage(collect(dom), settings).verdict, expected, host + path); }
      finally { dom.window.close(); }
    }
    const post = await fetch(`http://127.0.0.1:${port}/receive`, { method: 'POST', body: 'dummy' });
    assert.equal(post.status, 405);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

async function harness(html = plain, url = 'https://portal.example/') {
  const page = documentAt(html, url);
  let messageListener;
  let stored = {};
  let exported;
  const id = 'abcdefghijklmnopqrstuvwxzyabcdef';
  const extensionUrl = `chrome-extension://${id}/`;
  const bridge = {
    runtime: { id, getURL: path => extensionUrl + path, onMessage: { addListener: fn => { messageListener = fn; } }, openOptionsPage: async () => {},
      sendMessage: message => new Promise(resolve => { const keep = messageListener(message, { id, url: extensionUrl + 'popup.html' }, resolve); if (!keep) resolve(undefined); }),
    },
    storage: { local: { get: async key => ({ [key]: stored[key] }), set: async value => { stored = { ...stored, ...value }; } } },
    tabs: { get: async () => ({ id: 1, url }), query: async () => [{ id: 1, url }] },
    scripting: { executeScript: async ({ func }) => [{ result: page.window.eval(`(${func.toString()})()`) }] },
  };
  const worker = documentAt('<p>Worker test context</p>', extensionUrl + 'background-test.html');
  worker.window.chrome = bridge;
  worker.window.eval(await readFile(new URL('../dist/background.js', import.meta.url), 'utf8'));
  const popup = documentAt(await readFile(new URL('../dist/popup.html', import.meta.url), 'utf8'), extensionUrl + 'popup.html');
  popup.window.chrome = bridge;
  popup.window.Blob = Blob;
  popup.window.URL.createObjectURL = blob => { exported = blob; return 'blob:test-export'; };
  popup.window.URL.revokeObjectURL = () => {};
  popup.window.HTMLAnchorElement.prototype.click = function () {};
  popup.window.eval(await readFile(new URL('../dist/popup.js', import.meta.url), 'utf8'));
  return { page, worker, popup, bridge, getExport: () => exported, close: () => { page.window.close(); worker.window.close(); popup.window.close(); } };
}
async function until(predicate) {
  const deadline = Date.now() + 3000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error('UI did not reach expected state.'); await new Promise(resolve => setTimeout(resolve, 5)); }
}

test('Popup → background → injected collector → analyzer → evidence → export', async () => {
  const h = await harness('<title>Google</title><h1>Google</h1><form><input type="password" value="DO-NOT-EXPORT"></form>', 'https://gooogle.com/private?secret=DO-NOT-EXPORT');
  try {
    h.popup.window.document.getElementById('scan').click();
    await until(() => !h.popup.window.document.getElementById('results').hidden);
    assert.equal(h.popup.window.document.getElementById('verdict-title').textContent, 'Warning signs found');
    assert.match(h.popup.window.document.getElementById('findings').textContent, /Possible lookalike domain/);
    h.popup.window.document.getElementById('export').click();
    const report = JSON.parse(await h.getExport().text());
    assert.equal(report.hostname, 'gooogle.com');
    assert.equal(report.verdict, 'high');
    assert.equal(JSON.stringify(report).includes('DO-NOT-EXPORT'), false);
  } finally { h.close(); }
});

test('Restricted-page scan produces an explicit error, not a clean verdict', async () => {
  const h = await harness(plain, 'chrome://settings/');
  try {
    h.popup.window.document.getElementById('scan').click();
    await until(() => !h.popup.window.document.getElementById('error').hidden);
    assert.match(h.popup.window.document.getElementById('error').textContent, /regular HTTP or HTTPS/);
    assert.equal(h.popup.window.document.getElementById('results').hidden, true);
  } finally { h.close(); }
});

test('Extension handles failed script injection with actionable error text', async () => {
  const h = await harness();
  try {
    h.bridge.scripting.executeScript = async () => { throw new Error('Missing host permission'); };
    h.popup.window.document.getElementById('scan').click();
    await until(() => !h.popup.window.document.getElementById('error').hidden);
    assert.match(h.popup.window.document.getElementById('error').textContent, /toolbar icon/);
  } finally { h.close(); }
});

test('Settings UI validates, persists, and affects subsequent scans', async () => {
  const h = await harness('<h1>Acme</h1><input type="password">', 'https://unrelated.example/');
  const options = documentAt(await readFile(new URL('../dist/options.html', import.meta.url), 'utf8'), 'chrome-extension://abcdefghijklmnopqrstuvwxzyabcdef/options.html');
  try {
    options.window.chrome = h.bridge;
    await options.window.eval(`(async () => {${await readFile(new URL('../dist/options.js', import.meta.url), 'utf8')} })()`);
    const d = options.window.document;
    d.getElementById('add-brand').click();
    d.querySelector('.brand-name').value = 'Acme';
    d.querySelector('.brand-domains').value = 'https://acme.example';
    d.getElementById('save').click();
    await until(() => d.getElementById('status').className.includes('error'));
    d.querySelector('.brand-domains').value = 'acme.example';
    d.getElementById('model').checked = true; d.getElementById('save').click();
    await until(() => d.getElementById('status').className.includes('success'));
    const scan = await h.bridge.runtime.sendMessage({ type: 'SCAN', tabId: 1 });
    assert.equal(scan.ok, true); assert.equal(scan.report.facts.claimedBrand, 'Acme');
    assert.ok(scan.report.findings.some(f => f.id === 'brand-domain-mismatch'));
    assert.ok(scan.report.model);
    d.querySelector('.remove-brand').click();
    assert.equal(d.getElementById('brands-empty').hidden, false);
    d.getElementById('save').click();
    await new Promise(resolve => setTimeout(resolve, 10));
    const removed = await h.bridge.runtime.sendMessage({ type: 'GET_SETTINGS' });
    assert.equal(removed.settings.customBrands.length, 0);
  } finally { options.window.close(); h.close(); }
});

test('Model ignores paths/protocol and skips local development addresses', async () => {
  const { urlFeatures } = await import('../.artifacts/core.mjs');
  assert.deepEqual(urlFeatures('https://www.example.com/'), urlFeatures('http://example.com/login?token=123'));
  const report = analyzePage({ url: 'http://northstar.localhost:4173/', identityText: '', passwordCount: 0, passwordFormTargets: [], misleadingLinks: [], iframeCount: 0, unownedPasswordCount: 0, truncated: false }, { ...settings, includeModel: true });
  assert.equal(report.model, null);
  assert.ok(report.coverage.some(line => line.includes('skipped')));
});
