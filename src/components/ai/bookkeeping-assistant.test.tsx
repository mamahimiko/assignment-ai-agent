import {useState} from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {ExpenseCategoryAssistant,NeAssistant,AssistantPanel} from './bookkeeping-assistant';
import {emptyDetails,type Details} from '@/lib/finance';
const reply={ok:true,model:'gemini-test',result:{summary:'ソフトの利用料です。',steps:[],questions:['事業用ですか？'],category:'software',reason:'ソフトと記載されています。',evidence:'ソフト利用料',confidence:'medium'}};
function Expense(){const[d,setD]=useState<Details>({...emptyDetails,type:'expense',description:'ソフト利用料'});return <><ExpenseCategoryAssistant details={d} onChange={setD} lang="ja" demo/><output data-testid="state">{d.expenseCategory??'unsure'}:{d.review}:{String(d.paid)}</output></>;}
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('AI explanation review and consent',()=>{
 it('does not send document context before consent and an explicit click',async()=>{
  const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({configured:true})));vi.stubGlobal('fetch',fetch);render(<Expense/>);
  await waitFor(()=>expect(screen.getByRole('checkbox')).toBeEnabled());expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0]?.[0]).toBe('/api/document-ai');expect(screen.getByRole('button',{name:'AIに説明してもらう'})).toBeDisabled();
 });
 it('applies a category only after review and never changes paid or review status',async()=>{
  const fetch=vi.fn().mockImplementation((url:string)=>Promise.resolve(new Response(JSON.stringify(url==='/api/document-ai'?{configured:true}:reply))));vi.stubGlobal('fetch',fetch);render(<Expense/>);
  await waitFor(()=>expect(screen.getByRole('checkbox')).toBeEnabled());fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'AIに説明してもらう'}));
  const button=await screen.findByRole('button',{name:'この候補を採用'});expect(screen.getByTestId('state')).toHaveTextContent('unsure:pending:false');fireEvent.click(button);expect(screen.getByTestId('state')).toHaveTextContent('software:pending:false');
 });
 it('keeps the local NE guide available without an AI key',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({configured:false}))));render(<NeAssistant lang="ja" year={2026} demo/>);
  expect(await screen.findByText(/Geminiは未接続/)).toBeInTheDocument();fireEvent.change(screen.getByLabelText('説明してほしい項目'),{target:{value:'B9'}});expect(screen.getByText(/年度末の事業の現金/)).toBeInTheDocument();expect(screen.getByRole('button',{name:'AIに説明してもらう'})).toBeDisabled();
 });
 it('hides an old explanation after source context changes',async()=>{
  const fetch=vi.fn().mockImplementation((url:string)=>Promise.resolve(new Response(JSON.stringify(url==='/api/document-ai'?{configured:true}:reply))));vi.stubGlobal('fetch',fetch);
  const request={task:'expense' as const,lang:'ja' as const,consent:'sumitt-assistant-v1' as const,context:{issuer:'test',description:'ソフト利用料'}};
  const view=render(<AssistantPanel title="test" demo request={request}/>);await waitFor(()=>expect(screen.getByRole('checkbox')).toBeEnabled());fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'AIに説明してもらう'}));expect(await screen.findByText('ソフトの利用料です。')).toBeInTheDocument();view.rerender(<AssistantPanel title="test" demo request={{...request,context:{...request.context,description:'別の書類'}}}/>);expect(screen.queryByText('ソフトの利用料です。')).not.toBeInTheDocument();
 });
});
