import fs from 'node:fs';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { domainInfo, urlFeatures, FEATURE_NAMES } from '../.artifacts/core.mjs';

const output = fs.createWriteStream(new URL('./data/features.jsonl', import.meta.url));
const input = createInterface({ input: fs.createReadStream(new URL('./data/urls.jsonl', import.meta.url)), crlfDelay: Infinity });
let count = 0, skipped = 0;
for await (const line of input) {
  const { url, label } = JSON.parse(line);
  try {
    const info = domainInfo(url);
    if (!info || !['http:', 'https:'].includes(info.url.protocol)) { skipped++; continue; }
    // The same exact JS extractor is used at training time and in the extension.
    const row = JSON.stringify({ x: urlFeatures(url), y: label, group: info.domain });
    if (!output.write(row + '\n')) await once(output, 'drain');
    count++;
  } catch { skipped++; }
}
output.end(); await once(output, 'finish');
fs.writeFileSync(new URL('./data/feature-schema.json', import.meta.url), JSON.stringify({ featureNames: FEATURE_NAMES, rows: count, skipped }, null, 2));
console.log(`Extracted ${count.toLocaleString()} rows; skipped ${skipped}. Registrable-domain groups use private PSL entries.`);
