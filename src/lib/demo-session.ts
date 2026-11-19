import { initialSettings, type Settings } from './finance';

export const DEMO_SETTINGS_KEY = 'sumitt-demo-settings';
export function readDemoSettings(storage: Pick<Storage, 'getItem'>): Settings {
  try {
    const raw: unknown = JSON.parse(storage.getItem(DEMO_SETTINGS_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return structuredClone(initialSettings);
    const value = raw as Settings;
    if (!Number.isInteger(value.year) || value.year < 2024 || value.year > 2027 ||
      !Array.isArray(value.accounts) || !value.accounts.every(a => a && typeof a.id === 'string' && typeof a.name === 'string' && typeof a.type === 'string' && typeof a.currencies === 'string') ||
      !Array.isArray(value.currencies) || !value.currencies.every(c => typeof c === 'string') ||
      !['vat','frequency','period','method','previous','opening'].every(k => typeof value[k as keyof Settings] === 'string')) return structuredClone(initialSettings);
    return { ...structuredClone(initialSettings), ...value };
  } catch { return structuredClone(initialSettings); }
}
export function writeDemoSettings(storage: Pick<Storage, 'setItem'>, settings: Settings) {
  storage.setItem(DEMO_SETTINGS_KEY, JSON.stringify(settings));
}
