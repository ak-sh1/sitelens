# Third-party notices

## tldts and tldts-core

Domain parsing uses these MIT-licensed packages, which incorporate Public Suffix List data.
Their complete license texts are copied into `dist/tldts-LICENSE.txt` and `dist/tldts-core-LICENSE.txt` during the build.
The Public Suffix List is available at https://publicsuffix.org/ and uses the Mozilla Public License 2.0 for its source data.
Package versions are pinned in `package-lock.json`. Refresh the packages and rebuild periodically to update suffix data.

## PhiUSIIL dataset and model

Arvind Prasad and Shalini Chandra. 2024. *PhiUSIIL Phishing URL (Website)*. UCI Machine Learning Repository.
Dataset: https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset
DOI: https://doi.org/10.1016/j.cose.2023.103545
License: Creative Commons Attribution 4.0 International, https://creativecommons.org/licenses/by/4.0/

This project trains a logistic classifier on transformed hostname features and inverted class labels. Numeric weights, scaling values, small numeric inference-parity examples, and aggregate metrics are distributed; raw dataset rows are not.
Retain this attribution for the dataset-derived model artifacts. See `ml/MODEL_CARD.md` for source archive checksum, method, splits, results, and limitations.

## Development tools

TypeScript, esbuild, Playwright, jsdom, NumPy, and scikit-learn are development/training dependencies and are not bundled as extension runtime services.
No external fonts, images, or AI-generated assets are used by the extension.
