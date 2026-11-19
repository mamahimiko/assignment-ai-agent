import Decimal from "decimal.js";
import type { ExpenseCategory } from "./ai/assistant-schema";
import { rateTargetDate, validDate } from "./exchange-rate";

export type DocType = "sales" | "expense" | "supplier" | "bank" | "previous" | "tax" | "other";
export interface Details {
  type: DocType;
  issuer: string;
  number: string;
  invoiceDate: string;
  dueDate: string;
  paymentDate: string;
  currency: string;
  total: string;
  tax: string;
  withholding: string;
  fee: string;
  feeReview?: { amount: string; currency: string };
  received: string;
  paymentCurrency: string;
  account: string;
  rate: string;
  rateDate: string;
  rateSource: string;
  rateBasis?: "monthEnd" | "paymentDate" | "manual";
  rateMonth?: string;
  country: string;
  customerType: string;
  description: string;
  expenseCategory?: ExpenseCategory;
  expenseCategorySource?: "manual" | "aiReviewed";
  originalText: string;
  duplicate: boolean;
  paid: boolean;
  review: "pending" | "deferred" | "confirmed";
  businessUse: string;
  matchId: string;
}
export interface FinancialDoc {
  id: string;
  name: string;
  status: string;
  storage_path: string;
  file_hash: string;
  year: number;
  details: Details;
  original: Record<string, unknown>;
}
export interface Account {
  id: string;
  name: string;
  type: string;
  currencies: string;
}
export interface Settings {
  year: number;
  vat: string;
  frequency: string;
  period: string;
  method: string;
  previous: string;
  opening: string;
  currencies: string[];
  accounts: Account[];
  step: number;
}
export const initialSettings: Settings = {
  year: 2026,
  vat: "unsure",
  frequency: "yearly",
  period: "2026",
  method: "unsure",
  previous: "unavailable",
  opening: "",
  currencies: ["SEK", "JPY"],
  accounts: [],
  step: 0,
};
export const emptyDetails: Details = {
  type: "other",
  issuer: "",
  number: "",
  invoiceDate: "",
  dueDate: "",
  paymentDate: "",
  currency: "JPY",
  total: "",
  tax: "",
  withholding: "",
  fee: "",
  received: "",
  paymentCurrency: "SEK",
  account: "",
  rate: "",
  rateDate: "",
  rateSource: "",
  country: "",
  customerType: "unsure",
  description: "",
  originalText: "",
  duplicate: false,
  paid: false,
  review: "pending",
  businessUse: "unsure",
  matchId: "",
};
export const RULE_VERSION = "draft-conversion-v1";
// Fictional opening balance shown only in the demo workspace; real workspaces never get a prefilled balance.
export const DEMO_OPENING = "50 000 SEK — デモ用の仮の期首残高";
export function feeReviewComplete(d: Details): boolean {
  return !!d.feeReview && d.feeReview.amount === d.fee && d.feeReview.currency === d.paymentCurrency;
}
export const DEMO_SCHEDULE_VERSION = "2026-autumn-varied-v2";
// Refresh only sample dates/source text; retain saved review states and other corrections.
export function refreshDemoSchedule(docs: FinancialDoc[]): FinancialDoc[] {
  const samples = demoDocuments();
  return docs.map((doc) => {
    const sample = samples.find((s) => s.id === doc.id);
    if (!sample) return doc;
    const { invoiceDate, dueDate, paymentDate, rateDate, originalText } = sample.details;
    return { ...doc, details: { ...doc.details, invoiceDate, dueDate, paymentDate, rateDate, originalText } };
  });
}
// Monetary calculations round once, half-up, to 2 decimal SEK places. Empty values never mean zero.
export function convert(amount: string, rate: string): string | null {
  try {
    if (!amount.trim() || !rate.trim()) return null;
    const a = new Decimal(amount),
      r = new Decimal(rate);
    if (!a.isFinite() || !r.isFinite() || a.isNegative() || !r.isPositive()) return null;
    return a.mul(r).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  } catch {
    return null;
  }
}
export function conversion(d: Details): string | null {
  const target=rateTargetDate(d);
  if (!d.paid || !validDate(d.paymentDate) || !validDate(d.rateDate) || !d.rateSource || !validDate(target) || d.rateDate > target)
    return null;
  return convert(d.total, d.currency === "SEK" ? "1" : d.rate);
}
export interface LedgerLine {
  documentId: string;
  date: string;
  account: string;
  debit: string;
  credit: string;
}
// A draft balanced journal, deliberately not official BAS mappings or finalized tax accounting.
export function draftLedger(docs: FinancialDoc[]): LedgerLine[] {
  return docs.flatMap((doc) => {
    const d = doc.details;
    const value = conversion(d);
    if (
      d.review !== "confirmed" ||
      d.duplicate ||
      d.matchId ||
      value === null ||
      (d.type !== "sales" && d.type !== "expense")
    )
      return [];
    return d.type === "sales"
      ? [
          {
            documentId: doc.id,
            date: d.paymentDate,
            account: "Incoming-payment clearing",
            debit: value,
            credit: "0.00",
          },
          {
            documentId: doc.id,
            date: d.paymentDate,
            account: "Revenue — draft",
            debit: "0.00",
            credit: value,
          },
        ]
      : [
          {
            documentId: doc.id,
            date: d.paymentDate,
            account: "Expenses — draft",
            debit: value,
            credit: "0.00",
          },
          {
            documentId: doc.id,
            date: d.paymentDate,
            account: "Outgoing-payment clearing",
            debit: "0.00",
            credit: value,
          },
        ];
  });
}
export function totals(docs: FinancialDoc[]) {
  const ledger = draftLedger(docs);
  const revenue = ledger
    .filter((l) => l.account === "Revenue — draft")
    .reduce((a, l) => a.plus(l.credit), new Decimal(0));
  const expenses = ledger
    .filter((l) => l.account === "Expenses — draft")
    .reduce((a, l) => a.plus(l.debit), new Decimal(0));
  return {
    revenue: revenue.toFixed(2),
    expenses: expenses.toFixed(2),
    profit: revenue.minus(expenses).toFixed(2),
    ledger,
  };
}
export function applyPaymentGroup(
  docs: FinancialDoc[],
  selected: string[],
  patch: Pick<Details, "paymentDate" | "paymentCurrency" | "account">,
): FinancialDoc[] {
  return docs.map((d) =>
    selected.includes(d.id) && d.details.type === "sales"
      ? { ...d, details: { ...d.details, ...patch, paid: true, review: "pending" } }
      : d,
  );
}
export function validatePdf(name: string, size: number, header: string) {
  if (!name.toLowerCase().endsWith(".pdf") || !header.startsWith("%PDF-")) return "pdfOnly";
  if (size > 20 * 1024 * 1024) return "fileTooLarge";
  return null;
}
export function demoDocuments(): FinancialDoc[] {
  const base = { ...emptyDetails };
  return [
    {
      name: "請求書_デザイン制作_2026-014.pdf",
      details: {
        ...base,
        type: "sales" as const,
        issuer: "株式会社さくらデザイン",
        number: "INV-2026-014",
        invoiceDate: "2026-09-01",
        dueDate: "2026-10-23",
        total: "180000",
        currency: "JPY",
        country: "JP",
        description: "ウェブサイトデザイン制作",
        originalText:
          "請求書\n株式会社さくらデザイン\n請求日：2026年9月1日\n支払期限：2026年10月23日\n振込日：2026年10月23日\nInvoice date: 2026-09-01\nDue date: 2026-10-23\nPayment date: 2026-10-23\nデザイン制作費：180,000円\n消費税：確認が必要",
        tax: "",
        paymentDate: "2026-10-23",
        paid: true,
        rate: "0.067",
        rateDate: "2026-10-23",
        rateSource: "Fictional demo rate — not for filing",
        received: "11960",
        fee: "100",
        review: "pending" as const,
      },
    },
    {
      name: "kvitto_programvara_oktober.pdf",
      details: {
        ...base,
        type: "expense" as const,
        issuer: "Nord Software AB",
        invoiceDate: "2026-10-12",
        total: "349",
        currency: "SEK",
        country: "SE",
        description: "Software subscription",
        originalText: "KVITTO\nProgramvara\nTotalt: 349 SEK",
        paid: true,
        paymentDate: "2026-10-12",
        rateDate: "2026-10-12",
        rate: "1",
        rateSource: "SEK — no conversion",
        review: "confirmed" as const,
        businessUse: "yes",
      },
    },
    {
      name: "invoice_translation_2026-015.pdf",
      details: {
        ...base,
        type: "sales" as const,
        issuer: "Maple Studio",
        invoiceDate: "2026-08-20",
        dueDate: "2026-09-25",
        paymentDate: "2026-09-25",
        total: "750",
        currency: "EUR",
        country: "DE",
        description: "Translation services",
        originalText: "INVOICE 2026-015\nInvoice date: 2026-08-20\nDue date: 2026-09-25\nScheduled payment date: 2026-09-25\nTranslation services\nTotal EUR 750\nUNPAID",
        paid: false,
      },
    },
    {
      name: "請求書_デザイン制作_2026-014_copy.pdf",
      details: {
        ...base,
        type: "sales" as const,
        issuer: "株式会社さくらデザイン",
        total: "180000",
        duplicate: true,
        currency: "JPY",
        invoiceDate: "2026-09-01",
        dueDate: "2026-10-23",
        paymentDate: "2026-10-23",
        originalText: "Duplicate invoice\nInvoice date: 2026-09-01\nDue date: 2026-10-23\nPayment date: 2026-10-23\nTotal JPY 180000",
      },
    },
    {
      name: "振込明細_2026年10月.pdf",
      details: {
        ...base,
        type: "bank" as const,
        issuer: "Wise",
        total: "11960",
        currency: "SEK",
        description: "Incoming payment; transfer fee 100 SEK",
        originalText: "振込日：2026年10月23日\nPayment date: 2026-10-23\n入金額：11,960 SEK\n振込手数料：100 SEK",
        paymentDate: "2026-10-23",
        paid: true,
      },
    },
  ].map((d, i) => ({
    id: `demo-${i}`,
    name: d.name,
    status: d.details.review === "confirmed" ? "confirmed" : "needs_information",
    storage_path: "",
    file_hash: `demo-${i}`,
    year: 2026,
    details: d.details,
    original: { source: "Demo data", page: 1 },
  }));
}
