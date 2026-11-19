// Offline smoke test of the production Vercel output. Uses synthetic credentials
// and a mock Gemini reply, never a real API key or an external network request.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
process.env.VERCEL='1';process.env.SUMITT_PUBLIC_DEMO='true';
process.env.SUMITT_DEMO_PASSWORD='synthetic-smoke-password-only';
delete process.env.GEMINI_API_KEY;delete process.env.SUPABASE_URL;delete process.env.SUPABASE_PUBLISHABLE_KEY;
const auth=`Basic ${Buffer.from('demo:synthetic-smoke-password-only').toString('base64')}`;
let calls=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url)=>{
 assert.equal(String(url),'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');calls++;
 const facts={transcription:'[Page 1]\n合計75,000円',fields:[{field:'total',value:'75,000',page:1,evidence:'75,000円',confidence:'high'}],warnings:[]};
 return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(facts)}}]}));
};
const app=(await import(pathToFileURL(path.resolve('.vercel/output/functions/__server.func/index.mjs')).href)).default;
const req=(route,{method='GET',authenticated=true,origin='https://demo.example',body}={})=>new Request(`https://demo.example${route}`,{method,headers:{...(authenticated?{Authorization:auth}:{}),...(method==='POST'?{Origin:origin,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
try{
 assert.equal((await app.fetch(req('/',{authenticated:false}),{})).status,401);
 for(const route of ['/','/documents','/reports']){const response=await app.fetch(req(route),{});assert.equal(response.status,200,route);assert.match(response.headers.get('cache-control')??'',/no-store/);assert.match(await response.text(),/Sumitt/);}
 assert.equal((await app.fetch(req('/api/document-ai'),{})).status,200);
 const input={consent:'document-ai-v1',filename:'synthetic.pdf',text:'',pages:[{page:1,image:'data:image/jpeg;base64,YQ=='}]};
 assert.equal((await app.fetch(req('/api/document-ai',{method:'POST',origin:'https://untrusted.example',body:input}),{})).status,403);
 let response=await app.fetch(req('/api/document-ai',{method:'POST',body:input}),{});assert.equal((await response.json()).code,'not_configured');assert.equal(calls,0);
 process.env.GEMINI_API_KEY='synthetic-smoke-key-only';
 response=await app.fetch(req('/api/document-ai',{method:'POST',body:input}),{});const result=await response.json();assert.equal(result.ok,true);assert.equal(result.reading.result.fields[0].value,'75000');assert.equal(calls,1);
 process.env.SUMITT_DEMO_PASSWORD='';assert.equal((await app.fetch(req('/'),{})).status,503);
 console.log('Production smoke passed: password gate, SSR pages, private caching, same-origin AI, no-key failure and normalized mocked Gemini response. No external calls.');
}finally{globalThis.fetch=originalFetch;}
