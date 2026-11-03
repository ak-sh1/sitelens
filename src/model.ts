import model from '../ml/model.json';
import { FEATURE_NAMES, urlFeatures } from './features';

export function predictUrl(url: string) {
  if (!model.available) return null;
  const features = urlFeatures(url);
  const contributions = features.map((value, i) => ((value - model.mean[i]) / model.scale[i]) * model.coefficients[i]);
  const logit = model.intercept + contributions.reduce((sum, value) => sum + value, 0);
  const score = 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, logit))));
  const topSignals = contributions.map((value, i) => ({ value, name: FEATURE_NAMES[i] })).filter(item => item.value > 0).sort((a, b) => b.value - a.value).slice(0, 3).map(item => item.name.replaceAll('_', ' '));
  return { score, elevated: score >= model.threshold, topSignals, version: model.version };
}

export const MODEL_METADATA = model;
