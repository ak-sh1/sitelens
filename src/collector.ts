import type { RawPage } from './types';

// Self-contained: Chrome serializes this function into an isolated world.
export function collectPage(): RawPage {
  const visible = (element: Element) => {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  };
  const resolve = (value: string) => { try { return new URL(value, document.baseURI).href; } catch { return ''; } };
  const allPasswords = [...document.querySelectorAll<HTMLInputElement>('input[type="password"]')];
  const passwords = allPasswords.filter(visible).slice(0, 100);
  const forms = [...new Set(passwords.map(field => field.form).filter((form): form is HTMLFormElement => !!form))];
  const targets: string[] = [];
  for (const form of forms) {
    targets.push(resolve(form.getAttribute('action') || location.href));
    for (const button of form.querySelectorAll<HTMLElement>('[formaction]')) targets.push(resolve(button.getAttribute('formaction') || location.href));
    // Buttons outside a form can reference it via form="id".
    if (form.id) for (const button of document.querySelectorAll<HTMLElement>('[form][formaction]')) {
      if (button.getAttribute('form') === form.id) targets.push(resolve(button.getAttribute('formaction') || location.href));
    }
  }
  const identityElements = [...document.querySelectorAll('h1,h2,img[alt],[role="img"][aria-label]')].filter(visible).slice(0, 60);
  const identityText = [document.title, ...identityElements.map(element => element.getAttribute('alt') || element.getAttribute('aria-label') || element.textContent || '')].join(' ').replace(/\s+/g, ' ').slice(0, 4000);
  const anchors = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')];
  const misleadingLinks: RawPage['misleadingLinks'] = [];
  for (const anchor of anchors.slice(0, 1500)) {
    const text = (anchor.textContent || '').trim();
    if (!visible(anchor) || !/^(?:https?:\/\/)?(?:[a-z\d-]+\.)+[a-z]{2,}(?:[/:?#]|$)/i.test(text) || /\s/.test(text)) continue;
    try {
      const displayed = new URL(/^https?:/i.test(text) ? text : `https://${text}`).hostname.toLowerCase();
      const actual = new URL(anchor.href).hostname.toLowerCase();
      if (displayed !== actual) misleadingLinks.push({ displayedHost: displayed, actualHost: actual });
    } catch { /* Ignore malformed link labels, rather than interpreting them as URLs. */ }
    if (misleadingLinks.length >= 10) break;
  }
  return {
    url: location.href,
    identityText,
    passwordCount: passwords.length,
    passwordFormTargets: [...new Set(targets.filter(Boolean))].slice(0, 100),
    unownedPasswordCount: passwords.filter(field => !field.form).length,
    misleadingLinks,
    iframeCount: document.querySelectorAll('iframe,frame').length,
    truncated: anchors.length > 1500 || allPasswords.length > 100,
  };
}
