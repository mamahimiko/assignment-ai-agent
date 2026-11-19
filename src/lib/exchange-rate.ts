// Payment scheduling is separate from the exchange-rate reference date.
export function expectedPaymentDate(invoiceDate: string): string {
  const m = invoiceDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]), 25));
  const day = d.getUTCDay();
  if (day === 6) d.setUTCDate(24);
  if (day === 0) d.setUTCDate(23);
  return d.toISOString().slice(0, 10);
}
export function validDate(date:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
  const d=new Date(`${date}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===date;
}
export function monthEndDate(month:string):string {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return '';
  const [year,m]=month.split('-').map(Number);
  if(!year||year<100)return '';
  return new Date(Date.UTC(year,m!,0)).toISOString().slice(0,10);
}
export interface RateReference {invoiceDate:string;paymentDate:string;rate:string;rateBasis?:'monthEnd'|'paymentDate'|'manual';rateMonth?:string;}
export function rateBasis(d:RateReference):'monthEnd'|'paymentDate'|'manual' {
  return d.rateBasis??(d.rate?'manual':'monthEnd');
}
export function rateTargetDate(d:RateReference):string {
  return rateBasis(d)==='monthEnd'?monthEndDate(d.rateMonth??d.invoiceDate.slice(0,7)):d.paymentDate;
}
export interface FetchedRate { rate: string; rateDate: string; rateSource: string; }
// ECB reference rates via Frankfurter v1 (ECB-only), including the previous publication on holidays.
// Never substitute today's/latest rate for a month-end that has not happened.
export async function fetchSekRate(currency:string,date:string,deps:{fetch?:typeof fetch;today?:string}={}):Promise<FetchedRate|'future'|null> {
  const cur=currency.trim().toUpperCase();
  if(!/^[A-Z]{3}$/.test(cur)||!validDate(date))return null;
  const today=deps.today??new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(date>today)return 'future';
  if(cur==='SEK')return {rate:'1',rateDate:date,rateSource:'SEK — no conversion'};
  try {
    const res=await (deps.fetch??fetch)(`https://api.frankfurter.dev/v1/${date}?base=${cur}&symbols=SEK`,{signal:AbortSignal.timeout(12000)});
    if(!res.ok)return null;
    const json=await res.json() as {base?:string;amount?:number;date?:string;rates?:{SEK?:number}};
    const rate=json.rates?.SEK;
    if(json.base!==cur||(json.amount!==undefined&&json.amount!==1)||typeof rate!=='number'||!Number.isFinite(rate)||rate<=0||!json.date||!validDate(json.date)||json.date>date)return null;
    // Reject stale data from outside a 10-day holiday window.
    if((Date.parse(date)-Date.parse(json.date))/86400000>10)return null;
    return {rate:String(rate),rateDate:json.date,rateSource:`ECB reference rate via Frankfurter · ${json.date} · 1 ${cur} = ${rate} SEK · requested ${date}`};
  }catch{return null;}
}
