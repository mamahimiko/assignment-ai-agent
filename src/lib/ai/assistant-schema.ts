import {z} from 'zod';
import {neGuideCopy} from '../ne-guide-content';
export const expenseCategories=['software','office','equipment','travel','professional','fees','other','unsure'] as const;
export type ExpenseCategory=typeof expenseCategories[number];
export const checkKeys=['unresolved','unpaidAtYearEnd','missingRate','feesToReview','duplicates','opening','method','vatStatus'] as const;
const common={consent:z.literal('sumitt-assistant-v1'),lang:z.enum(['ja','en','sv'])};
export const AssistInput=z.discriminatedUnion('task',[
 z.object({...common,task:z.literal('expense'),context:z.object({description:z.string().max(4000),issuer:z.string().max(240)}).strict()}).strict(),
 z.object({...common,task:z.literal('closing'),context:z.object({year:z.number().int().min(2000).max(2100),items:z.array(z.object({key:z.enum(checkKeys),ok:z.boolean(),count:z.number().int().min(0).max(100000)}).strict()).max(8)}).strict()}).strict(),
 z.object({...common,task:z.literal('ne'),context:z.object({year:z.number().int().min(2000).max(2100),topic:z.string().min(1).max(30),question:z.string().max(500)}).strict()}).strict(),
]);
export type AssistantInput=z.infer<typeof AssistInput>;
export const AssistOutput=z.object({summary:z.string().min(1).max(1200),steps:z.array(z.object({text:z.string().min(1).max(900),sourceId:z.string().max(60)}).strict()).max(5),questions:z.array(z.string().max(400)).max(3),category:z.enum(expenseCategories).nullable(),reason:z.string().max(900),evidence:z.string().max(500),confidence:z.enum(['high','medium','low'])}).strict();
export type AssistantResult=z.infer<typeof AssistOutput>;
export function validateAssistantResult(raw:unknown,input:AssistantInput,sources:string[]):AssistantResult{
 const r=AssistOutput.parse(raw);
 if(r.steps.some(s=>!sources.includes(s.sourceId)))throw Error('Unknown source');
 if(input.task!=='expense'&&(r.category!==null||r.reason||r.evidence))throw Error('Unexpected classification');
 if(input.task==='expense'){
  if(!r.category)throw Error('Missing category');
  if(r.evidence&&!`${input.context.description}\n${input.context.issuer}`.includes(r.evidence))throw Error('Unsupported evidence');
  if(r.category!=='unsure'&&r.confidence!=='low'&&!r.evidence.trim())throw Error('No evidence');
 }
 // No monetary amounts, rates, deadlines or invented form boxes in assistant prose.
 const prose=[r.summary,...r.steps.map(s=>s.text),...r.questions,r.reason].join('\n');
 const allowedYear=input.task==='expense'?'':String(input.context.year);
 const selectedStep=input.task==='ne'&&input.context.topic.startsWith('step:')?neGuideCopy[input.lang].steps[Number(input.context.topic.slice(5))]:undefined;
 const boxes=[...sources.flatMap(s=>s.match(/\b[BR]\d{1,2}\b/g)??[]),...(selectedStep?JSON.stringify(selectedStep).match(/\b[BR]\d{1,2}\b/g)??[]:[])];
 const clean=prose.replace(/12月31日|December 31|31 december/gi,'').replace(/Inkomstdeklaration 1/g,'Inkomstdeklaration').replace(/\b[BR]\d{1,2}\b/g,m=>boxes.includes(m)?'':m).replaceAll(allowedYear||'\u0000','').replace(/\b20\d{2}\b/g,'');
 if(/\d|[%％¥￥€$]/.test(clean))throw Error('Unsupported numerical advice');
 return r;
}
