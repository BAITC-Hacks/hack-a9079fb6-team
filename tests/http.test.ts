import { describe,it,expect,vi } from 'vitest';
import { createRateLimiter,errorResponse,HttpError,readJson } from '../lib/http';
describe('HTTP safeguards',()=>{
 it('limits a burst and resets after the window',()=>{
  const check=createRateLimiter(2,100);const now=Date.now();check(now);check(now);
  expect(()=>check(now)).toThrow(HttpError);expect(()=>check(now+101)).not.toThrow();
 });
 it('redacts internal failures',async()=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  try {const res=errorResponse(new Error('sensitive-internal-details'));expect(res.status).toBe(500);expect(await res.text()).not.toContain('sensitive');}
  finally {log.mockRestore();}
 });
 it('handles unknown failures',async()=>{const log=vi.spyOn(console,'error').mockImplementation(()=>{});try{expect(errorResponse(null).status).toBe(500);}finally{log.mockRestore();}});
 it('requires a body',async()=>{await expect(readJson(new Request('http://localhost/api',{method:'POST',headers:{'content-type':'application/json'}}))).rejects.toMatchObject({status:400});});
 it('reads UTF-8 across stream chunks',async()=>{
  const bytes=new TextEncoder().encode('{"word":"Привет"}');
  const stream=new ReadableStream({start(c){for(const b of bytes)c.enqueue(new Uint8Array([b]));c.close();}});
  const request=new Request('http://localhost/api',{method:'POST',headers:{'content-type':'application/json; charset=utf-8'},body:stream,duplex:'half'} as RequestInit);
  expect(await readJson(request)).toEqual({word:'Привет'});
 });
});

it('accepts browser origin matching Host when Next rewrites internal hostname', async () => {
 const request = new Request('http://localhost:3100/api/match', {method:'POST', headers:{'content-type':'application/json',host:'127.0.0.1:3100',origin:'http://127.0.0.1:3100'},body:'{}'});
 expect(await readJson(request)).toEqual({});
});
it('rejects a foreign origin even with an explicit Host', async () => {
 const request = new Request('http://localhost:3100/api/match', {method:'POST', headers:{'content-type':'application/json',host:'127.0.0.1:3100',origin:'http://evil.example'},body:'{}'});
 await expect(readJson(request)).rejects.toMatchObject({status:403});
});
