# Scope, privacy, and threat model

SiteLens is an educational inspection aid. It neither blocks navigation nor certifies page safety.

## Data boundaries

- Only the active webpage is inspected following the user's extension action and scan click.
- There are no persistent host permissions or declarative content scripts in the production manifest.
- Visible field types, form declarations, selected headings/logo text, and hostname evidence are processed in memory.
- Field values, cookies, browsing history, screenshots, and network bodies are never read.
- Paths and queries may exist transiently in the current page URL; they are not included in reports or the final hostname-only model features.
- Page text is discarded after analysis. The returned report contains hostnames, counts, selected brand names, rule explanations, and coverage notes.
- No scan is saved unless the user explicitly exports it. Exported hostnames may still reveal which site was inspected.
- Only model preference and the user's custom brand registry are saved to local extension storage. There is no sync storage or telemetry.
- The extension CSP prohibits outbound connections and remote executable scripts.

## Untrusted input

Page content is untrusted. Content scripts run in Chrome's isolated world, and the UI renders collected data with textContent.
Brand aliases are escaped before regex matching. Element collections and text lengths are bounded.
Runtime messages are accepted only from this extension's own pages; externally_connectable is not declared.
The extension has no arbitrary URL-fetch service or server-side URL scanner.

## Known limitations

- Only a main-document snapshot is inspected. Cross-origin frames, shadow DOM, and later mutations may be missed.
- JavaScript can bypass or change declared form destinations. Observing a form declaration is not observing credential exfiltration.
- Brand mentions can be incidental, and curated domain registries can be incomplete.
- Domain recognition includes subdomains, which can include delegated content. Recognition does not establish safety or ownership.
- IDP recognition explains an external target; it does not authenticate the page or tenant.
- Local HTTP origins are treated as a development condition and explicitly disclosed.
- Model scores are not calibrated probabilities. A hostname-only model cannot detect a compromised path on a legitimate hostname.
- Reputation lookup, redirects, screenshots, ownership verification, network behavior, and continuous protection are outside this release.

## Demo containment

The demonstration server binds to 127.0.0.1 and accepts localhost/.localhost hosts only. It does not proxy requests or serve arbitrary files.
Forms use fictional/local/example destinations, reject submissions on the server, and are blocked by browser CSP and a preventDefault handler.
Use dummy input values. No real credentials are needed.
