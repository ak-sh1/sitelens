# Testing SiteLens

## Automated local checks

`npm ci && npm run typecheck && npm test && npm run evaluate`

The normal suite runs in Node and jsdom. Its simulated Chrome API dispatches real bundled worker code, executes the actual collector inside a test document, analyzes the result, renders the real popup script, and exports the resulting JSON.
That checks application data flow, not actual browser permissions or rendering.
The demo server is started on a temporary loopback port during tests. Demo forms reject POST and carry `form-action 'none'`.

`reports/evaluation.json` separates curated rule regressions from the historical classifier holdout. Curated cases must not be presented as a detection accuracy study.
The optional classifier can still produce false alarms; the evaluation lists changed verdicts rather than assuming those changes are improvements.

## Optional Chromium integration runner

Run `npx playwright install chromium`, then `npm run test:browser`.
The runner loads a temporary copy of `dist/` with access only to local demo hosts, tests all eight scenarios through the actual extension worker and popup, downloads reports, and saves settings.
It does not change the shipped manifest. The additional test-only host grant allows headless automation to call the collector without needing to click the browser toolbar.
Consequently, a real toolbar `activeTab` grant still needs the smoke test below.

## Manual Chrome smoke test

1. Load the production `dist/` using `chrome://extensions` → Developer mode → Load unpacked.
2. Confirm there are no manifest or worker errors on the extension card.
3. Pin the toolbar icon. Start `node scripts/demo-server.mjs`.
4. Open `http://localhost:4173` and launch the legitimate login scenario.
5. Click the toolbar icon and **Scan this page**. Expect “No warnings found.”
6. Open the lookalike scenario and scan it. Expect “Warning signs found” and domain evidence.
7. Test external-form and known-identity-provider cases. Expect review and informational context respectively.
8. Export a report. Check hostname/evidence and absence of URL paths, query tokens, and input values.
9. Open settings, toggle the model, save, and rescan a local page. The UI should explicitly say the model was skipped on local origins.
10. Scan `chrome://settings`. Expect a helpful error, never a successful verdict.
11. Close/reopen the popup. Scan reports should be gone; settings should persist.
12. Inspect narrow popup width, keyboard navigation, long hostnames, and expanded coverage text.

## Model experiment

Training groups are registrable domains, including private PSL suffix boundaries. Scaling and fitting use training only; threshold choice uses validation only; test metrics are reported separately.
Duplicate exact URLs are removed before feature extraction. The model operates on hostnames, so within-group duplicate hostnames may still exist; groups cannot cross splits.
This setup reduces domain leakage but does not remove campaign, brand, time, or collection-source biases.
The dataset does not provide a chronological evaluation in this pipeline. Contemporary performance remains unknown.
