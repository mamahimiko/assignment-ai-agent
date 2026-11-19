import {useEffect,useState,type Dispatch,type SetStateAction} from 'react';
import {fetchSekRate,rateBasis,rateTargetDate} from '@/lib/exchange-rate';
import {dictionaries,type Language} from '@/lib/i18n';
import type {Details} from '@/lib/finance';
const copy={
 ja:{basis:'レートの基準',monthEnd:'月末レート',paymentDate:'入金日のレート',manual:'手入力（従来の保存値を保持）',month:'対象月',target:'取得対象日',hint:'初期値は請求日の月末です。土日・休業日は直前のECB公表レートを使います。実際の公表日と出典も入力します。入金日や入金済みの状態は変更しません。',future:'対象日はまだ先のため、月末レートは未公表です。過去の対象月を選ぶか、月末後に再取得してください。',missing:'請求日または対象月と通貨を入力してください。',notice:'公表レートの取得は無料・AIキー不要です。税務上この換算方法が使えるかは別途確認が必要です。'},
 en:{basis:'Rate basis',monthEnd:'Month-end rate',paymentDate:'Payment-date rate',manual:'Manual (keep saved values)',month:'Reference month',target:'Requested date',hint:'Defaults to the invoice month-end. Weekends and holidays use the previous ECB publication. The published date and source are filled too. Payment dates and paid status stay as entered.',future:'The requested date is in the future. Select a completed month or fetch again after month-end.',missing:'Enter an invoice date or reference month and currency.',notice:'Public rate lookup is free and needs no AI key. Whether this conversion method is appropriate for tax filing needs separate verification.'},
 sv:{basis:'Kursgrund',monthEnd:'Månadsslutskurs',paymentDate:'Kurs på betalningsdagen',manual:'Manuell (behåll sparade värden)',month:'Referensmånad',target:'Begärt datum',hint:'Utgår från fakturamånadens slut. Helger använder närmast föregående ECB-publicering. Publiceringsdatum och källa fylls också i. Betalningsdag och betalningsstatus ändras inte.',future:'Datumet ligger i framtiden. Välj en avslutad månad eller hämta igen efter månadsslutet.',missing:'Ange fakturadatum eller referensmånad och valuta.',notice:'Offentlig kurshämtning är gratis och kräver ingen AI-nyckel. Metodens lämplighet för deklaration måste verifieras separat.'},
};
export function DocumentRateFields({details:d,onChange,lang}:{details:Details;onChange:Dispatch<SetStateAction<Details>>;lang:Language}){
 const c=copy[lang],t=dictionaries[lang];
 const basis=rateBasis(d),target=rateTargetDate(d),currency=d.currency;
 const [status,setStatus]=useState<'idle'|'loading'|'future'|'missing'|'error'>('idle');
 const [retry,setRetry]=useState(0);const hasRate=!!d.rate;
 useEffect(()=>{
  if(basis==='manual'||hasRate){setStatus('idle');return;}
  if(!target||!currency){setStatus('missing');return;}
  let active=true;setStatus('loading');
  void fetchSekRate(currency,target).then(r=>{
   if(!active)return;
   if(r==='future'){setStatus('future');return;}
   if(!r){setStatus('error');return;}
   onChange(prev=>prev.rate||prev.currency!==currency||rateTargetDate(prev)!==target||rateBasis(prev)!==basis?prev:{...prev,...r,rateBasis:basis});
   setStatus('idle');
  });
  return()=>{active=false;};
 },[basis,target,currency,hasRate,retry,onChange]);
 const reset=(extra:Partial<Details>)=>onChange(prev=>({...prev,rate:'',rateDate:'',rateSource:'',...extra}));
 return <div className="space-y-3">
  <div className="form-grid">
   <label className="field">{c.basis}<select aria-label={c.basis} value={basis} onChange={e=>e.target.value==='manual'?onChange(p=>({...p,rateBasis:'manual'})):reset({rateBasis:e.target.value as 'monthEnd'|'paymentDate'})}>
    <option value="monthEnd">{c.monthEnd}</option><option value="paymentDate">{c.paymentDate}</option><option value="manual">{c.manual}</option>
   </select></label>
   {basis==='monthEnd'&&<label className="field">{c.month}<input aria-label={c.month} type="month" value={d.rateMonth??d.invoiceDate.slice(0,7)} onInput={e=>reset({rateMonth:e.currentTarget.value,rateBasis:'monthEnd'})}/></label>}
   {(['rate','rateDate','rateSource'] as const).map(k=><label key={k} className="field">{t[k]}<input aria-label={t[k]} type={k==='rateDate'?'date':'text'} value={d[k]} onChange={e=>onChange(p=>({...p,[k]:e.target.value}))}/></label>)}
  </div>
  {target&&<p className="text-xs text-muted-foreground">{c.target}: {target} · 1 {currency.trim().toUpperCase()||'—'} = X SEK</p>}
  <p className="text-xs leading-6 text-muted-foreground">{c.hint}</p>
  <p className="text-xs leading-6 text-muted-foreground">{c.notice}</p>
  {status!=='idle'&&<p className="text-xs leading-6" role="status">{status==='loading'?t.rateFetching:status==='future'?c.future:status==='missing'?c.missing:t.rateUnavailable}</p>}
  {basis!=='manual'&&<button className="rounded-lg border border-border px-3 py-2 text-sm" type="button" disabled={status==='loading'} onClick={()=>{reset({rateBasis:basis});setRetry(n=>n+1);}}>{t.refetchRate}</button>}
 </div>;
}
