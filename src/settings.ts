import { DEFAULT_SETTINGS } from './brands';
import type { Settings, Brand } from './types';

export function validateSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') throw new Error('Settings must be an object.');
  const input = value as Record<string, unknown>;
  if (typeof input.includeModel !== 'boolean' || !Array.isArray(input.customBrands) || input.customBrands.length > 50) throw new Error('Invalid settings format.');
  const customBrands: Brand[] = input.customBrands.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('Each brand needs a name, aliases, and domains.');
    const item = raw as Record<string, unknown>;
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!name || name.length > 80 || !Array.isArray(item.aliases) || !Array.isArray(item.domains)) throw new Error('Invalid brand entry.');
    if (!item.aliases.length || item.aliases.length > 10 || !item.domains.length || item.domains.length > 20) throw new Error('Each brand needs 1–10 aliases and 1–20 domains.');
    const aliases = item.aliases.map((alias: unknown) => {
      if (typeof alias !== 'string' || !alias.trim() || alias.length > 80) throw new Error('Aliases must be non-empty text, up to 80 characters.');
      return alias.trim().toLowerCase();
    });
    const domains = item.domains.map((domain: unknown) => {
      if (typeof domain !== 'string') throw new Error('Domains must be text.');
      const value = domain.trim().toLowerCase().replace(/\.$/, '');
      if (!value.includes('.') || value.length > 253 || !/^[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?$/.test(value) || value.includes('..') || value.split('.').some(label => label.startsWith('-') || label.endsWith('-'))) throw new Error(`Use a hostname such as example.com, without a protocol or path: ${value.slice(0, 70)}`);
      return value;
    });
    return { name, aliases, domains };
  });
  return { includeModel: input.includeModel, customBrands };
}

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get('settings');
  try { return settings ? validateSettings(settings) : { ...DEFAULT_SETTINGS }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
