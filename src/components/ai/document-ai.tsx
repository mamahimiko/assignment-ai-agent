import { useEffect, useState } from 'react';
import { dictionaries, type TranslationKey, type Language } from '@/lib/i18n';
import { aiCopy } from '@/lib/ai/copy';
import { storedAiReading, type AiErrorCode } from '@/lib/ai/schema';
export function AiUploadControls({lang,enabled,consent,busy,onEnabled,onConsent,onReady}:{lang:Language;enabled:boolean;consent:boolean;busy:boolean;onEnabled:(v:boolean)=>void;onConsent:(v:boolean)=>void;onReady:(v:boolean)=>void}){
  const c=aiCopy[lang];const [configured,setConfigured]=useState<boolean|null>(null);
  useEffect(()=>{const abort=new AbortController();let active=true;
    fetch('/api/document-ai',{signal:abort.signal,cache:'no-store'}).then(r=>r.ok?r.json():null).then(r=>{if(active){const ready=r?.configured===true;setConfigured(ready);onReady(ready);}}).catch(()=>{if(active){setConfigured(false);onReady(false);}});
    return()=>{active=false;abort.abort();};
  },[onReady]);
  return <section className="form-section mb-5" aria-label={c.title}>
    <h3 className="mb-3 text-base font-bold">{c.title}</h3>
    <p className="mb-3 text-sm leading-7 text-muted-foreground" role="status">{configured===null?c.checking:configured?c.configured:c.unavailable}</p>
    <label className="flex items-start gap-3 text-sm font-semibold"><input type="checkbox" checked={enabled} disabled={busy} onChange={e=>{onEnabled(e.target.checked);if(!e.target.checked)onConsent(false);}}/>{c.toggle}</label>
    {enabled&&<><p className="mt-3 text-sm leading-7">{c.description}</p><label className="mt-3 flex items-start gap-3 text-sm leading-7"><input type="checkbox" checked={consent} disabled={busy||!configured} onChange={e=>onConsent(e.target.checked)}/>{c.consent}</label></>}
    <p className="mt-3 text-xs leading-6 text-muted-foreground">{c.local}</p>
  </section>;
}
export function AiEvidence({lang,original}:{lang:Language;original:Record<string,unknown>}){
  const c=aiCopy[lang];const reading=storedAiReading(original);const failure=typeof original['aiError']==='string'?original['aiError']:null;
  if(!reading&&!failure)return null;
  return <section className="rounded-xl bg-sage p-4 text-sm leading-7">
    {failure&&<p role="status">{c.fallback} {c.errors[failure as AiErrorCode]??c.errors.provider_error}</p>}
    {reading&&<><h3 className="font-bold">{c.result}</h3><p className="text-xs text-muted-foreground">{reading.model}</p>
      {reading.result.warnings.map((w,i)=><p key={i} className="mt-2">{w}</p>)}
      {!reading.result.fields.length&&<p>{c.empty}</p>}
      <details className="mt-3"><summary className="cursor-pointer font-semibold">{c.evidence}</summary><dl className="mt-3 space-y-3">
        {reading.result.fields.map((f,i)=><div key={i} className="border-t border-border pt-2"><dt className="font-semibold">{dictionaries[lang][(f.field==='tax'?'taxAmount':f.field) as TranslationKey]}: {f.value??'—'} {f.confidence==='low'?`(${c.low})`:''}</dt><dd>{c.page} {f.page}: {f.evidence}</dd></div>)}
      </dl></details>
    </>}
  </section>;
}
