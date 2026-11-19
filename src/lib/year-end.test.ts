import { describe, it, expect } from "vitest";
import { demoDocuments, initialSettings, DEMO_OPENING } from "./finance";
import { yearEndChecklist, closingReady, neGuidance } from "./year-end";
const get = (k: string) => {
  const item = yearEndChecklist(demoDocuments(), initialSettings).find((i) => i.key === k);
  if (!item) throw new Error(`Missing checklist item: ${k}`);
  return item;
};
describe("year-end closing", () => {
  it("removes the 100 SEK fee from review after explicit fee confirmation", () => {
    expect(get("feesToReview").docIds).toEqual(["demo-0"]);
    const docs = demoDocuments().map((d) => ({ ...d, details: { ...d.details, feeReview: { amount: "100", currency: "SEK" } } }));
    expect(yearEndChecklist(docs, initialSettings).find((i) => i.key === "feesToReview")?.ok).toBe(true);
    expect(neGuidance(docs).find((l) => l.key === "neFees")?.amount).toBeNull();
  });
  it("requires fee review again when the fee amount changes", () => {
    const docs = demoDocuments().map((d) => ({ ...d, details: { ...d.details, fee: "200", feeReview: { amount: "100", currency: "SEK" } } }));
    expect(yearEndChecklist(docs, initialSettings).find((i) => i.key === "feesToReview")?.docIds).toEqual(["demo-0", "demo-2"]);
  });
  it("requires fee review again when payment currency changes", () => {
    const docs = demoDocuments().map((d) => ({ ...d, details: { ...d.details, paymentCurrency: "JPY", feeReview: { amount: "100", currency: "SEK" } } }));
    expect(yearEndChecklist(docs, initialSettings).find((i) => i.key === "feesToReview")?.docIds).toEqual(["demo-0"]);
  });
  it("lists unpaid invoices at year end", () => { expect(get("unpaidAtYearEnd").docIds).toEqual(["demo-2"]); });
  it("keeps a January 2027 payment unpaid at the end of 2026", () => {
    const docs = demoDocuments().map((d) => ({ ...d, details: { ...d.details, paid: true, paymentDate: "2027-01-15" } }));
    expect(yearEndChecklist(docs, initialSettings).find((i) => i.key === "unpaidAtYearEnd")?.docIds).toEqual(["demo-0", "demo-2"]);
  });
  it("removes invoices paid on December 31, 2026 from the unpaid checklist", () => {
    const docs = demoDocuments().map((d) => ({ ...d, details: { ...d.details, paid: true, paymentDate: "2026-12-31" } }));
    expect(yearEndChecklist(docs, initialSettings).find((i) => i.key === "unpaidAtYearEnd")?.docIds).toEqual([]);
  });
  it("does not treat a planned September payment as received without the paid flag", () => {
    expect(get("unpaidAtYearEnd").docIds).toContain("demo-2");
  });
  it("requires an actual payment date for a paid invoice", () => {
    const docs = demoDocuments().map((d) => ({ ...d, details: { ...d.details, paid: true, paymentDate: "" } }));
    expect(yearEndChecklist(docs, initialSettings).find((i) => i.key === "unpaidAtYearEnd")?.docIds).toEqual(["demo-0", "demo-2"]);
  });
  it("includes unpaid earlier-year invoices but not invoices issued after year end", () => {
    const docs = demoDocuments().map((d) => ({ ...d, details: { ...d.details, paid: false, invoiceDate: d.id === "demo-0" ? "2025-12-01" : "2027-01-01" } }));
    expect(yearEndChecklist(docs, initialSettings).find((i) => i.key === "unpaidAtYearEnd")?.docIds).toEqual(["demo-0"]);
  });
  it("ignores duplicates in unresolved items", () => { expect(get("unresolved").docIds).not.toContain("demo-3"); });
  it("removes a deferred document from the unreviewed checklist", () => {
    const docs = demoDocuments().map((d) => d.id === "demo-0" ? { ...d, details: { ...d.details, review: "deferred" as const } } : d);
    expect(yearEndChecklist(docs, initialSettings).find((i) => i.key === "unresolved")?.docIds).toEqual(["demo-2", "demo-4"]);
  });
  it("completes document review when every document is confirmed or deferred", () => {
    const docs = demoDocuments().map((d) => ({ ...d, details: { ...d.details, review: "deferred" as const } }));
    expect(yearEndChecklist(docs, initialSettings).find((i) => i.key === "unresolved")?.ok).toBe(true);
    expect(neGuidance(docs).find((l) => l.key === "neSales")?.amount).toBe("0.00");
  });
  it("keeps pending documents in the unreviewed checklist", () => {
    expect(get("unresolved").docIds).toEqual(["demo-0", "demo-2", "demo-4"]);
    expect(get("unresolved").ok).toBe(false);
  });
  it("does not treat a missing opening balance as done", () => { expect(get("opening").ok).toBe(false); });
  it("marks the opening balance done in the demo workspace", () => {
    expect(DEMO_OPENING.trim()).not.toBe("");
    expect(yearEndChecklist(demoDocuments(), { ...initialSettings, opening: DEMO_OPENING }).find((i) => i.key === "opening")?.ok).toBe(true);
  });
  it("blocks closing while anything is open", () => { expect(closingReady(yearEndChecklist(demoDocuments(), initialSettings))).toBe(false); });
  it("NE result equals draft profit", () => { expect(neGuidance(demoDocuments()).find((l) => l.key === "neResult")?.amount).toBe("-349.00"); });
});
