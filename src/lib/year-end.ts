import Decimal from "decimal.js";
import { draftLedger, totals, feeReviewComplete, type FinancialDoc, type Settings } from "./finance";

export type CheckKey = "unresolved" | "unpaidAtYearEnd" | "missingRate" | "feesToReview" | "duplicates" | "opening" | "method" | "vatStatus";
export interface CheckItem { key: CheckKey; ok: boolean; count: number; docIds: string[]; }

const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;

// Year-end checklist: every item is derived from documents and settings; nothing is assumed complete.
export function yearEndChecklist(docs: FinancialDoc[], settings: Settings): CheckItem[] {
  const year = settings.year;
  const live = docs.filter((d) => !d.details.duplicate);
  const ids = (list: FinancialDoc[]) => list.map((d) => d.id);
   const unresolved = live.filter((d) => d.details.review === "pending");
  const yearEnd = `${year}-12-31`;
  const unpaid = live.filter(({ details: d }) =>
    d.type === "sales" &&
    (!validDate(d.invoiceDate) || d.invoiceDate <= yearEnd) &&
    (!d.paid || !validDate(d.paymentDate) || d.paymentDate > yearEnd)
  );
  const posted = new Set(draftLedger(docs).map((l) => l.documentId));
  const missingRate = live.filter((d) => d.details.review === "confirmed" && (d.details.type === "sales" || d.details.type === "expense") && !d.details.matchId && !posted.has(d.id));
  const fees = live.filter((d) => {
    if (d.details.type !== "sales" || feeReviewComplete(d.details) || !d.details.fee.trim()) return false;
    try { return new Decimal(d.details.fee).gt(0); } catch { return true; }
  });
  const dups = docs.filter((d) => d.details.duplicate);
  const item = (key: CheckKey, list: FinancialDoc[], ok = list.length === 0): CheckItem => ({ key, ok, count: list.length, docIds: ids(list) });
  return [
    item("unresolved", unresolved),
    item("unpaidAtYearEnd", unpaid),
    item("missingRate", missingRate),
    item("feesToReview", fees),
    item("duplicates", dups, true),
    { key: "opening", ok: settings.opening.trim() !== "", count: 0, docIds: [] },
    { key: "method", ok: settings.method !== "unsure", count: 0, docIds: [] },
    { key: "vatStatus", ok: settings.vat !== "unsure", count: 0, docIds: [] },
  ];
}

export interface NeLine { box: string; key: "neSales" | "neExpenses" | "neFees" | "neResult"; amount: string | null; }
// NE guidance: candidate boxes only. Box numbers are not verified for the selected year.
export function neGuidance(docs: FinancialDoc[]): NeLine[] {
  const t = totals(docs);
  return [
    { box: "R1 / R2", key: "neSales", amount: t.revenue },
    { box: "R5 / R6", key: "neExpenses", amount: t.expenses },
    { box: "R6", key: "neFees", amount: null },
    { box: "R11", key: "neResult", amount: t.profit },
  ];
}
export function closingReady(items: CheckItem[]) { return items.every((i) => i.ok); }
