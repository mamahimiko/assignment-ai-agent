export class AiReplyError extends Error{}
export function structuredReply(raw:unknown,name:string):unknown{
 if(!raw||typeof raw!=='object')throw new AiReplyError('response_format');
 const j=raw as {choices?:{finish_reason?:string;message?:{refusal?:unknown;content?:unknown;tool_calls?:{function?:{name?:string;arguments?:unknown}}[]}}[];promptFeedback?:{blockReason?:string}};
 const choice=j.choices?.[0];
 if(choice?.finish_reason==='length')throw new AiReplyError('response_truncated');
 if(j.promptFeedback?.blockReason||choice?.finish_reason==='content_filter'||choice?.message?.refusal)throw new AiReplyError('response_blocked');
 const calls=choice?.message?.tool_calls;
 let value:unknown;
 if(calls?.length){
  if(calls.length!==1||calls[0]?.function?.name!==name)throw new AiReplyError('response_format');
  value=calls[0].function.arguments;
 }else value=choice?.message?.content;
 if(typeof value==='object'&&value!==null&&!Array.isArray(value))return value;
 if(typeof value!=='string')throw new AiReplyError('response_format');
 // Accept a single complete JSON object, optionally fenced. Never extract JSON from arbitrary prose.
 const text=value.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i,'$1').trim();
 if(!text.startsWith('{')||!text.endsWith('}'))throw new AiReplyError('response_format');
 try{return JSON.parse(text);}catch{throw new AiReplyError('response_format');}
}
