"""Download the attributed UCI dataset; emit raw rows locally, never in the extension."""
import csv
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
DATA.mkdir(exist_ok=True)
SOURCE = 'https://archive.ics.uci.edu/static/public/967/phiusiil+phishing+url+dataset.zip'
archive = DATA / 'phiusiil.zip'
if not archive.exists():
    print('Downloading UCI PhiUSIIL dataset…', flush=True)
    with urllib.request.urlopen(SOURCE, timeout=120) as response:
        archive.write_bytes(response.read())
with zipfile.ZipFile(archive) as z:
    csv_names = [name for name in z.namelist() if name.lower().endswith('.csv')]
    if len(csv_names) != 1:
        raise RuntimeError('Expected one CSV in the source archive.')
    seen, count = set(), 0
    with z.open(csv_names[0]) as source, (DATA / 'urls.jsonl').open('w') as output:
        for row in csv.DictReader(io.TextIOWrapper(source, encoding='utf-8-sig')):
            url = row['URL'].strip()
            if not url or url in seen:
                continue
            seen.add(url)
            # UCI labels legitimate=1, phishing=0. Our target is phishing=1.
            output.write(json.dumps({'url': url, 'label': 1 - int(row['label'])}) + '\n')
            count += 1
metadata = {'source': SOURCE, 'doi': '10.1016/j.cose.2023.103545', 'license': 'CC BY 4.0', 'creators': ['Arvind Prasad', 'Shalini Chandra'], 'dataset_year': 2024, 'archive_sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'unique_urls': count}
(DATA / 'source.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(f'Prepared {count:,} unique URL rows. Original label inverted to phishing=1.')
