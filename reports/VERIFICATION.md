# Verification record

## Interface revision 1.0.1

The popup, settings, and demo pages use a compact system-font layout with plain labels and shorter explanations. The custom brand JSON editor was replaced with add/remove form fields. Scan semantics and model weights were not changed.
The existing settings integration check now exercises the form editor, validation, saving, and removal. The full 38-test suite and type check passed after the revision. Live Chrome rendering remains unverified because of the environment restrictions described below.

## Confirmed in the build environment

- TypeScript type checking passed.
- All 38 Node/jsdom automated tests passed, with no skipped tests.
- All 20 curated rule-regression cases matched expected verdicts.
- The actual demo HTTP server served all eight controlled scenarios, and the collector/analyzer produced the documented outcomes.
- The bundled popup → worker → serialized collector → analyzer → UI → JSON export flow passed with simulated Chrome APIs in jsdom.
- Settings validation, persistence, optional model activation, script-injection errors, and restricted-page errors passed in the simulated flow.
- Privacy checks confirmed that input values, URL paths, query tokens, and userinfo are absent from returned/exported reports.
- The final hostname model was trained on 235,370 valid, deduplicated rows from the attributed UCI dataset, with registrable-domain-disjoint train/validation/test groups.
- JavaScript model arithmetic matched 25 Python reference predictions to 1e-10 tolerance.
- The production manifest declares only activeTab, scripting, and storage; no persistent host access or outbound connection permission is present.

## Final model results

The held-out historical URL set contains 46,104 rows from 39,461 registrable domains.
The final hostname-only model has ROC AUC 0.7936, phishing precision 0.9770, phishing recall 0.4205, and legitimate-URL false-positive rate 0.0071 at the validation-selected threshold.
These figures describe only the 2024 dataset experiment. They are not an estimate of current browsing protection or of full hybrid-system performance.

An initial full-URL model looked stronger on the historical holdout but relied on protocol/path artifacts and raised misleading login-page warnings. It was replaced with the hostname-only model. The larger apparent score is not used in the final release.
The final classifier is optional, off by default, and skipped on local origins and configured brand domains. The included comparison shows one curated verdict changed by the hybrid policy; that is not evidence of a general improvement.

## Real browser limitation

A Chrome for Testing executable was obtained from Google's official distribution and launched through Playwright.
The host denied the UNIX socket required by Chromium's ProcessSingleton (`socket() failed: Operation not permitted`), preventing browser startup.
The separately provided browser surface also could not reach this workspace's localhost server (`ERR_CONNECTION_REFUSED`).
Consequently, real Chrome extension installation, activeTab toolbar grants, actual rendering/layout, and genuine Chrome download behavior have **not** been verified here. DOM tests do not replace those checks.

`tests/browser.mjs` is included for actual Chromium integration testing on a normal machine, using a temporary extension copy with loopback-only test permissions. It has been syntax-checked but could not run in this host.
The manual production-manifest smoke test is in `docs/TESTING.md`.

## Not implemented in this release

Continuous automatic scanning, browser-store publication, visual impersonation models, redirect observation, network request monitoring, live reputation feeds, and page-ownership verification.
