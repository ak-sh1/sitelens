"""Train/export a browser-local logistic classifier with domain-disjoint evaluation."""
import hashlib
import json
from pathlib import Path
import numpy as np
import sklearn
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, confusion_matrix, precision_score, recall_score, roc_auc_score, roc_curve
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
rows = [json.loads(line) for line in (DATA / 'features.jsonl').open()]
X = np.asarray([row['x'] for row in rows], dtype=np.float64)
y = np.asarray([row['y'] for row in rows])
groups = np.asarray([row['group'] for row in rows])
schema = json.loads((DATA / 'feature-schema.json').read_text())
trainval, test = next(GroupShuffleSplit(n_splits=1, test_size=.2, random_state=42).split(X, y, groups))
train_i, val_i = next(GroupShuffleSplit(n_splits=1, test_size=.2, random_state=43).split(X[trainval], y[trainval], groups[trainval]))
train, val = trainval[train_i], trainval[val_i]
assert not (set(groups[train]) & set(groups[val]) or set(groups[train]) & set(groups[test]) or set(groups[val]) & set(groups[test]))
scaler = StandardScaler().fit(X[train])
classifier = LogisticRegression(max_iter=1500, class_weight='balanced', random_state=42).fit(scaler.transform(X[train]), y[train])
val_p = classifier.predict_proba(scaler.transform(X[val]))[:, 1]
fpr, tpr, thresholds = roc_curve(y[val], val_p)
eligible = np.flatnonzero((fpr <= .01) & np.isfinite(thresholds) & (thresholds <= 1))
best = eligible[np.argmax(tpr[eligible])] if len(eligible) else None
threshold = float(thresholds[best]) if best is not None else 1.0

def metrics(indices):
    p = classifier.predict_proba(scaler.transform(X[indices]))[:, 1]
    predicted = p >= threshold
    tn, fp, fn, tp = confusion_matrix(y[indices], predicted, labels=[0, 1]).ravel()
    return {'rows': len(indices), 'domains': len(set(groups[indices])), 'phishing_rows': int(y[indices].sum()), 'roc_auc': float(roc_auc_score(y[indices], p)), 'average_precision': float(average_precision_score(y[indices], p)), 'precision': float(precision_score(y[indices], predicted, zero_division=0)), 'recall': float(recall_score(y[indices], predicted, zero_division=0)), 'false_positive_rate': float(fp / max(1, fp + tn)), 'confusion': {'true_negative': int(tn), 'false_positive': int(fp), 'false_negative': int(fn), 'true_positive': int(tp)}}

source = json.loads((DATA / 'source.json').read_text())
model = {'available': True, 'version': 'phiusiil-hostname-logistic-v1', 'experimental': True, 'threshold': threshold, 'featureNames': schema['featureNames'], 'mean': scaler.mean_.tolist(), 'scale': scaler.scale_.tolist(), 'coefficients': classifier.coef_[0].tolist(), 'intercept': float(classifier.intercept_[0]), 'source': source, 'sklearn_version': sklearn.__version__, 'split': 'registrable-domain-disjoint; seeds 42/43; train 64%, validation 16%, test 20% of groups', 'threshold_selection': 'maximize validation recall subject to validation false-positive rate <= 1%; test labels never used for selection', 'metrics': {'train': metrics(train), 'validation': metrics(val), 'test': metrics(test)}}
(ROOT / 'model.json').write_text(json.dumps(model, indent=2) + '\n')
# Small numeric feature vectors, not source URLs, verify Python/JavaScript inference parity.
parity = [{'x': X[i].tolist(), 'score': float(classifier.predict_proba(scaler.transform(X[[i]]))[0, 1])} for i in test[:25]]
(ROOT / 'parity.json').write_text(json.dumps(parity, indent=2) + '\n')
t = model['metrics']['test']
card = f'''# SiteLens experimental URL model

This is an educational hostname-pattern classifier, not a validated protection product.
It runs inside the extension. Raw URLs, model inputs, and page contents are not sent to a server.

## Dataset and provenance

PhiUSIIL Phishing URL (Website), Arvind Prasad and Shalini Chandra, 2024.
UCI Machine Learning Repository: https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset
DOI: https://doi.org/10.1016/j.cose.2023.103545. License: CC BY 4.0.
Archive SHA-256: `{source['archive_sha256']}`.
Only raw URL strings and labels are used; none of the dataset's precomputed features are used.
Original legitimate=1/phishing=0 labels are inverted to phishing=1.
All {len(rows):,} valid deduplicated rows are used. The source dataset is not redistributed.

## Method

StandardScaler plus balanced logistic regression, scikit-learn {sklearn.__version__}.
Twelve hostname features are computed by the same TypeScript/JavaScript implementation during training and browser inference.
Protocol, path, query, port, and a leading www label are excluded to reduce obvious dataset shortcuts.
The original dataset largely represents legitimate sites by HTTPS homepages; full-URL features produced misleading warnings on ordinary login paths, so those features were removed before selecting this final model.
Private PSL entries are included when defining registrable-domain groups.
Train/validation/test groups are disjoint, with deterministic seeds 42 and 43.
Actual row counts differ from group fractions because domain groups have different sizes.
The threshold ({threshold:.6f}) maximizes validation recall subject to validation FPR <= 1%.
No test labels are used for training, scaling, or threshold selection.

## Held-out URL classification results

| Metric | Result |
| --- | ---: |
| Test rows | {t['rows']:,} |
| Test domains | {t['domains']:,} |
| ROC AUC | {t['roc_auc']:.4f} |
| Average precision | {t['average_precision']:.4f} |
| Phishing precision | {t['precision']:.4f} |
| Phishing recall | {t['recall']:.4f} |
| Legitimate-URL false-positive rate | {t['false_positive_rate']:.4f} |

Full split metrics and confusion matrices are in model.json.

## Limits and intended use

- This is a historical 2024 dataset. Domain-disjoint splitting does not eliminate temporal drift, dataset artifacts, brand overlap, or campaign-level leakage.
- These are URL classification results, not a measurement of current browsing protection or of the full DOM/rule/hybrid system.
- No external contemporary dataset or prospective browser study has been evaluated.
- The output is not calibrated as a phishing probability. The UI displays only low/elevated experimental signal.
- A low model signal never suppresses rule warnings. A model alone can request review, never assert safety or issue the strongest verdict.
- The default is rules-only. Local development URLs are outside the model's intended distribution and skip model inference.
- The extension also skips the classifier on configured brand domains to avoid redundant hostname false alarms; evidence rules still run there. That registry policy is not part of the standalone dataset metrics above and does not establish page safety.
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
'''
(ROOT / 'MODEL_CARD.md').write_text(card)
print(json.dumps({'threshold': threshold, 'test': t}, indent=2))
