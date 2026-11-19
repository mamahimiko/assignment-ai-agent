import { emptyDetails, type Details } from './finance';

export interface FieldSource { text: string; page: number; status: 'review_required'; }
export interface Extraction { fields: Partial<Details>; sources: Partial<Record<keyof Details, FieldSource>>; version: string; }
const labels: Partial<Record<keyof Details,string>> = {
 issuer:'発行者|発行元|請求元|取引先|顧客名|会社名|issuer|supplier|customer|seller|utställare|leverantör|kund',
 number:'請求書番号|請求番号|書類番号|invoice\\s*(?:number|no\\.?|#)|document\\s*(?:number|no\\.?)|fakturanummer|faktura\\s*nr',
 invoiceDate:'請求日|発行日|invoice\\s*date|issue\\s*date|fakturadatum',
 dueDate:'支払期限|支払期日|お支払期限|due\\s*date|payment\\s*due|förfallodatum',
 paymentDate:'振込日|入金日|支払日|受領日|payment\\s*date|receipt\\s*date|transfer\\s*date|betalningsdatum|överföringsdatum',
 total:'税込合計|請求総額|ご請求金額|請求金額|合計金額|総額|合計|grand\\s*total|invoice\\s*total|total\\s*amount|amount\\s*due|total|att\\s*betala|totalt|summa',
 tax:'消費税(?:額)?|税額|VAT(?:\\s*amount)?|tax\\s*amount|moms(?:belopp)?',
 withholding:'源泉徴収税(?:額)?|源泉所得税|源泉税|withholding(?:\\s*tax)?|källskatt',
 fee:'振込手数料|送金手数料|transfer\\s*fee|bank\\s*fee|överföringsavgift|bankavgift',
 received:'入金額|実際の入金額|受取金額|振込金額|支払済金額|amount\\s*received|amount\\s*paid|net\\s*received|received|mottaget\\s*belopp|betalt\\s*belopp',
 currency:'請求通貨|通貨|invoice\\s*currency|currency|fakturavaluta|valuta',
 paymentCurrency:'入金通貨|支払通貨|payment\\s*currency|betalningsvaluta',
 country:'取引先の国|国名|country|land',
 description:'摘要|品名|件名|内容|description|service|beskrivning',
 customerType:'顧客区分|取引先区分|customer\\s*type|kundtyp',
};
function dateValue(value:string): string | undefined {
 const m=value.match(/(20\d{2})\s*[年/.-]\s*(\d{1,2})\s*[月/.-]\s*(\d{1,2})/);
 const western=value.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
 let y='',month='',day='';
 if(m){y=m[1]??'';month=m[2]??'';day=m[3]??'';}
 else if(western){y=western[3]??'';month=western[2]??'';day=western[1]??'';}
 else {const named=value.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i);if(!named)return; y=named[3]??''; day=named[1]??''; month=String(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf((named[2]??'').slice(0,3).toLowerCase())+1);}
 const iso=`${y}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;const dt=new Date(`${iso}T00:00:00Z`);if(Number.isNaN(dt.getTime())||dt.toISOString().slice(0,10)!==iso)return;return iso;
}
function amountValue(value:string):string|undefined {
 // Remove explicitly printed percentages before finding the monetary value.
 const cleaned=value.replace(/\d+(?:[.,]\d+)?\s*[%％]/g,'');
 const m=cleaned.match(/(?:[-−]\s*)?\d[\d\s\u00a0,.'’]*(?:\d)?/);if(!m)return;
 let number=m[0].trim().replace(/[\s\u00a0'’]/g,'').replace('−','-');
 if(number.includes(',')&&number.includes('.')){if(number.lastIndexOf(',')>number.lastIndexOf('.'))number=number.replace(/\./g,'').replace(',','.');else number=number.replace(/,/g,'');}
 else if(number.includes(',')){const parts=number.split(',');number=parts.length===2&&(parts[1]?.length===1||parts[1]?.length===2)?number.replace(',','.'):number.replace(/,/g,'');}
 if(!/^-?\d+(?:\.\d+)?$/.test(number))return;return number;
}
function currencyValue(value:string):string|undefined {const code=value.match(/\b(SEK|JPY|EUR|USD|GBP|CHF|CAD|AUD|NOK|DKK|CNY)\b/i);if(code)return code[1]?.toUpperCase();if(/円|￥|¥/.test(value))return 'JPY';if(/€/.test(value))return 'EUR';if(/\bSEK\b|スウェーデンクローナ/i.test(value))return 'SEK';return;}

export function extractDocument(text:string,name=''):Extraction {
 const normalized=text.normalize('NFKC');const sources:Extraction['sources']={};const fields:Partial<Details>={};
 const lines=normalized.split(/\r?\n/);let page=1;
 for(let i=0;i<lines.length;i++){
  const line=lines[i]?.trim()??'';const marker=line.match(/^\[Page (\d+)\]$/);if(marker){page=Number(marker[1]);continue;}
  for(const [key,label] of Object.entries(labels)){
   const field=key as keyof Details;if(fields[field]!==undefined)continue;
   const m=line.match(new RegExp(`(?:^|[\\s|])(?:${label})(?:\\s*\\(?\\d+(?:[.,]\\d+)?%\\)?)?\\s*(?::|：|#|=)?\\s*(.*)$`,'i'));if(!m)continue;
   let raw=m[1]?.trim()??'';if(!raw&&lines[i+1]&&!/^\[Page/.test(lines[i+1]??''))raw=lines[i+1]?.trim()??'';
   // End at the next known labelled field, so single-line PDFs can still be parsed.
   const allLabels=Object.values(labels).join('|');raw=raw.split(new RegExp(`\\s+(?=(?:${allLabels})\\s*(?::|：|#|=))`,'i'))[0]?.trim()??'';
   let value:string|undefined;
   if(['invoiceDate','dueDate','paymentDate'].includes(key))value=dateValue(raw);
   else if(['total','tax','withholding','fee','received'].includes(key))value=amountValue(raw);
   else if(key==='currency'||key==='paymentCurrency')value=currencyValue(raw);
   else if(key==='country'){const c=raw.match(/^(JP|SE|DE|US|GB|FR|FI|NO|DK|CA|AU)\b/i);value=c?.[1]?.toUpperCase();}
   else if(key==='customerType'){if(/^(法人|事業者|business|company|företag)\b/i.test(raw)||/^(法人|事業者)$/.test(raw))value='businessCustomer';else if(/^(個人|individual|private|privatperson)/i.test(raw))value='individual';}
   else value=raw||undefined;
   if(value!==undefined){Object.assign(fields,{[field]:value});sources[field]={text:line+(m[1]?.trim()?'':`\n${raw}`),page,status:'review_required'};}
   if(key==='total'&&!fields.currency){const currency=currencyValue(raw);if(currency){fields.currency=currency;sources.currency={text:line,page,status:'review_required'};}}
  }
  if(!fields.issuer&&/株式会社|合同会社|有限会社/.test(line)&&line.length<100&&!/請求日|支払期限|金額/.test(line)){fields.issuer=line;sources.issuer={text:line,page,status:'review_required'};}
 }
 const content=name+' '+normalized;
 if(/bank statement|kontoutdrag|銀行明細|振込明細/i.test(content))fields.type='bank';else if(/請求書|invoice|faktura/i.test(content))fields.type='sales';else if(/領収書|receipt|kvitto/i.test(content))fields.type='expense';
 if(fields.type)sources.type={text:name||normalized.slice(0,120),page:1,status:'review_required'};
 return {fields,sources,version:'labelled-pdf-text-v1'};
}

export function prefillDetails(details:Details,text:string,name=''):Details {
 const extraction=extractDocument(text,name);const result={...emptyDetails,...details};
 for(const [key,value] of Object.entries(extraction.fields)){
  const field=key as keyof Details;const current=result[field];
  if(current===''||(field==='type'&&current==='other')||(field==='customerType'&&current==='unsure'))Object.assign(result,{[field]:value});
 }
 return result;
}