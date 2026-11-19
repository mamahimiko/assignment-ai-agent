import Decimal from 'decimal.js';
import type { FinancialDoc } from './finance';
import { feeReviewComplete, totals } from './finance';

export const NE_RULE_VERSION = 'ne-2026-schablon-v1';
export const NE_RULE_SOURCE = 'https://www.skatteverket.se/foretagochorganisationer/startaochdrivaforetag/enskildnaringsverksamhet/egenavgifter.4.361dc8c15312eff6fd1f678.html';
export const NE_ADJUSTMENT_SOURCE = 'https://www.skatteverket.se/foretag/inkomstdeklaration/deklareraenskildnaringsverksamhet/fyllainebilagan/skattemassigajusteringar.4.361dc8c15312eff6fd2c7d1.html';
export const incomeBoxes = ['R1','R2','R3','R4','R5','R6','R7','R8','R9','R10'] as const;
export const balanceBoxes = ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B13','B14','B15','B16'] as const;
export const adjustmentBoxes = ['R13','R14','R15','R16','R24','R40','R41'] as const;
export type InputBox = typeof incomeBoxes[number] | typeof balanceBoxes[number] | typeof adjustmentBoxes[number];
export interface NeInputs {
  values: Partial<Record<InputBox, string>>;
  activity: '' | 'active' | 'passive';
  birthYear: string;
  pension: '' | 'yes' | 'no';
  sickness: '' | 'yes' | 'no';
  simple: boolean;
  accountsChecked: boolean;
}
export const emptyNeInputs: NeInputs = { values: {}, activity: '', birthYear: '', pension: '', sickness: '', simple: false, accountsChecked: false };
export function neAmount(value: string | undefined): Decimal | null {
  if (!value?.trim() || !/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  try { const d = new Decimal(value); return d.isFinite() && !d.isNegative() ? d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP) : null; } catch { return null; }
}
export function contributionDeductionRate(year: number, inputs: NeInputs): number | null {
  if (year !== 2026) return null;
  if (inputs.activity === 'passive') return 20;
  if (inputs.activity !== 'active' || !/^\d{4}$/.test(inputs.birthYear)) return null;
  const birth = Number(inputs.birthYear);
  if (birth < 1900 || birth > year - 18) return null;
  if (birth <= 1937) return 0;
  if (birth <= 1958) return 10;
  if (!inputs.pension || !inputs.sickness) return null;
  return inputs.pension === 'yes' || inputs.sickness === 'yes' ? 10 : 25;
}
export function calculateNe(year: number, inputs: NeInputs) {
  const read = (b: InputBox) => neAmount(inputs.values[b]);
  const sum = (boxes: readonly InputBox[]) => boxes.reduce((total, b) => total.plus(read(b) ?? 0), new Decimal(0));
  const missing = [...incomeBoxes, ...adjustmentBoxes].filter(b => read(b) === null);
  const incomeComplete = incomeBoxes.every(b => read(b) !== null);
  const r11 = incomeComplete ? sum(incomeBoxes.slice(0,4)).minus(sum(incomeBoxes.slice(4))) : null;
  const balanceComplete = balanceBoxes.every(b => read(b) !== null);
  const b10 = balanceComplete ? sum(balanceBoxes.slice(0,9)).minus(sum(balanceBoxes.slice(9))) : null;
  const rate = contributionDeductionRate(year, inputs);
  const ready = year === 2026 && missing.length === 0 && rate !== null && inputs.simple && inputs.accountsChecked;
  if (!ready || r11 === null || rate === null) return { ready: false, missing, rate, b10: b10?.toFixed(0) ?? null, r11: r11?.toFixed(0) ?? null, r42: null, r43: null, r47: null, r48: null, mainBox: null };
  const r42 = r11.plus(sum(['R13','R15','R40'])).minus(sum(['R14','R16','R24','R41']));
  // R43 is an optional maximum standard deduction, not the final contribution bill.
  const r43 = Decimal.max(r42, 0).mul(rate).div(100).toDecimalPlaces(0, Decimal.ROUND_DOWN);
  const result = r42.minus(r43);
  const surplus = !result.isNegative();
  return { ready: true, missing, rate, b10: b10?.toFixed(0) ?? null, r11: r11.toFixed(0), r42: r42.toFixed(0), r43: r43.toFixed(0), r47: Decimal.max(result, 0).toFixed(0), r48: Decimal.max(result.neg(), 0).toFixed(0), mainBox: inputs.activity === 'active' ? (surplus ? '10.1' : '10.2') : (surplus ? '10.3' : '10.4') };
}
export function neDraftReference(docs: FinancialDoc[], year: number) {
  const selected = docs.filter(d => d.year === year);
  const t = totals(selected);
  let fees = new Decimal(0);
  const unresolvedFees: string[] = [];
  for (const doc of selected) {
    const d = doc.details;
    if (d.duplicate || d.matchId || d.type !== 'sales' || !d.fee.trim()) continue;
    const amount = neAmount(d.fee);
    if (!amount || amount.isZero()) continue;
    if (d.review !== 'confirmed' || !feeReviewComplete(d) || d.paymentCurrency !== 'SEK' || !d.paid || !/^\d{4}-\d{2}-\d{2}$/.test(d.paymentDate) || d.paymentDate.slice(0,4) !== String(year)) { unresolvedFees.push(doc.id); continue; }
    // Sum original decimal values, not independently rounded fee rows.
    fees = fees.plus(d.fee);
  }
  return { ...t, fees: fees.toFixed(2), unresolvedFees };
}
