import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { MediaQueue } from './mediaQueue';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
test('shares an active decode across remounts without letting one cancellation break the other', async () => {
  const queue = new MediaQueue();
  let calls = 0, finish!: (value: string) => void;
  const decode = () => { calls++; return new Promise<string>(resolve => { finish = resolve; }); };
  const abort = new AbortController();
  const first = queue.request('same', true, decode, abort.signal);
  const cancelled = assert.rejects(first, /Cancelled/);
  abort.abort();
  const second = queue.request('same', true, decode);
  await flush();
  assert.equal(calls, 1);
  finish('cached.jpg');
  assert.equal(await second, 'cached.jpg');
  await cancelled;
  await flush();
  assert.deepEqual(queue.getProgress(), { total: 1, completed: 1, failed: 0, pending: 0 });
});

test('bounds concurrency, skips obsolete queued cards, and continues after a decode failure', async () => {
  const queue = new MediaQueue();
  const finishes: Array<(value: string) => void> = [];
  const running = Array.from({ length: 3 }, (_, i) => queue.request(String(i), true, () => new Promise<string>(resolve => finishes.push(resolve))));
  const abort = new AbortController();
  const obsolete = queue.request('obsolete', true, async () => { throw Error('Must not decode'); }, abort.signal);
  const cancelled = assert.rejects(obsolete, /Cancelled/);
  abort.abort();
  const broken = queue.request('broken', true, async () => { throw Error('Unsupported'); });
  const failure = assert.rejects(broken, /Unsupported/);
  const next = queue.request('next', true, async () => 'next.jpg');
  await flush();
  assert.equal(finishes.length, 3);
  finishes.forEach(finish => finish('ok.jpg'));
  await Promise.all([...running, cancelled, failure, next]);
  await flush();
  assert.deepEqual(queue.getProgress(), { total: 5, completed: 5, failed: 1, pending: 0 });
  assert.equal(await queue.request('broken', true, async () => 'retry.jpg'), 'retry.jpg');
  await flush();
  assert.deepEqual(queue.getProgress(), { total: 1, completed: 1, failed: 0, pending: 0 });
});

test('visible thumbnails overtake prefetch and queued cards can be promoted',async()=>{
 const queue=new MediaQueue(),finishes:Array<(s:string)=>void>=[],order:string[]=[];
 const running=Array.from({length:3},(_,i)=>queue.request('busy'+i,true,()=>new Promise<string>(resolve=>finishes.push(resolve))));
 const prefetch=queue.request('prefetch',true,async()=>{order.push('prefetch');return 'a';},undefined,1);
 const promoted=queue.request('promoted',true,async()=>{order.push('promoted');return 'b';},undefined,1);
 const visible=queue.request('visible',true,async()=>{order.push('visible');return 'c';},undefined,0);
 queue.prioritize('promoted',0);await flush();finishes[0]('done');await Promise.all([prefetch,promoted,visible]);assert.deepEqual(order,['visible','promoted','prefetch']);finishes.slice(1).forEach(f=>f('done'));await Promise.all(running);
});
