import { createFileRoute } from '@tanstack/react-router';
export const Route=createFileRoute('/api/document-ai')({server:{handlers:{
  GET:async()=>{
    const {aiConfigured,AI_MODEL}=await import('@/lib/ai/extract.server');
    return Response.json({configured:aiConfigured(),provider:'Google Gemini',model:AI_MODEL},{headers:{'Cache-Control':'no-store'}});
  },
  POST:async({request})=>{
    const {sameOrigin,requester,takeBudget,readLimitedJson}=await import('@/lib/ai/access.server');
    if(!sameOrigin(request))return Response.json({ok:false,code:'unauthorized'},{status:403});
    const id=await requester(request,import.meta.env.DEV&&import.meta.env.MODE==='demo');
    if(!id)return Response.json({ok:false,code:'unauthorized'},{status:401});
    if(!takeBudget(id))return Response.json({ok:false,code:'rate_limited'},{status:429});
    let body:unknown;try{body=await readLimitedJson(request);}catch{return Response.json({ok:false,code:'invalid_input'},{status:400});}
    const {extractWithAi}=await import('@/lib/ai/extract.server');
    return Response.json(await extractWithAi(body),{headers:{'Cache-Control':'no-store'}});
  },
}}});
