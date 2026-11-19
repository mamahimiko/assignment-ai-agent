import { describe, it, expect } from "vitest";
import {
  applyPaymentGroup,
  convert,
  conversion,
  demoDocuments,
  refreshDemoSchedule,
  draftLedger,
  emptyDetails,
  validatePdf,
} from "./finance";
import Decimal from "decimal.js";
describe("Safe bookkeeping draft rules", () => {
  it("keeps every demo incoming or scheduled payment before November", () => {
    const docs = demoDocuments();
    expect(docs.map((d) => d.details.paymentDate)).toEqual([
      "2026-10-23", "2026-10-12", "2026-09-25", "2026-10-23", "2026-10-23",
    ]);
    for (const doc of docs) expect(doc.details.paymentDate < "2026-11-01").toBe(true);
  });
  it("shows varied invoice payment dates while matching the duplicate and transfer to the original", () => {
    const docs = demoDocuments();
    expect(docs[0]?.details.paymentDate).toBe("2026-10-23");
    expect(docs[2]?.details.paymentDate).toBe("2026-09-25");
    expect(docs[3]?.details.paymentDate).toBe(docs[0]?.details.paymentDate);
    expect(docs[4]?.details.paymentDate).toBe(docs[0]?.details.paymentDate);
  });
  it("refreshes old demo dates without losing saved corrections or review status", () => {
    const docs = demoDocuments().map((d) => ({ ...d, details: { ...d.details, paymentDate: "2026-10-28", issuer: "Saved correction", review: "deferred" as const } }));
    const refreshed = refreshDemoSchedule(docs);
    expect(refreshed[0]?.details).toMatchObject({ paymentDate: "2026-10-23", issuer: "Saved correction", review: "deferred" });
    expect(refreshed[0]?.details.originalText).toContain("2026年10月23日");
  });
  it("converts the gross invoice separately from net received and fees", () => {
    expect(convert("180000", "0.067")).toBe("12060.00");
  });
  it("uses decimal-safe half-up rounding", () => {
    expect(convert("1", "0.005")).toBe("0.01");
  });
  it("does not invent a missing rate", () => {
    expect(convert("180000", "")).toBeNull();
  });
  it("requires the incoming-payment date and source", () => {
    expect(
      conversion({
        ...emptyDetails,
        paid: true,
        total: "180000",
        rate: "0.067",
        rateDate: "2026-10-28",
        rateSource: "Manual source",
      }),
    ).toBeNull();
  });
  it("does not use a future published rate", () => {
    expect(
      conversion({
        ...emptyDetails,
        paid: true,
        total: "180000",
        rate: "0.067",
        paymentDate: "2026-10-28",
        rateDate: "2026-10-29",
        rateSource: "Manual source",
      }),
    ).toBeNull();
  });
  it("bulk dates do not change unrelated expenses or unselected invoices", () => {
    const docs = demoDocuments();
    const result = applyPaymentGroup(docs, ["demo-0", "demo-1"], {
      paymentDate: "2026-11-01",
      account: "a",
      paymentCurrency: "SEK",
    });
    expect(result[0]?.details.paymentDate).toBe("2026-11-01");
    expect(result[1]?.details.paymentDate).toBe("2026-10-12");
    expect(result[2]?.details.paid).toBe(false);
  });
  it("matched records never double count revenue", () => {
    const doc = demoDocuments()[0];
    if (!doc) throw Error("Missing fixture");
    expect(
      draftLedger([{ ...doc, details: { ...doc.details, review: "confirmed", matchId: "other" } }]),
    ).toHaveLength(0);
  });
  it("confirmed draft journal balances", () => {
    const ledger = draftLedger(demoDocuments());
    const debit = ledger.reduce((s, l) => s.plus(l.debit), new Decimal(0));
    const credit = ledger.reduce((s, l) => s.plus(l.credit), new Decimal(0));
    expect(debit.toFixed(2)).toBe("349.00");
    expect(credit.toFixed(2)).toBe("349.00");
  });
  it("does not count duplicate invoices", () => {
    const doc = demoDocuments()[0];
    if (!doc) throw Error("Missing fixture");
    expect(
      draftLedger([{ ...doc, details: { ...doc.details, review: "confirmed", duplicate: true } }]),
    ).toHaveLength(0);
  });
  it("accepts PDFs only", () => {
    expect(validatePdf("image.jpg", 500, "%PDF-")).toBe("pdfOnly");
    expect(validatePdf("fake.pdf", 500, "not a pdf")).toBe("pdfOnly");
  });
  it("caps PDFs at 20 MB", () => {
    expect(validatePdf("a.pdf", 20 * 1024 * 1024 + 1, "%PDF-")).toBe("fileTooLarge");
  });
});

describe('explicit month-end conversions',()=>{
 it('uses the selected month-end rather than rejecting a rate after payment',()=>{
  expect(conversion({...emptyDetails,paid:true,paymentDate:'2026-10-15',invoiceDate:'2026-10-01',currency:'JPY',total:'75000',rate:'0.06',rateDate:'2026-10-30',rateSource:'ECB reference fixture',rateBasis:'monthEnd',rateMonth:'2026-10'})).toBe('4500.00');
 });
 it('still rejects a publication after the selected month-end',()=>{
  expect(conversion({...emptyDetails,paid:true,paymentDate:'2026-11-25',invoiceDate:'2026-10-01',total:'75000',rate:'0.06',rateDate:'2026-11-02',rateSource:'fixture',rateBasis:'monthEnd',rateMonth:'2026-10'})).toBeNull();
 });
 it('does not mistake automatic rate lookup for proof of payment',()=>{
  expect(conversion({...emptyDetails,paid:false,paymentDate:'2026-11-25',invoiceDate:'2026-10-01',rate:'0.06',rateDate:'2026-10-30',rateSource:'fixture',rateBasis:'monthEnd'})).toBeNull();
 });
});
