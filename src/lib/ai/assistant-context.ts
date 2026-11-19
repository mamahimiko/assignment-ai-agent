import {dictionaries,type TranslationKey} from '../i18n';
import {neGuideCopy,neFieldRecords,neSources} from '../ne-guide-content';
import type {AssistantInput} from './assistant-schema';
export function assistantContext(input:AssistantInput):{sources:string[];facts:Record<string,unknown>;links:Record<string,string>}{
 const t=dictionaries[input.lang];
 if(input.task==='expense')return {sources:['document'],facts:{description:input.context.description,issuer:input.context.issuer},links:{}};
 if(input.task==='closing'){
  const seen=new Set<string>();
  for(const item of input.context.items){if(seen.has(item.key))throw Error('Duplicate checks');seen.add(item.key);}
  const pending=input.context.items.filter(i=>!i.ok);
  return {sources:pending.map(i=>i.key),facts:{year:input.context.year,checks:pending.map(i=>({...i,title:t[`check_${i.key}` as TranslationKey],meaning:t[`checkHint_${i.key}` as TranslationKey]})),scope:'Recorded checklist only. Not a completed year-end account or validated tax return.'},links:{}};
 }
 const guide=neGuideCopy[input.lang];
 if(input.context.topic.startsWith('step:')){
  const index=Number(input.context.topic.slice(5));
  if(!Number.isInteger(index)||index<0||index>=guide.steps.length)throw Error('Unknown topic');
  const step=guide.steps[index]!;
  return {sources:[input.context.topic],facts:{year:input.context.year,limitation:guide.limitation,title:step.title,path:step.path,paragraphs:step.paragraphs,question:input.context.question},links:{[input.context.topic]:neSources[step.source]}};
 }
 const field=neFieldRecords.find(f=>f.box===input.context.topic);
 if(!field)throw Error('Unknown NE field');
 return {sources:[field.box],facts:{year:input.context.year,limitation:guide.limitation,box:field.box,label:field.label,meaning:field[input.lang],question:input.context.question},links:{[field.box]:neSources.accounts}};
}
