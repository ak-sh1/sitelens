import { collectPage } from './collector';
import { analyzePage } from './analyzer';
import { getSettings, validateSettings } from './settings';

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return false;
  const execute = async () => {
    switch (message?.type) {
      case 'GET_SETTINGS': return { settings: await getSettings() };
      case 'SAVE_SETTINGS': {
        const settings = validateSettings(message.settings);
        await chrome.storage.local.set({ settings });
        return { settings };
      }
      case 'SCAN': {
        if (!Number.isInteger(message.tabId) || message.tabId < 0) throw new Error('Choose a browser tab to scan.');
        const tab = await chrome.tabs.get(message.tabId);
        if (!tab.url || !/^https?:\/\//i.test(tab.url)) throw new Error('Open a regular HTTP or HTTPS webpage. Browser settings, the Web Store, and extension pages cannot be scanned.');
        const start = performance.now();
        let results;
        try { results = await chrome.scripting.executeScript({ target: { tabId: message.tabId }, func: collectPage }); }
        catch { throw new Error('Chrome could not inspect this page. Reopen SiteLens from its toolbar icon on the webpage. Some protected pages cannot be inspected.'); }
        const page = results[0]?.result;
        if (!page) throw new Error('No page details were returned. Reload the page and scan again.');
        const report = analyzePage(page, await getSettings());
        report.elapsedMs = Math.round(performance.now() - start);
        // Only this sanitized report reaches the popup. No URL paths, query strings,
        // raw branding text, HTML, or input values are persisted or exported.
        return { report };
      }
      default: throw new Error('Unknown request.');
    }
  };
  execute().then(data => respond({ ok: true, ...data })).catch(error => respond({ ok: false, error: error instanceof Error ? error.message : 'The scan could not be completed.' }));
  return true;
});
