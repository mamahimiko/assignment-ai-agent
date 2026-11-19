import {describe,it,expect,vi} from 'vitest';
import {structuredReply} from './reply';
import {providerReading} from './normalize-provider';
import {extractWithAi} from './extract.server';
const raw=(args:unknown)=>({choices:[{message:{tool_calls:[{function:{name:'extract_document',arguments:args}}]}}]});
const field={field:'total',value:'75,000',page:1,evidence:'75,000円',confidence:'high'};
const data=(fields:unknown[])=>({transcription:'[Page 1]\n75,000円',fields,warnings:[]});
describe('realistic provider formatting',()=>{
 it('accepts complete tool arguments as JSON strings or objects and JSON-only content',()=>{const o=data([field]);expect(structuredReply(raw(JSON.stringify(o)),'extract_document')).toEqual(o);expect(structuredReply(raw(o),'extract_document')).toEqual(o);expect(structuredReply({choices:[{message:{content:'```json\n'+JSON.stringify(o)+'\n```'}}]},'extract_document')).toEqual(o);});
 it('never uses incomplete or blocked responses',()=>{expect(()=>structuredReply({choices:[{finish_reason:'length',message:{content:'{}'}}]},'extract_document')).toThrow('response_truncated');expect(()=>structuredReply({choices:[{finish_reason:'content_filter'}]},'extract_document')).toThrow('response_blocked');});
 it('rejects wrong tools, multiple tools and prose containing a JSON fragment',()=>{expect(()=>structuredReply(raw('{}'),'other')).toThrow('response_format');expect(()=>structuredReply({choices:[{message:{content:'Here is your answer: {}'}}]},'extract_document')).toThrow('response_format');});
 it('normalizes thousands separators, numeric values, full-width text and explicit calendar dates',()=>{const r=providerReading(data([field,{...field,field:'tax',value:0},{...field,field:'currency',value:'ｊｐｙ'},{...field,field:'invoiceDate',value:'2026年11月19日'}]),1);expect(r.fields.map(f=>f.value)).toEqual(['75000','0','JPY','2026-11-19']);});
 it('does not guess decimal commas, impossible dates or conflicting duplicates',()=>{expect(()=>providerReading(data([{...field,value:'12,50'}]),1)).toThrow();expect(()=>providerReading(data([{...field,field:'invoiceDate',value:'2026/02/30'}]),1)).toThrow();expect(()=>providerReading(data([field,{...field,value:'80000'}]),1)).toThrow();});
 it('deduplicates only identical field values without choosing a conflicting total',()=>{expect(providerReading(data([field,{...field,value:75000}]),1).fields).toHaveLength(1);});
 it('reports truncation separately and makes only one provider request',async()=>{const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{finish_reason:'length'}]})));expect(await extractWithAi({consent:'document-ai-v1',filename:'test.pdf',text:'',pages:[{page:1,image:'data:image/jpeg;base64,YQ=='}]},{key:'test-key',fetch})).toEqual({ok:false,code:'response_truncated'});expect(fetch).toHaveBeenCalledTimes(1);});
});
