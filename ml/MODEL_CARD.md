# SiteLens experimental URL model

This is an educational hostname-pattern classifier, not a validated protection product.
It runs inside the extension. Raw URLs, model inputs, and page contents are not sent to a server.

## Dataset and provenance

PhiUSIIL Phishing URL (Website), Arvind Prasad and Shalini Chandra, 2024.
UCI Machine Learning Repository: https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset
DOI: https://doi.org/10.1016/j.cose.2023.103545. License: CC BY 4.0.
Archive SHA-256: `0a639fd03aea6308c5b1c10c92aa23c2ce1505447a9137271865cd0badc9a59a`.
Only raw URL strings and labels are used; none of the dataset's precomputed features are used.
Original legitimate=1/phishing=0 labels are inverted to phishing=1.
All 235,370 valid deduplicated rows are used. The source dataset is not redistributed.

## Method

StandardScaler plus balanced logistic regression, scikit-learn 1.8.0.
Twelve hostname features are computed by the same TypeScript/JavaScript implementation during training and browser inference.
Protocol, path, query, port, and a leading www label are excluded to reduce obvious dataset shortcuts.
The original dataset largely represents legitimate sites by HTTPS homepages; full-URL features produced misleading warnings on ordinary login paths, so those features were removed before selecting this final model.
Private PSL entries are included when defining registrable-domain groups.
Train/validation/test groups are disjoint, with deterministic seeds 42 and 43.
Actual row counts differ from group fractions because domain groups have different sizes.
The threshold (0.892121) maximizes validation recall subject to validation FPR <= 1%.
No test labels are used for training, scaling, or threshold selection.

## Held-out URL classification results

| Metric | Result |
| --- | ---: |
| Test rows | 46,104 |
| Test domains | 39,461 |
| ROC AUC | 0.7936 |
| Average precision | 0.8153 |
| Phishing precision | 0.9770 |
| Phishing recall | 0.4205 |
| Legitimate-URL false-positive rate | 0.0071 |

Full split metrics and confusion matrices are in model.json.

## Limits and intended use

- This is a historical 2024 dataset. Domain-disjoint splitting does not eliminate temporal drift, dataset artifacts, brand overlap, or campaign-level leakage.
- These are URL classification results, not a measurement of current browsing protection or of the full DOM/rule/hybrid system.
- No external contemporary dataset or prospective browser study has been evaluated.
- The output is not calibrated as a phishing probability. The UI displays only low/elevated experimental signal.
- A low model signal never suppresses rule warnings. A model alone can request review, never assert safety or issue the strongest verdict.
- The default is rules-only. Local development URLs are outside the model's intended distribution and skip model inference.
- The extension skips the classifier on configured brand domains to avoid redundant hostname false alarms; evidence rules still run. This registry policy is not part of the standalone metrics and does not establish safety.
- Hostname-only analysis cannot distinguish a compromised path on a legitimate domain from that domain's ordinary pages.
- Feature contributions describe this linear model, not causal proof or verified malicious behavior.
- There is no visual model, blacklist lookup, network observation, domain-age lookup, or remote AI service.

## Reproduce

From the project root (Node 20.19+, Python 3.11+):

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r ml/requirements.txt
npm ci
npm run build
python3 ml/prepare_data.py
node ml/extract_features.mjs
python3 ml/train.py
npm run build
npm test
```

Download requires internet. Runtime scanning does not.
