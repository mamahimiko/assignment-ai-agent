import {createFileRoute} from '@tanstack/react-router';
export const Route=createFileRoute('/api/assistant')({server:{handlers:{POST:async({request})=>{
 const {sameOrigin,requester,takeBudget,readLimitedJson}=await import('@/lib/ai/access.server');
 if(!sameOrigin(request))return Response.json({ok:false,code:'unauthorized'},{status:403});
 const id=await requester(request,import.meta.env.DEV&&import.meta.env.MODE==='demo');
 if(!id)return Response.json({ok:false,code:'unauthorized'},{status:401});
 if(!takeBudget(id))return Response.json({ok:false,code:'rate_limited'},{status:429});
 let body:unknown;try{body=await readLimitedJson(request);}catch{return Response.json({ok:false,code:'invalid_input'},{status:400});}
 const {assist}=await import('@/lib/ai/assistant.server');
 return Response.json(await assist(body),{headers:{'Cache-Control':'no-store'}});
}}}});
