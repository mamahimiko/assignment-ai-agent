import { beforeEach, describe, expect, it } from 'vitest';
import { readDemoSettings, writeDemoSettings, DEMO_SETTINGS_KEY } from './demo-session';
import { initialSettings } from './finance';

describe('Demo settings survive a new page or reload', () => {
  beforeEach(() => sessionStorage.clear());
  it('restores saved accounts, bookkeeping method and selected financial year', () => {
    const saved = { ...initialSettings, year: 2025, method: 'cash', accounts: [{ id: 'demo-account', name: 'Demo Wise', type: 'wise', currencies: 'SEK, JPY' }] };
    writeDemoSettings(sessionStorage, saved);
    expect(readDemoSettings(sessionStorage)).toEqual(saved);
  });
  it('uses fresh defaults for missing, malformed or invalid storage', () => {
    for (const value of ['null', '{', '{"year":2026,"accounts":[null]}']) {
      sessionStorage.setItem(DEMO_SETTINGS_KEY, value);
      expect(readDemoSettings(sessionStorage)).toEqual(initialSettings);
    }
    const restored = readDemoSettings(sessionStorage);
    restored.accounts.push({ id: 'a', name: 'Test', type: 'bank', currencies: 'SEK' });
    expect(initialSettings.accounts).toEqual([]);
  });
});
