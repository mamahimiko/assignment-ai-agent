import {useState} from 'react';
import {render,screen,waitFor,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {DocumentRateFields} from './document-rate-fields';
import {emptyDetails,type Details} from '@/lib/finance';
import {fetchSekRate} from '@/lib/exchange-rate';
vi.mock('@/lib/exchange-rate',async()=>({...await vi.importActual('@/lib/exchange-rate'),fetchSekRate:vi.fn()}));
const fetchRate=vi.mocked(fetchSekRate);
function Harness({initial}:{initial:Details}){const[d,setD]=useState(initial);return <><DocumentRateFields details={d} onChange={setD} lang="ja"/><output data-testid="payment">{d.paymentDate}:{String(d.paid)}</output></>;}
const doc={...emptyDetails,invoiceDate:'2026-10-03',paymentDate:'2026-11-25',paid:false};
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe('document month-end field workflow',()=>{
 it('fills all three fields automatically, even on an unpaid document, without changing payment information',async()=>{
  fetchRate.mockResolvedValue({rate:'0.06',rateDate:'2026-10-30',rateSource:'ECB fixture'});render(<Harness initial={doc}/>);
  await waitFor(()=>expect(screen.getByLabelText('為替レート：請求通貨1単位 = X SEK')).toHaveValue('0.06'));
  expect(screen.getByLabelText('公表されたレートの日付')).toHaveValue('2026-10-30');expect(screen.getByLabelText('レートの出典・手入力の参照元')).toHaveValue('ECB fixture');expect(screen.getByTestId('payment')).toHaveTextContent('2026-11-25:false');expect(fetchRate).toHaveBeenCalledWith('JPY','2026-10-31');
 });
 it('preserves a saved manual rate without fetching',()=>{render(<Harness initial={{...doc,rate:'0.067',rateDate:'2026-10-23',rateSource:'Saved manual'}}/>);expect(fetchRate).not.toHaveBeenCalled();expect(screen.getByLabelText('為替レート：請求通貨1単位 = X SEK')).toHaveValue('0.067');});
 it('does not overwrite a manual correction when an in-flight request returns',async()=>{
  let finish!:(v:{rate:string;rateDate:string;rateSource:string})=>void;fetchRate.mockReturnValue(new Promise(r=>{finish=r;}));render(<Harness initial={doc}/>);
  fireEvent.change(screen.getByLabelText('為替レート：請求通貨1単位 = X SEK'),{target:{value:'0.055'}});finish({rate:'0.06',rateDate:'2026-10-30',rateSource:'ECB fixture'});
  await waitFor(()=>expect(screen.getByLabelText('為替レート：請求通貨1単位 = X SEK')).toHaveValue('0.055'));
 });
 it('leaves future month-end blank with a clear explanation',async()=>{fetchRate.mockResolvedValue('future');render(<Harness initial={{...doc,invoiceDate:'2026-11-19'}}/>);expect(await screen.findByText(/対象日はまだ先/)).toBeInTheDocument();expect(screen.getByLabelText('為替レート：請求通貨1単位 = X SEK')).toHaveValue('');});
 it('refetches and replaces the old rate when the reference month changes',async()=>{
  fetchRate.mockResolvedValue({rate:'0.06',rateDate:'2026-09-30',rateSource:'ECB fixture'});render(<Harness initial={doc}/>);
  await waitFor(()=>expect(screen.getByLabelText('為替レート：請求通貨1単位 = X SEK')).toHaveValue('0.06'));
  fetchRate.mockResolvedValue({rate:'0.061',rateDate:'2026-10-30',rateSource:'ECB October'});
  fireEvent.input(screen.getByLabelText('対象月'),{target:{value:'2026-10'}});
  await waitFor(()=>expect(screen.getByLabelText('為替レート：請求通貨1単位 = X SEK')).toHaveValue('0.061'));
  expect(fetchRate).toHaveBeenLastCalledWith('JPY','2026-10-31');
 });

});
