import {afterEach,describe,it,expect,vi} from 'vitest';
import {demoGate,publicDemoAuthorized} from './demo-access.server';
import {requester} from './ai/access.server';
const password='synthetic-demo-password-only';
const request=(value?:string)=>new Request('https://demo.example/api/document-ai',{headers:value?{Authorization:`Basic ${Buffer.from(value).toString('base64')}`}:{}});
afterEach(()=>vi.unstubAllEnvs());
describe('protected hosted demonstration',()=>{
 it('fails closed without a password instead of publishing an open AI endpoint',()=>{vi.stubEnv('SUMITT_PUBLIC_DEMO','true');vi.stubEnv('SUMITT_DEMO_PASSWORD','');expect(demoGate(request())?.status).toBe(503);expect(publicDemoAuthorized(request(`demo:${password}`))).toBe(false);});
 it('challenges all unauthenticated requests and rejects the wrong password or username',()=>{vi.stubEnv('SUMITT_PUBLIC_DEMO','true');vi.stubEnv('SUMITT_DEMO_PASSWORD',password);expect(demoGate(request())?.status).toBe(401);expect(demoGate(request())?.headers.get('www-authenticate')).toContain('Basic');expect(publicDemoAuthorized(request(`user:${password}`))).toBe(false);expect(publicDemoAuthorized(request('demo:incorrect'))).toBe(false);});
 it('uses the shared password for hosted demo AI without requiring Supabase',async()=>{vi.stubEnv('SUMITT_PUBLIC_DEMO','true');vi.stubEnv('SUMITT_DEMO_PASSWORD',password);const r=request(`demo:${password}`);expect(demoGate(r)).toBeNull();expect(await requester(r,false)).toBe('protected-demo');expect(await requester(request(),true)).toBeNull();});
 it('requires explicit protected demo mode on Vercel',()=>{vi.stubEnv('VERCEL','1');vi.stubEnv('SUMITT_PUBLIC_DEMO','false');expect(demoGate(request())?.status).toBe(503);});
 it('retains local development when hosted mode is off',()=>{vi.stubEnv('VERCEL','');vi.stubEnv('SUMITT_PUBLIC_DEMO','');expect(demoGate(request())).toBeNull();});
});
