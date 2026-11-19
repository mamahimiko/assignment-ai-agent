import {normalizeAiOutput,type AiDocumentOutput} from './schema';
// Normalize formatting only. Do not infer tax decisions, missing values or ambiguous separators.
export function providerReading(raw:unknown,pageCount:number):AiDocumentOutput{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return normalizeAiOutput(raw,pageCount);
 const data=raw as Record<string,unknown>;
 if(!Array.isArray(data['fields']))return normalizeAiOutput(raw,pageCount);
 const fields=data['fields'].map(item=>{
  if(!item||typeof item!=='object')return item;
  const f={...item} as Record<string,unknown>;const key=f['field'];let value=f['value'];
  if(typeof value==='number'&&Number.isFinite(value))value=String(value);
  if(typeof value==='string'){
   let text=value.normalize('NFKC').trim();
   if(['total','tax','withholding','fee','received'].includes(String(key))){
    // Only well-formed thousands groups are removed. Decimal comma remains ambiguous.
    if(/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(text))text=text.replaceAll(',','');
   }
   if(['currency','paymentCurrency','country'].includes(String(key)))text=text.toUpperCase();
   if(['invoiceDate','dueDate','paymentDate'].includes(String(key))){
    const m=text.match(/^(\d{4})(?:\/|年|-)(\d{1,2})(?:\/|月|-)(\d{1,2})日?$/);
    if(m)text=`${m[1]}-${m[2]!.padStart(2,'0')}-${m[3]!.padStart(2,'0')}`;
   }
   value=text;
  }
  f['value']=value;
  return f;
 });
 const unique:unknown[]=[];const seen=new Map<string,unknown>();
 for(const item of fields){
  if(!item||typeof item!=='object'){unique.push(item);continue;}
  const f=item as Record<string,unknown>,name=String(f['field']);
  if(seen.has(name)){
   if(seen.get(name)!==f['value'])throw Error('Conflicting duplicate field');
   continue;
  }
  seen.set(name,f['value']);unique.push(f);
 }
 return normalizeAiOutput({...data,fields:unique},pageCount);
}
