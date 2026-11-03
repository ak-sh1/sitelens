# Start here

SiteLens is a local Chrome extension that explains suspicious website signals.
The extension is already built. You do not need npm, Python, an account, or an API key to load it.

## Load the extension on your Mac

1. Unzip `SiteLens.zip`.
2. Open Chrome and enter `chrome://extensions` in the address bar.
3. Turn on **Developer mode** using the switch at the top right.
4. Click **Load unpacked**.
5. Select the **dist** folder inside the extracted **sitelens** folder. Select the folder, not an individual file.
6. Open Chrome's puzzle-piece menu and pin **SiteLens — Website Inspector**.
7. Visit a normal webpage, click SiteLens, then click **Scan this page**.

Chrome's own settings pages, the Chrome Web Store, and other protected pages cannot be inspected.

## Try the demonstration

The demo requires Node.js 20.19+ (Node 22 LTS or newer is recommended). The prebuilt extension itself does not require Node.

Open Terminal in the extracted **sitelens** folder and run:

```bash
node scripts/demo-server.mjs
```

Open **http://localhost:4173** in Chrome. Try “Legitimate login,” then “Lookalike domain.”
The designs look alike, but their evidence differs. Open SiteLens on each scenario and scan it.
The demo has eight cases, including legitimate external authentication and an explicitly unknown JavaScript submission.
Press Control+C in Terminal when finished.

You can also run `bash start-demo.command` from the project folder on macOS.

## Optional model

Open **Settings**, enable the experimental hostname model, and click **Save changes**.
It runs locally and is off by default. It is skipped on local demo origins and configured brand domains.
The model card explains its historical evaluation, false positives, and missed cases. It is not a safety probability.

## What's included

- `dist/`: ready-to-load Chrome extension.
- `src/`: editable TypeScript source.
- `demo/` and `scripts/demo-server.mjs`: local demonstration lab.
- `ml/`: trained model, training scripts, provenance, and model card.
- `tests/`: rule, DOM/UI integration, privacy, and optional real-browser tests.
- `reports/`: actual evaluation results and verification limitations.
- `README.md`: development and architecture.

This is an educational inspection tool. A page with no detected warning signs has not been verified as safe.
