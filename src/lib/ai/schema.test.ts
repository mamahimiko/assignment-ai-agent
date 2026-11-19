import { describe,it,expect } from 'vitest';
import { normalizeAiOutput, aiCandidates, AiInput } from './schema';
const field={field:'total',value:'100000',page:1,evidence:'お振込お願い額 ¥100,000',confidence:'high'};
const result=(fields:unknown[])=>({transcription:'[Page 1]\nお振込お願い額 ¥100,000',fields,warnings:[]});
describe('AI document facts remain review candidates',()=>{
 it('accepts normalized facts with unfamiliar labels and Japanese evidence',()=>{expect(aiCandidates(normalizeAiOutput(result([field]),1))).toEqual({total:'100000'});});
 it('does not fill uncertain handwriting or null amounts',()=>{expect(aiCandidates(normalizeAiOutput(result([{...field,confidence:'low'},{field:'tax',value:null,page:1,evidence:'不鮮明',confidence:'low'}]),1))).toEqual({});});
 it('preserves a clearly printed zero rather than replacing unknown amounts with zero',()=>{expect(aiCandidates(normalizeAiOutput(result([{...field,value:'0'}]),1))).toEqual({total:'0'});expect(aiCandidates(normalizeAiOutput(result([{...field,value:null}]),1))).toEqual({});});
 it.each(['1,000','NaN','-20','1e6'])('rejects invalid monetary representation %s',value=>{expect(()=>normalizeAiOutput(result([{...field,value}]),1)).toThrow();});
 it('rejects a due date presented as an invalid calendar date',()=>{expect(()=>normalizeAiOutput(result([{...field,field:'dueDate',value:'2026-02-30'}]),1)).toThrow();});
 it('rejects invented rates, paid status, and review state',()=>{for(const fieldName of ['rate','paid','review'])expect(()=>normalizeAiOutput(result([{...field,field:fieldName}]),1)).toThrow();});
 it('rejects missing evidence and evidence on pages not submitted',()=>{expect(()=>normalizeAiOutput(result([{...field,evidence:''}]),1)).toThrow();expect(()=>normalizeAiOutput(result([{...field,page:2}]),1)).toThrow();});
 it('rejects conflicting duplicate totals rather than silently choosing one',()=>{expect(()=>normalizeAiOutput(result([field,{...field,value:'200000'}]),1)).toThrow();});
 it('requires explicit consent and ordered complete pages',()=>{const input={consent:'document-ai-v1',filename:'sample.pdf',text:'',pages:[{page:1,image:'data:image/jpeg;base64,YQ=='}]};expect(AiInput.safeParse(input).success).toBe(true);expect(AiInput.safeParse({...input,consent:false}).success).toBe(false);expect(AiInput.safeParse({...input,pages:[{...input.pages[0],page:2}]}).success).toBe(false);});
});
