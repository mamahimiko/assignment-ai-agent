import {createHash,timingSafeEqual} from 'node:crypto';
export function publicDemoEnabled(){return process.env['SUMITT_PUBLIC_DEMO']==='true';}
export function demoPasswordConfigured(){return (process.env['SUMITT_DEMO_PASSWORD']?.length??0)>=16;}
export function publicDemoAuthorized(request:Request):boolean{
 if(!publicDemoEnabled()||!demoPasswordConfigured())return false;
 const encoded=request.headers.get('authorization')?.match(/^Basic ([A-Za-z0-9+/=]+)$/i)?.[1];
 if(!encoded||encoded.length>4096)return false;
 try{
  const actual=Buffer.from(encoded,'base64').toString('utf8');
  const expected=`demo:${process.env['SUMITT_DEMO_PASSWORD']}`;
  return timingSafeEqual(createHash('sha256').update(actual).digest(),createHash('sha256').update(expected).digest());
 }catch{return false;}
}
export function demoGate(request:Request):Response|null{
 if(!publicDemoEnabled()){
  // Prevent accidentally deploying the local-only demo without protection.
  if(process.env['VERCEL']==='1')return new Response('Set SUMITT_PUBLIC_DEMO=true and a private SUMITT_DEMO_PASSWORD before using this demo.',{status:503,headers:{'Cache-Control':'no-store'}});
  return null;
 }
 if(!demoPasswordConfigured())return new Response('Demo access is not configured. Set SUMITT_DEMO_PASSWORD to at least 16 characters in the server environment.',{status:503,headers:{'Cache-Control':'no-store'}});
 if(!publicDemoAuthorized(request))return new Response('Private Sumitt demo. Sign in with username demo and the shared demo password.',{status:401,headers:{'WWW-Authenticate':'Basic realm="Sumitt Demo", charset="UTF-8"','Cache-Control':'no-store'}});
 return null;
}
