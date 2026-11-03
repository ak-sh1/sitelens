import { writeFile, mkdir } from 'node:fs/promises';
import { analyzePage, MODEL_METADATA } from '../.artifacts/core.mjs';
import { fixtures } from '../tests/fixtures.mjs';

const cases = fixtures.map(f => {
  const rule = analyzePage(f.page, { includeModel: false, customBrands: [] });
  const hybrid = analyzePage(f.page, { includeModel: true, customBrands: [] });
  return { name: f.name, expectedRuleVerdict: f.expected, ruleVerdict: rule.verdict, hybridVerdict: hybrid.verdict, modelSignal: hybrid.model?.signal, rulePass: rule.verdict === f.expected };
});
const report = { notice: 'Curated regression cases are not a phishing benchmark or an estimate of real browsing protection. URL classifier holdout metrics are a separate historical experiment. Full rule/hybrid precision and recall on contemporary websites have not been established.', curatedCases: { passed: cases.filter(c => c.rulePass).length, total: cases.length, modelChangedVerdicts: cases.filter(c => c.ruleVerdict !== c.hybridVerdict).length, cases }, historicalUrlModel: { version: MODEL_METADATA.version, datasetYear: 2024, threshold: MODEL_METADATA.threshold, metrics: MODEL_METADATA.metrics } };
await mkdir('reports', { recursive: true });
await writeFile('reports/evaluation.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Rules: ${report.curatedCases.passed}/${cases.length} curated cases matched expected behavior.`);
console.log(`Hybrid changed ${report.curatedCases.modelChangedVerdicts} curated verdicts. These are not proof of improvement.`);
if (report.curatedCases.passed !== cases.length) process.exitCode = 1;
