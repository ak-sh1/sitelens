export function snapshot(url = 'https://ordinary.example/', overrides = {}) {
  return { url, identityText: 'Ordinary website', passwordCount: 0, passwordFormTargets: [], unownedPasswordCount: 0, misleadingLinks: [], iframeCount: 0, truncated: false, ...overrides };
}
const login = (url, identityText, action = url, extra = {}) => snapshot(url, { identityText, passwordCount: 1, passwordFormTargets: [action], ...extra });
export const fixtures = [
  { name: 'Recognized Google login', page: login('https://accounts.google.com/login', 'Google Sign in'), expected: 'clear', id: null },
  { name: 'Microsoft legitimate authentication domain', page: login('https://login.microsoftonline.com/common/', 'Microsoft Sign in'), expected: 'clear', id: null },
  { name: 'Google lookalike', page: login('https://gooogle.com/login', 'Google Sign in'), expected: 'high', id: 'lookalike-domain' },
  { name: 'Recognized text nested under unrelated root', page: login('https://paypal.com.account-check.example/login', 'PayPal Sign in'), expected: 'high', id: 'nested-brand-domain' },
  { name: 'Unrecognized password form destination', page: login('https://portal.example/', 'Portal', 'https://collector.example.net/submit'), expected: 'review', id: 'external-password-form' },
  { name: 'Known SSO is informational', page: login('https://portal.example/', 'Portal', 'https://accounts.google.com/'), expected: 'clear', id: 'recognized-identity-provider' },
  { name: 'Known SSO never excuses a lookalike', page: login('https://gooogle.com/', 'Google', 'https://accounts.google.com/'), expected: 'high', id: 'lookalike-domain' },
  { name: 'HTTP declared submission', page: login('https://portal.example/', 'Portal', 'http://portal.example/submit'), expected: 'high', id: 'insecure-submission' },
  { name: 'HTTP page with password', page: login('http://portal.example/', 'Portal'), expected: 'high', id: 'insecure-login-page' },
  { name: 'No-password brand mention does not imply impersonation', page: snapshot('https://notes.example/', { identityText: 'Microsoft and Google product comparison' }), expected: 'clear', id: null },
  { name: 'Mismatched displayed URL', page: snapshot('https://portal.example/', { misleadingLinks: [{ displayedHost: 'paypal.com', actualHost: 'other.example' }] }), expected: 'review', id: 'misleading-link' },
  { name: 'Same registered site link variation', page: snapshot('https://portal.example/', { misleadingLinks: [{ displayedHost: 'www.google.com', actualHost: 'support.google.com' }] }), expected: 'clear', id: null },
  { name: 'Punycode alone is informational', page: snapshot('https://xn--bcher-kva.de/'), expected: 'clear', id: 'internationalized-domain' },
  { name: 'A model-free ordinary HTTPS page', page: snapshot(), expected: 'clear', id: null },
  { name: 'Northstar local legitimate login', page: login('http://northstar.localhost:4173/login', 'Northstar'), expected: 'clear', id: null },
  { name: 'Northstar local lookalike', page: login('http://northstarr.localhost:4173/login', 'Northstar'), expected: 'high', id: 'lookalike-domain' },
  { name: 'Northstar demo SSO', page: login('http://northstar.localhost:4173/sso', 'Northstar', 'http://identity.localhost:4173/receive'), expected: 'clear', id: 'recognized-identity-provider' },
  { name: 'Userinfo is not the hostname', page: login('https://paypal.com@other.example/login', 'Portal'), expected: 'review', id: 'url-userinfo' },
  { name: 'Unowned password field surfaces uncertainty', page: snapshot('https://portal.example/', { passwordCount: 1, unownedPasswordCount: 1 }), expected: 'clear', id: null, coverage: 'submission destinations are unknown' },
  { name: 'Embedded frame is explicitly uninspected', page: snapshot('https://portal.example/', { iframeCount: 2 }), expected: 'clear', id: null, coverage: '2 embedded frame' },
];
