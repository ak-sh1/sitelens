import { BRANDS } from './brands';
import { MODEL_METADATA } from './model';
import type { Brand, Settings } from './types';

const editor = document.getElementById('brands')!;
const empty = document.getElementById('brands-empty')!;
const toggle = document.getElementById('model') as HTMLInputElement;
const status = document.getElementById('status')!;
const list = document.getElementById('registry')!;
let nextRowId = 0;

function updateEmptyState() {
  empty.hidden = editor.children.length > 0;
  (document.getElementById('add-brand') as HTMLButtonElement).disabled = editor.children.length >= 50;
}

function addBrand(brand?: Brand) {
  const id = ++nextRowId;
  const entry = document.createElement('div');
  entry.className = 'brand-entry';
  const head = document.createElement('div'); head.className = 'brand-entry-head';
  const heading = document.createElement('span'); heading.textContent = brand?.name || 'New brand';
  const remove = document.createElement('button');
  remove.type = 'button'; remove.className = 'remove-brand'; remove.textContent = 'Remove';
  remove.setAttribute('aria-label', `Remove ${brand?.name || 'new brand'}`);
  remove.addEventListener('click', () => { entry.remove(); updateEmptyState(); });
  head.append(heading, remove);
  const fields = document.createElement('div'); fields.className = 'brand-fields';
  const items = [
    { key: 'name', label: 'Brand name', placeholder: 'Acme', value: brand?.name || '' },
    { key: 'aliases', label: 'Other names (optional)', placeholder: 'Acme Bank', value: brand?.aliases.filter(alias => alias.toLowerCase() !== brand.name.toLowerCase()).join(', ') || '' },
    { key: 'domains', label: 'Domains', placeholder: 'acme.com, acme.ca', value: brand?.domains.join(', ') || '' },
  ];
  for (const item of items) {
    const label = document.createElement('label');
    const caption = document.createElement('span'); caption.textContent = item.label;
    const input = document.createElement('input');
    input.id = `brand-${item.key}-${id}`; input.className = `brand-${item.key}`;
    input.type = 'text'; input.placeholder = item.placeholder; input.value = item.value;
    input.autocomplete = 'off'; input.spellcheck = false;
    input.maxLength = item.key === 'name' ? 80 : item.key === 'domains' ? 5100 : 800;
    label.htmlFor = input.id;
    if (item.key === 'name') input.addEventListener('input', () => {
      heading.textContent = input.value.trim() || 'New brand';
      remove.setAttribute('aria-label', `Remove ${input.value.trim() || 'new brand'}`);
    });
    label.append(caption, input); fields.append(label);
  }
  entry.append(head, fields); editor.append(entry); updateEmptyState();
  return entry;
}

function readBrands(): Brand[] {
  return [...editor.querySelectorAll<HTMLElement>('.brand-entry')].map(entry => {
    const name = entry.querySelector<HTMLInputElement>('.brand-name')!.value.trim();
    const aliases = entry.querySelector<HTMLInputElement>('.brand-aliases')!.value.split(',').map(alias => alias.trim()).filter(Boolean);
    const domains = entry.querySelector<HTMLInputElement>('.brand-domains')!.value.split(',').map(domain => domain.trim()).filter(Boolean);
    if (!name) throw new Error('Enter a name for each brand, or remove the empty entry.');
    if (!domains.length) throw new Error(`Add a domain for ${name}.`);
    return { name, aliases: [...new Set([name.toLowerCase(), ...aliases.map(alias => alias.toLowerCase())])], domains };
  });
}

for (const brand of BRANDS) {
  const item = document.createElement('li');
  const name = document.createElement('strong'); name.textContent = brand.name;
  const domains = document.createElement('span'); domains.textContent = brand.domains.join(', ');
  item.append(name, domains); list.append(item);
}

document.getElementById('model-version')!.textContent = MODEL_METADATA.available
  ? `Trained on the PhiUSIIL dataset (2024). Historical test precision: ${(MODEL_METADATA.metrics.test.precision * 100).toFixed(1)}%; recall: ${(MODEL_METADATA.metrics.test.recall * 100).toFixed(1)}%. Performance on current browsing is unknown.`
  : 'No model is bundled with this build.';
toggle.disabled = !MODEL_METADATA.available;
updateEmptyState();

document.getElementById('add-brand')!.addEventListener('click', () => {
  if (editor.children.length >= 50) return;
  addBrand().querySelector<HTMLInputElement>('.brand-name')!.focus();
});

document.getElementById('save')!.addEventListener('click', async () => {
  try {
    const settings: Settings = { includeModel: toggle.checked, customBrands: readBrands() };
    const result = await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings });
    if (!result?.ok) throw new Error(result?.error || 'Settings could not be saved.');
    status.textContent = 'Saved.'; status.className = 'status success';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Settings could not be saved.';
    status.className = 'status error';
  }
});

try {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  if (!response?.ok) throw new Error('Settings could not be loaded. Reopen this page to try again.');
  toggle.checked = response.settings.includeModel;
  for (const brand of response.settings.customBrands) addBrand(brand);
} catch (error) {
  status.textContent = error instanceof Error ? error.message : 'Settings could not be loaded.';
  status.className = 'status error';
}
