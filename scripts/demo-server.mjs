import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../demo/', import.meta.url));
export const scenarios = [
  { id: 'legitimate', host: 'northstar.localhost', path: '/login', label: 'Legitimate login', detail: 'Recognized domain and a same-site form target.', expected: 'No warnings', tone: 'green' },
  { id: 'lookalike', host: 'northstarr.localhost', path: '/login', label: 'Lookalike domain', detail: 'The same visual design, one extra letter in the domain.', expected: 'Warnings', tone: 'red' },
  { id: 'external', host: 'northstar.localhost', path: '/external', label: 'Unrecognized form destination', detail: 'A password form declares a different destination domain.', expected: 'Review', tone: 'amber' },
  { id: 'sso', host: 'northstar.localhost', path: '/sso', label: 'External authentication', detail: 'A recognized demo identity provider. External does not always mean malicious.', expected: 'No warnings', tone: 'green' },
  { id: 'http', host: 'northstar.localhost', path: '/insecure', label: 'Insecure declared target', detail: 'The form declares an HTTP target on a public-looking example domain.', expected: 'Warnings', tone: 'red' },
  { id: 'misleading', host: 'northstar.localhost', path: '/misleading', label: 'Misleading visible URL', detail: 'A link displays one domain but points to another.', expected: 'Review', tone: 'amber' },
  { id: 'js-only', host: 'northstar.localhost', path: '/js-only', label: 'Unknown JavaScript submission', detail: 'A password input has no HTML form. SiteLens reports the coverage gap.', expected: 'Limited scan', tone: 'gray' },
  { id: 'ordinary', host: 'ordinary.localhost', path: '/ordinary', label: 'Ordinary page', detail: 'An incidental brand mention without a password field.', expected: 'No warnings', tone: 'green' },
];

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shell = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><link rel="stylesheet" href="/demo.css"></head><body>${body}<script src="/demo.js"></script></body></html>`;

function hub(port) {
  const rows = scenarios.map((scenario, index) => `
    <tr>
      <td class="number">${String(index + 1).padStart(2, '0')}</td>
      <td>
        <a class="scenario-name" href="http://${scenario.host}:${port}${scenario.path}" target="_blank" rel="noopener">${scenario.label}</a>
        <div class="scenario-detail">${scenario.detail}</div>
      </td>
      <td class="host-column"><span class="scenario-host">${scenario.host}</span></td>
      <td><span class="result ${scenario.tone}">${scenario.expected}</span></td>
    </tr>`).join('');
  return shell('SiteLens demo pages', `
    <main class="hub">
      <header><span class="wordmark">SiteLens</span><span class="breadcrumb">Development</span></header>
      <div class="hub-intro">
        <h1>Demo pages</h1>
        <p>Open a page, then scan it with the SiteLens extension.</p>
      </div>
      <table class="scenario-table">
        <thead><tr><th scope="col" aria-label="Number"></th><th scope="col">Scenario</th><th scope="col" class="host-column">Address</th><th scope="col">Expected</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <details class="how">
        <summary>About these pages</summary>
        <p>Northstar is fictional. Every page runs locally, and form submission is disabled. Use dummy values.</p>
        <p>Compare the legitimate login with the lookalike. Their layouts are identical; their addresses differ. The external-form and sign-in-provider examples show why a different destination is not always suspicious.</p>
        <p>The demo recognizes northstar.localhost and identity.localhost. Local HTTP is treated as a development condition. The optional model is skipped on these addresses.</p>
      </details>
    </main>`);
}

function login(pathname, port) {
  const target = pathname === '/external' ? `http://collector.localhost:${port}/receive`
    : pathname === '/sso' ? `http://identity.localhost:${port}/receive`
    : pathname === '/insecure' ? 'http://receiver.example/receive' : '/receive';
  const note = pathname === '/sso' ? 'Continue with the demo identity provider.' : 'Use dummy details to test the scanner.';
  const fields = `
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="off" placeholder="you@example.test">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="off" placeholder="Dummy password">
    <button type="submit">${pathname === '/sso' ? 'Continue' : 'Sign in'}</button>`;
  const form = pathname === '/js-only' ? `<div class="login-fields">${fields}</div>`
    : `<form action="${escape(target)}" method="post">${fields}</form>`;
  const misleading = pathname === '/misleading'
    ? `<p class="support">Help: <a href="http://collector.localhost:${port}/help">https://northstar.localhost</a></p>` : '';
  return shell('Northstar · Sign in', `
    <header class="demo-banner"><span>Test page</span>Form submission disabled<a href="http://localhost:${port}/">All demos</a></header>
    <main class="login-layout">
      <div class="northstar-logo">Northstar</div>
      <section class="login-box">
        <h1>Sign in</h1>
        <p class="login-intro">${note}</p>
        ${form}
        ${misleading}
        <p id="demo-message" role="status"></p>
      </section>
    </main>`);
}

export function startDemoServer(port = 4173) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    const hostname = (req.headers.host || '').split(':')[0];
    if (!(hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost'))) { res.writeHead(403); res.end('Loopback demo hosts only.'); return; }
    if (req.method !== 'GET') { res.writeHead(405); res.end('Demo submissions are disabled.'); return; }
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (['/demo.css', '/demo.js'].includes(pathname)) {
      res.setHeader('Content-Type', pathname.endsWith('.css') ? 'text/css' : 'application/javascript');
      res.end(await readFile(path.join(root, pathname.slice(1)))); return;
    }
    if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (pathname === '/') res.end(hub(server.address().port));
    else if (pathname === '/ordinary') res.end(shell('Ordinary notes', '<main class="ordinary"><h1>Example article</h1><p>Northstar is mentioned here as an example. This page has no login form.</p></main>'));
    else if (['/login', '/external', '/sso', '/insecure', '/misleading', '/js-only'].includes(pathname)) res.end(login(pathname, server.address().port));
    else { res.writeHead(404); res.end(shell('Not found', '<main class="ordinary"><h1>Page not found.</h1><p>Return to the demo lab.</p></main>')); }
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve(server)); });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await startDemoServer(Number(process.env.SITELENS_DEMO_PORT || 4173));
  console.log(`SiteLens demo lab: http://localhost:${server.address().port}`);
  console.log('Open a scenario, then click the SiteLens toolbar icon. Ctrl+C stops the lab.');
}
