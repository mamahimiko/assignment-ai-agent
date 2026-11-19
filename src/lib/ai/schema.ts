import { z } from 'zod';
import type { Details } from '../finance';

export const aiFieldNames = ['type','issuer','number','invoiceDate','dueDate','paymentDate','currency','total','tax','withholding','fee','received','paymentCurrency','country','customerType','description'] as const;
export const AiInput = z.object({
  consent: z.literal('document-ai-v1'),
  filename: z.string().min(1).max(240),
  text: z.string().max(60000),
  pages: z.array(z.object({ page: z.number().int().min(1).max(5), image: z.string().max(2200000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/) })).min(1).max(5),
}).strict().superRefine((data, ctx) => {
  if (data.pages.some((p,i) => p.page !== i+1)) ctx.addIssue({code:'custom',message:'Pages must be consecutive and complete.'});
  if (data.pages.reduce((n,p) => n+p.image.length,0) > 3500000) ctx.addIssue({code:'custom',message:'Images are too large.'});
});
export type AiDocumentInput = z.infer<typeof AiInput>;
export const AiOutput = z.object({
  transcription: z.string().max(60000),
  fields: z.array(z.object({
    field: z.enum(aiFieldNames), value: z.string().max(2000).nullable(),
    page: z.number().int().min(1).max(5), evidence: z.string().max(1500),
    confidence: z.enum(['high','medium','low']),
  }).strict()).max(32),
  warnings: z.array(z.string().max(500)).max(20),
}).strict();
export type AiDocumentOutput = z.infer<typeof AiOutput>;
export type AiField = AiDocumentOutput['fields'][number];
export interface AiReading { result: AiDocumentOutput; model: string; version: string; }
export type AiErrorCode = 'response_format'|'response_truncated'|'response_blocked'|'not_configured'|'provider_auth'|'unauthorized'|'consent_required'|'invalid_input'|'rate_limited'|'credits_exhausted'|'provider_error'|'invalid_response'|'timeout'|'too_many_pages'|'image_too_large';
export type AiReply = {ok:true; reading:AiReading} | {ok:false; code:AiErrorCode};

export function normalizeAiOutput(raw: unknown, pageCount: number): AiDocumentOutput {
  const parsed = AiOutput.parse(raw);
  const seen = new Set<string>();
  const money = new Set(['total','tax','withholding','fee','received']);
  const date = new Set(['invoiceDate','dueDate','paymentDate']);
  const fields = parsed.fields.filter(f => {
    if (seen.has(f.field)) throw new Error('Conflicting duplicate field');
    seen.add(f.field);
    if (f.page > pageCount) throw new Error('Invalid evidence page');
    if (f.value === null) return true;
    if (!f.evidence.trim()) throw new Error('Missing evidence');
    if (money.has(f.field) && !/^\d{1,15}(\.\d{1,2})?$/.test(f.value)) throw new Error('Invalid amount');
    if (date.has(f.field)) {
      const d=new Date(`${f.value}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.value) || Number.isNaN(d.getTime()) || d.toISOString().slice(0,10)!==f.value) throw new Error('Invalid date');
    }
    if (['currency','paymentCurrency'].includes(f.field) && !/^[A-Z]{3}$/.test(f.value)) throw new Error('Invalid currency');
    if (f.field==='country' && !/^[A-Z]{2}$/.test(f.value)) throw new Error('Invalid country');
    if (f.field==='customerType' && !['businessCustomer','individual','unsure'].includes(f.value)) throw new Error('Invalid customer type');
    if (f.field==='type' && !['sales','expense','supplier','bank','previous','tax','other'].includes(f.value)) throw new Error('Invalid document type');
    return true;
  });
  return {...parsed,fields};
}
// Treat all AI values as review candidates. Never allow AI to set paid/review/rates/tax decisions.
export function aiCandidates(result: AiDocumentOutput): Partial<Details> {
  const fields: Partial<Details> = {};
  for (const f of result.fields) {
    if (f.value !== null && f.confidence !== 'low' && f.evidence.trim()) Object.assign(fields,{[f.field]:f.value});
  }
  return fields;
}
export function storedAiReading(original: Record<string,unknown>): AiReading | null {
  const r = original['ai'];
  if (!r || typeof r !== 'object') return null;
  const obj=r as Record<string,unknown>;
  const result=AiOutput.safeParse(obj['result']);
  return result.success && typeof obj['model']==='string' && typeof obj['version']==='string' ? {result:result.data,model:obj['model'],version:obj['version']} : null;
}
