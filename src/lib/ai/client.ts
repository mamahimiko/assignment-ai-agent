import { renderPdfForAi } from '../pdf';
import { AiOutput, type AiReading, type AiErrorCode } from './schema';
export async function readWithAi(buffer:ArrayBuffer,filename:string,text:string,token:string|undefined, progress:(stage:'rendering'|'reading')=>void):Promise<AiReading>{
  progress('rendering');
  const pages=await renderPdfForAi(buffer);
  progress('reading');
  const body=JSON.stringify({consent:'document-ai-v1',filename,text:text.slice(0,60000),pages});
  if(new TextEncoder().encode(body).byteLength>4000000)throw new Error('image_too_large');
  let response:Response;
  try { response=await fetch('/api/document-ai',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body,signal:AbortSignal.timeout(70000)}); }
  catch(e){throw new Error(e !== null && typeof e === 'object' && 'name' in e && ['TimeoutError','AbortError'].includes(String(e.name))?'timeout':'provider_error');}
  const json=await response.json().catch(()=>null);
  if(!json || !json.ok)throw new Error(json?.code??'provider_error');
  const result=AiOutput.safeParse(json.reading?.result);
  if(!result.success||typeof json.reading?.model!=='string'||typeof json.reading?.version!=='string') throw new Error('invalid_response');
  return {result:result.data,model:json.reading.model,version:json.reading.version};
}
export function errorCode(error:unknown):AiErrorCode {
  const known=['response_format','response_truncated','response_blocked','not_configured','provider_auth','unauthorized','consent_required','invalid_input','rate_limited','credits_exhausted','provider_error','invalid_response','timeout','too_many_pages','image_too_large'];
  return error instanceof Error && known.includes(error.message)?error.message as AiErrorCode:'provider_error';
}
