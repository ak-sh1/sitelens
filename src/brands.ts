import type { Brand } from './types';

// A deliberately small, reviewable registry. Domain recognition is not a safety guarantee.
export const BRANDS: Brand[] = [
  { name: 'Google', aliases: ['google', 'gmail'], domains: ['google.com', 'gmail.com'] },
  { name: 'Microsoft', aliases: ['microsoft', 'outlook', 'office 365'], domains: ['microsoft.com', 'microsoftonline.com', 'live.com', 'outlook.com', 'office.com'] },
  { name: 'Apple', aliases: ['apple', 'icloud'], domains: ['apple.com', 'icloud.com'] },
  { name: 'PayPal', aliases: ['paypal'], domains: ['paypal.com'] },
  { name: 'Amazon', aliases: ['amazon'], domains: ['amazon.com', 'amazon.ca', 'amazon.co.uk', 'amazon.in', 'amazon.de'] },
  { name: 'GitHub', aliases: ['github'], domains: ['github.com'] },
  { name: 'RBC', aliases: ['rbc', 'royal bank'], domains: ['rbc.com', 'rbcroyalbank.com', 'royalbank.com'] },
  { name: 'CIBC', aliases: ['cibc'], domains: ['cibc.com'] },
  { name: 'TD', aliases: ['td bank', 'td canada trust'], domains: ['td.com'] },
  { name: 'BMO', aliases: ['bmo', 'bank of montreal'], domains: ['bmo.com'] },
  { name: 'Scotiabank', aliases: ['scotiabank'], domains: ['scotiabank.com'] },
];

export const DEMO_BRAND: Brand = { name: 'Northstar', aliases: ['northstar'], domains: ['northstar.localhost'] };
export const IDENTITY_HOSTS = ['accounts.google.com', 'login.microsoftonline.com', 'login.live.com', 'appleid.apple.com'];
export const DEFAULT_SETTINGS = { includeModel: false, customBrands: [] as Brand[] };
