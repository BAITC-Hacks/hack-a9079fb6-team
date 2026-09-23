import { describe, expect, it } from 'vitest';
import { POST } from '../app/api/match/route';
import { POST as compare } from '../app/api/compare/route';
import { GET } from '../app/api/catalog/route';
import fixtures from '../fixtures/demo-queries.json';
const { expected: _expected, ...valid } = fixtures.dense;
const req = (body: unknown, headers: Record<string,string> = {}) => new Request('http://localhost/api/match', {
  method:'POST', headers:{'content-type':'application/json',...headers}, body:JSON.stringify(body)
});
describe('API integration',()=>{
 it('returns a real shortlist and identical results without keys',async()=>{
  const first=await POST(req(valid)); const second=await POST(req(valid));
  expect(first.status).toBe(200); const a=await first.json();
  expect(a.cards).toHaveLength(3); expect(await second.json()).toEqual(a);
 });
 it.each([
  ['negative budget',{...valid,budget:-1}], ['string budget',{...valid,budget:'1000000'}],
  ['infinite budget',{...valid,budget:null}], ['missing city',{...valid,city:undefined}],
  ['unknown city',{...valid,city:'Москва'}], ['invalid calendar date',{...valid,date:'2026-11-31'}],
  ['invalid format',{...valid,eventType:'unknown'}], ['invalid category',{...valid,category:'unknown'}],
  ['zero duration',{...valid,hours:0}], ['invalid language',{...valid,language:'unknown'}],
  ['long wish',{...valid,wish:'a'.repeat(1001)}], ['not object',null], ['array',[]]
 ])('rejects %s',async(_label,body)=>{
  const res=await POST(req(body)); expect(res.status).toBe(400); expect((await res.json()).error).toBeTruthy();
 });
 it('valid out-of-window dates are a domain outcome',async()=>{
  const res=await POST(req({...valid,date:'2027-01-01'}));
  expect(res.status).toBe(200); expect((await res.json()).outcome).toBe('date_out_of_range');
 });
 it('rejects invalid JSON',async()=>{
  const res=await POST(new Request('http://localhost/api/match',{method:'POST',headers:{'content-type':'application/json'},body:'{'}));
  expect(res.status).toBe(400);
 });
 it('rejects overly large bodies',async()=>{
  const res=await POST(req({...valid,wish:'a'.repeat(20000)}));expect(res.status).toBe(413);
 });
 it('requires JSON',async()=>{const res=await POST(req(valid,{'content-type':'text/plain'}));expect(res.status).toBe(415);});
 it('rejects cross-origin requests',async()=>{const res=await POST(req(valid,{origin:'https://unrelated.example'}));expect(res.status).toBe(403);});
 it('allows same origin',async()=>{const res=await POST(req(valid,{origin:'http://localhost'}));expect(res.status).toBe(200);});
 it('catalog lists options from real data',async()=>{
  const res=await GET(); const body=await res.json();
  expect(res.status).toBe(200); expect(body.categories).toHaveLength(17);
  expect(body.cities).toContain('Астана'); expect(body.languages).toContain('казахский');
 });
 it('compares two dates and attributes actual busy departures',async()=>{
  const res=await compare(req({request:valid,secondDate:fixtures.dense_other_date.date}));
  expect(res.status).toBe(200); const body=await res.json();
  expect(body.first.cards).toHaveLength(3); expect(body.second.cards).toHaveLength(1);
  expect(body.removed.length).toBeGreaterThan(0);
  expect(body.removed.every((x:{reason:string})=>x.reason==='busy')).toBe(true);
 });
 it('rejects invalid comparison',async()=>{expect((await compare(req({request:valid,secondDate:'not-date'}))).status).toBe(400);});
 it('out-of-range comparison does not falsely claim contractors became busy',async()=>{
  const body=await (await compare(req({request:valid,secondDate:'2027-01-01'}))).json();
  expect(body.second.outcome).toBe('date_out_of_range'); expect(body.removed).toEqual([]);
 });
});
