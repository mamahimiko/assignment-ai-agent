import {describe,it,expect} from 'vitest';
import {sameOrigin,requester,takeBudget,readLimitedJson} from './access.server';
describe('AI endpoint access and size limits',()=>{
 it('rejects cross-origin browser requests and requests without Origin',()=>{expect(sameOrigin(new Request('http://localhost:5173/api/document-ai',{headers:{Origin:'https://untrusted.example'}}))).toBe(false);expect(sameOrigin(new Request('http://localhost:5173/api/document-ai'))).toBe(false);expect(sameOrigin(new Request('http://localhost:5173/api/document-ai',{headers:{Origin:'http://localhost:5173'}}))).toBe(true);});
 it('permits unauthenticated demo requests only on development loopback',async()=>{expect(await requester(new Request('http://localhost:5173/api/document-ai'),true)).toBe('local-demo');expect(await requester(new Request('https://public.example/api/document-ai'),true)).toBeNull();expect(await requester(new Request('http://localhost:5173/api/document-ai'),false)).toBeNull();});
 it('limits requests and restores the budget after a minute',()=>{const id='test-'+Math.random();for(let i=0;i<10;i++)expect(takeBudget(id,100)).toBe(true);expect(takeBudget(id,101)).toBe(false);expect(takeBudget(id,60101)).toBe(true);});
 it('rejects oversized request bodies',async()=>{await expect(readLimitedJson(new Request('http://localhost/',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':'7000001'},body:'{}'}))).rejects.toThrow('Too large');});
});
