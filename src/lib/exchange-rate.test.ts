import { describe, it, expect } from "vitest";
import { expectedPaymentDate } from "./exchange-rate";
describe("payment date rule", () => {
  it("pays on the 25th of the following month", () => { expect(expectedPaymentDate("2026-09-10")).toBe("2026-10-23"); expect(expectedPaymentDate("2026-10-01")).toBe("2026-11-25"); });
  it("moves Saturday to Friday", () => { expect(expectedPaymentDate("2026-06-30")).toBe("2026-07-24"); });
  it("moves Sunday to Friday", () => { expect(expectedPaymentDate("2026-09-15")).toBe("2026-10-23"); });
  it("rolls over the year", () => { expect(expectedPaymentDate("2026-12-05")).toBe("2027-01-25"); });
});

import {vi} from 'vitest';
import {fetchSekRate,monthEndDate,rateTargetDate} from './exchange-rate';
const reply=(date='2026-10-30',rate=0.06,base='JPY')=>new Response(JSON.stringify({amount:1,base,date,rates:{SEK:rate}}));
describe('published month-end reference rates',()=>{
 it('handles leap years and year-end without moving to the next month',()=>{expect(monthEndDate('2024-02')).toBe('2024-02-29');expect(monthEndDate('2026-02')).toBe('2026-02-28');expect(monthEndDate('2026-12')).toBe('2026-12-31');expect(monthEndDate('2026-13')).toBe('');});
 it('separates the reference month from the payment date',()=>{expect(rateTargetDate({invoiceDate:'2026-10-03',paymentDate:'2026-11-25',rate:''})).toBe('2026-10-31');expect(rateTargetDate({invoiceDate:'2026-10-03',paymentDate:'2026-11-25',rate:'',rateMonth:'2026-09',rateBasis:'monthEnd'})).toBe('2026-09-30');});
 it('fetches a weekend month-end and keeps the actual previous publication date',async()=>{
  const fetch=vi.fn().mockResolvedValue(reply());const r=await fetchSekRate('JPY','2026-10-31',{fetch,today:'2026-11-19'});
  expect(r).toMatchObject({rate:'0.06',rateDate:'2026-10-30'});expect(r&&typeof r==='object'&&r.rateSource).toContain('requested 2026-10-31');expect(fetch.mock.calls[0]?.[0]).toBe('https://api.frankfurter.dev/v1/2026-10-31?base=JPY&symbols=SEK');
 });
 it('does not call the provider or use latest rates before month-end',async()=>{const fetch=vi.fn();expect(await fetchSekRate('JPY','2026-11-30',{fetch,today:'2026-11-19'})).toBe('future');expect(fetch).not.toHaveBeenCalled();});
 it.each([['2026-11-01',0.06,'JPY'],['2026-09-30',0.06,'JPY'],['2026-10-30',-1,'JPY'],['2026-10-30',0.06,'USD']])('rejects wrong date, stale data, negative rate or wrong currency (%s)',async(date,rate,base)=>{expect(await fetchSekRate('JPY','2026-10-31',{fetch:vi.fn().mockResolvedValue(reply(date as string,rate as number,base as string)),today:'2026-11-19'})).toBeNull();});
 it('keeps failures blank without retries',async()=>{const fetch=vi.fn().mockRejectedValue(Error('offline'));expect(await fetchSekRate('JPY','2026-10-31',{fetch,today:'2026-11-19'})).toBeNull();expect(fetch).toHaveBeenCalledTimes(1);});
 it('uses 1 for SEK without a network call and validates calendar dates',async()=>{const fetch=vi.fn();expect(await fetchSekRate('SEK','2026-10-31',{fetch,today:'2026-11-19'})).toMatchObject({rate:'1'});expect(await fetchSekRate('JPY','2026-02-30',{fetch})).toBeNull();expect(fetch).not.toHaveBeenCalled();});
});
