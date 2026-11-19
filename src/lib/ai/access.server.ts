import {publicDemoEnabled,publicDemoAuthorized} from '../demo-access.server';
import { createClient } from '@supabase/supabase-js';
const budget=new Map<string,{at:number;count:number}>();
export function sameOrigin(request: Request): boolean {
  // An explicit browser Origin is required for all POSTs, including local demos.
  const origin=request.headers.get('origin');
  return !!origin && origin===new URL(request.url).origin && !['cross-site','none'].includes(request.headers.get('sec-fetch-site')??'same-origin');
}
export function takeBudget(id:string, now=Date.now()): boolean {
  if(budget.size>1000) for(const [k,v] of budget) if(now-v.at>60000) budget.delete(k);
  const existing=budget.get(id);
  const item=!existing||now-existing.at>=60000?{at:now,count:0}:existing;
  if(item.count>=10) return false;
  item.count++;budget.set(id,item);return true;
}
export async function requester(request:Request, localDemo:boolean): Promise<string|null> {
  if(publicDemoEnabled())return publicDemoAuthorized(request)?'protected-demo':null;
  const host=new URL(request.url).hostname;
  if(localDemo && ['localhost','127.0.0.1','[::1]'].includes(host)) return 'local-demo';
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  const url=process.env['SUPABASE_URL'];const key=process.env['SUPABASE_PUBLISHABLE_KEY'];
  if(!token||!url||!key) return null;
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.getUser(token);
  return !error && data.user ? data.user.id : null;
}
export async function readLimitedJson(request:Request):Promise<unknown>{
  if(!request.headers.get('content-type')?.includes('application/json')) throw new Error('Invalid content type');
  const limit=4000000;
  if(Number(request.headers.get('content-length')??0)>limit) throw new Error('Too large');
  const reader=request.body?.getReader();if(!reader)throw new Error('No body');
  const chunks:Uint8Array[]=[];let length=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit)throw new Error('Too large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const body=new Uint8Array(length);let offset=0;for(const c of chunks){body.set(c,offset);offset+=c.length;}
  return JSON.parse(new TextDecoder().decode(body));
}
