import {useEffect,useRef,useState,type ReactNode,type Dispatch,type SetStateAction} from 'react';
import {Button} from '@/components/ui/button';
import {supabase} from '@/integrations/supabase/client';
import {aiCopy} from '@/lib/ai/copy';
import {AssistOutput,expenseCategories,type AssistantInput,type AssistantResult,type ExpenseCategory} from '@/lib/ai/assistant-schema';
import {neGuideCopy,neFieldRecords,neSources} from '@/lib/ne-guide-content';
import type {Details,Settings} from '@/lib/finance';
import type {Language} from '@/lib/i18n';
import type {CheckItem} from '@/lib/year-end';
const words={
 ja:{expense:'経費の分類を相談する',closing:'AIと年末のやることを整理',ne:'NE付表をやさしく説明',ask:'AIに説明してもらう',busy:'説明を考えています…',consent:'以下に示した情報をGoogle Geminiへ送り、AIによる説明を作ることに同意します。',scopeExpense:'送信する情報：発行者と商品・サービスの説明。PDF全体は送りません。',scopeClosing:'送信する情報：対象年とチェック項目の完了状況・件数。書類本文や金額は送りません。',scopeNe:'送信する情報：対象年・選択したガイド項目・入力した質問。書類や金額は送りません。',unavailable:'Geminiは未接続です。AIキーを設定して起動すると使えます。下の通常ガイドや手入力はそのまま使えます。',draft:'AIの説明・要確認',questions:'確認するとよいこと',category:'経費の整理用カテゴリー',suggestion:'AIの分類候補',reason:'理由',evidence:'読み取り根拠',apply:'この候補を採用',applied:'分類を選択しました。書類を保存すると記録されます。',low:'不確かな候補です。質問を確認してください。',notice:'整理用の分類です。経費算入・moms控除・NE欄の確定は行いません。',topic:'説明してほしい項目',question:'質問（任意）',questionPlaceholder:'例：この欄は、どの資料を見れば分かりますか？',source:'公式説明',context:'いま確認する内容',categoryNames:{software:'ソフトウェア・サブスク',office:'事務用品',equipment:'機器・備品',travel:'出張・移動',professional:'外注・専門サービス',fees:'手数料',other:'その他',unsure:'未分類・要確認'}},
 en:{expense:'Ask about expense categories',closing:'Plan year-end tasks with AI',ne:'Explain the NE supplement simply',ask:'Ask AI to explain',busy:'Preparing an explanation…',consent:'I agree to send the information listed below to Google Gemini for an AI explanation.',scopeExpense:'Sent: issuer and product/service description. The full PDF is not sent.',scopeClosing:'Sent: selected year, checklist status and counts. No document text or amounts.',scopeNe:'Sent: selected year, guide topic and your question. No documents or amounts.',unavailable:'Gemini is not connected. Start with your AI key to use it. The regular guide and manual fields remain available.',draft:'AI explanation · review required',questions:'Questions to check',category:'Organizational expense category',suggestion:'AI category suggestion',reason:'Reason',evidence:'Evidence',apply:'Use this suggestion',applied:'Category selected. Save the document to retain it.',low:'Uncertain suggestion. Check the questions first.',notice:'Organizational labels only; this does not determine deductibility, VAT recovery or an NE box.',topic:'Topic to explain',question:'Question (optional)',questionPlaceholder:'For example: Which document should I check for this field?',source:'Official guidance',context:'What to check now',categoryNames:{software:'Software and subscriptions',office:'Office supplies',equipment:'Equipment',travel:'Travel',professional:'Professional services',fees:'Fees',other:'Other',unsure:'Uncategorized / review'}},
 sv:{expense:'Fråga om kostnadskategorier',closing:'Planera bokslutsuppgifter med AI',ne:'Förklara NE-bilagan enkelt',ask:'Be AI förklara',busy:'Förbereder en förklaring…',consent:'Jag godkänner att uppgifterna nedan skickas till Google Gemini för en AI-förklaring.',scopeExpense:'Skickas: utfärdare och beskrivning av vara/tjänst. Inte hela PDF:en.',scopeClosing:'Skickas: valt år, checklistans status och antal. Ingen dokumenttext eller belopp.',scopeNe:'Skickas: valt år, guideämne och din fråga. Inga dokument eller belopp.',unavailable:'Gemini är inte anslutet. Starta med AI-nyckeln för att använda det. Vanlig guide och manuella fält fungerar fortfarande.',draft:'AI-förklaring · granskning krävs',questions:'Frågor att kontrollera',category:'Organisatorisk kostnadskategori',suggestion:'AI-förslag på kategori',reason:'Motivering',evidence:'Underlag',apply:'Använd förslaget',applied:'Kategori vald. Spara dokumentet för att behålla den.',low:'Osäkert förslag. Kontrollera frågorna först.',notice:'Endast sortering; detta avgör inte avdragsrätt, momsavdrag eller NE-ruta.',topic:'Ämne att förklara',question:'Fråga (valfritt)',questionPlaceholder:'Till exempel: Vilket underlag ska jag kontrollera?',source:'Officiell vägledning',context:'Att kontrollera nu',categoryNames:{software:'Programvara och abonnemang',office:'Kontorsmaterial',equipment:'Utrustning',travel:'Resor',professional:'Konsulttjänster',fees:'Avgifter',other:'Övrigt',unsure:'Okategoriserat / granska'}},
};
export function AssistantPanel({request,demo,title,sourceLinks={},action,children}:{request:AssistantInput;demo:boolean;title:string;sourceLinks?:Record<string,string>;action?:(sourceId:string)=>ReactNode;children?:(result:AssistantResult)=>ReactNode}){
 const c=words[request.lang],errors=aiCopy[request.lang].errors;
 const [configured,setConfigured]=useState<boolean|null>(null),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [answer,setAnswer]=useState<{key:string;result:AssistantResult;model:string}|null>(null);
 const key=JSON.stringify(request);const current=useRef(key);current.current=key;
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>{const abort=new AbortController();fetch('/api/document-ai',{signal:abort.signal,cache:'no-store'}).then(r=>r.ok?r.json():null).then(r=>setConfigured(r?.configured===true)).catch(()=>{if(!abort.signal.aborted)setConfigured(false);});return()=>abort.abort();},[]);
 useEffect(()=>{controller.current?.abort();setBusy(false);setError('');return()=>controller.current?.abort();},[key]);
 async function ask(){
  if(!consent||!configured||busy)return;
  const snapshot=key,abort=new AbortController();controller.current=abort;setBusy(true);setError('');setAnswer(null);
  const timeout=setTimeout(()=>abort.abort(),50000);
  try{
   const token=demo?undefined:(await supabase.auth.getSession()).data.session?.access_token;
   const r=await fetch('/api/assistant',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:key,signal:abort.signal});
   const j=await r.json();
   if(!r.ok||!j.ok)throw Error(j.code??'provider_error');
   const parsed=AssistOutput.safeParse(j.result);if(!parsed.success||typeof j.model!=='string')throw Error('invalid_response');
   if(current.current===snapshot&&!abort.signal.aborted)setAnswer({key:snapshot,result:parsed.data,model:j.model});
  }catch(e){if(current.current===snapshot)setError(abort.signal.aborted?errors.timeout:errors[e instanceof Error?e.message as keyof typeof errors:'provider_error']??errors.provider_error);}
  finally{clearTimeout(timeout);if(current.current===snapshot)setBusy(false);}
 }
 const result=answer?.key===key?answer.result:null;
 return <section className="my-5 rounded-xl border border-border bg-sage/40 p-5" aria-label={title}>
  <h3 className="font-bold">{title}</h3>
  <p className="mt-2 text-xs leading-6 text-muted-foreground">{request.task==='expense'?c.scopeExpense:request.task==='closing'?c.scopeClosing:c.scopeNe}</p>
  {configured===false&&<p className="mt-2 text-sm leading-7" role="status">{c.unavailable}</p>}
  <label className="mt-3 flex items-start gap-2 text-sm leading-6"><input type="checkbox" checked={consent} disabled={!configured||busy} onChange={e=>setConsent(e.target.checked)}/>{c.consent}</label>
  <Button type="button" className="mt-3" disabled={!configured||!consent||busy} onClick={()=>void ask()}>{busy?c.busy:c.ask}</Button>
  {error&&<p className="mt-3 text-sm" role="alert">{error}</p>}
  {result&&<div className="mt-4 space-y-3" aria-live="polite"><p className="text-xs font-semibold">{c.draft} · {answer?.model}</p><p className="text-sm leading-7">{result.summary}</p>
   {result.confidence==='low'&&<p className="text-sm">{c.low}</p>}
   <ol className="space-y-3">{result.steps.map((step,i)=><li key={i} className="rounded-lg bg-card p-3 text-sm leading-7"><p>{step.text}</p>{sourceLinks[step.sourceId]&&<a className="underline" href={sourceLinks[step.sourceId]} target="_blank" rel="noreferrer">{c.source}</a>}{action?.(step.sourceId)}</li>)}</ol>
   {!!result.questions.length&&<div><h4 className="text-sm font-semibold">{c.questions}</h4><ul className="list-disc pl-5 text-sm leading-7">{result.questions.map(q=><li key={q}>{q}</li>)}</ul></div>}
   {children?.(result)}
  </div>}
 </section>;
}
export function ExpenseCategoryAssistant({details:d,onChange,lang,demo}:{details:Details;onChange:Dispatch<SetStateAction<Details>>;lang:Language;demo:boolean}){
 const c=words[lang];
 return <section className="border-t border-border pt-5">
  <label className="field">{c.category}<select aria-label={c.category} value={d.expenseCategory??'unsure'} onChange={e=>onChange(p=>({...p,expenseCategory:e.target.value as ExpenseCategory,expenseCategorySource:'manual'}))}>{expenseCategories.map(k=><option key={k} value={k}>{c.categoryNames[k]}</option>)}</select></label>
  <p className="mt-2 text-xs leading-6 text-muted-foreground">{c.notice}</p>
  <AssistantPanel title={c.expense} demo={demo} request={{task:'expense',lang,consent:'sumitt-assistant-v1',context:{description:d.description.slice(0,4000),issuer:d.issuer.slice(0,240)}}}>
   {r=><div className="space-y-2 text-sm leading-7"><p><strong>{c.suggestion}: {r.category?c.categoryNames[r.category]:'—'}</strong></p><p>{c.reason}: {r.reason}</p>{r.evidence&&<p>{c.evidence}: {r.evidence}</p>}
    <Button type="button" variant="outline" disabled={!r.category||r.category==='unsure'||r.confidence==='low'} onClick={()=>onChange(p=>({...p,expenseCategory:r.category!,expenseCategorySource:'aiReviewed'}))}>{c.apply}</Button>
    {d.expenseCategorySource==='aiReviewed'&&d.expenseCategory===r.category&&<p role="status">{c.applied}</p>}
   </div>}
  </AssistantPanel>
 </section>;
}
export function ClosingAssistant({items,settings,lang,demo,action}:{items:CheckItem[];settings:Settings;lang:Language;demo:boolean;action:(id:string)=>ReactNode}){
 return <AssistantPanel title={words[lang].closing} demo={demo} request={{task:'closing',lang,consent:'sumitt-assistant-v1',context:{year:settings.year,items:items.map(({key,ok,count})=>({key,ok,count}))}}} action={action}/>;
}
export function NeAssistant({lang,year,demo}:{lang:Language;year:number;demo:boolean}){
 const c=words[lang],guide=neGuideCopy[lang];const[topic,setTopic]=useState('step:0'),[question,setQuestion]=useState('');
 const field=neFieldRecords.find(f=>f.box===topic);const step=topic.startsWith('step:')?guide.steps[Number(topic.slice(5))]:undefined;
 const source=step?neSources[step.source]:neSources.accounts;
 return <section className="my-6 rounded-xl border border-border p-5">
  <h3 className="font-bold">{c.ne}</h3>
  <label className="field mt-4">{c.topic}<select aria-label={c.topic} value={topic} onChange={e=>{setTopic(e.target.value);setQuestion('');}}>{guide.steps.map((s,i)=><option key={i} value={`step:${i}`}>{s.title}</option>)}{neFieldRecords.map(f=><option key={f.box} value={f.box}>{f.box} · {f.label}</option>)}</select></label>
  <div className="mt-4 rounded-lg bg-muted p-4 text-sm leading-7"><h4 className="font-semibold">{c.context}</h4><p>{field?field[lang]:step?.paragraphs[0]}</p><a href={source} target="_blank" rel="noreferrer" className="underline">{c.source}</a></div>
  <label className="field mt-4">{c.question}<textarea aria-label={c.question} maxLength={500} value={question} placeholder={c.questionPlaceholder} onChange={e=>setQuestion(e.target.value)}/></label>
  <AssistantPanel title={c.ne} demo={demo} request={{task:'ne',lang,consent:'sumitt-assistant-v1',context:{year,topic,question}}} sourceLinks={{[topic]:source}}/>
 </section>;
}
