import test from "node:test";
import assert from "node:assert/strict";
import { AppHistory } from "./appHistory";
test('undo and redo work across settings and Home as one ordered history',async()=>{
 const h=new AppHistory();h.read('style',()=>1);h.read('tiles',()=>['a']);
 h.commit('Style',{style:1},{style:2});h.commit('Tile',{tiles:['a']},{tiles:['a','b']});
 await h.undo();assert.deepEqual(h.read('tiles',()=>[]),['a']);await h.undo();assert.equal(h.read('style',()=>0),1);
 await h.redo();assert.equal(h.read('style',()=>0),2);await h.redo();assert.deepEqual(h.read('tiles',()=>[]),['a','b']);
});
test('one pointer gesture merges slider ticks but separate gestures stay separate',async()=>{
 const h=new AppHistory();h.read('width',()=>200);h.beginGesture('drag1');for(const width of [210,220,240])h.commit('Width',{width:h.read('width',()=>0)},{width});h.endGesture();
 assert.equal(h.past.length,1);await h.undo();assert.equal(h.read('width',()=>0),200);await h.redo();assert.equal(h.read('width',()=>0),240);
 h.beginGesture('drag2');h.commit('Width',{width:240},{width:260});h.endGesture();assert.equal(h.past.length,2);
});
test('a new change clears redo; no-ops do not consume history',async()=>{
 const h=new AppHistory();h.commit('x',{x:0},{x:1});await h.undo();h.commit('x',{x:0},{x:2});assert.equal(h.redoLabel,null);h.commit('x',{x:2},{x:2});assert.equal(h.past.length,1);
});
test('asynchronous library commands retain their stack on failure and cannot run twice',async()=>{
 const h=new AppHistory();let calls=0,done:()=>void=()=>{},fail=true;h.onError=()=>{};
 h.record({label:'Library',undo:async()=>{calls++;await new Promise<void>(r=>done=r);if(fail)throw Error('offline');},redo:()=>{}});
 const first=h.undo();await h.undo();assert.equal(calls,1);done();await first;assert.equal(h.past.length,1);fail=false;const second=h.undo();done();await second;assert.equal(h.future.length,1);
});
test('native and local operations unwind chronologically',async()=>{
 const h=new AppHistory();let native=1;h.record({label:'Library',kind:'library',undo:()=>{native=0;},redo:()=>{native=1;}});h.commit('Home',{home:0},{home:1});
 await h.undo();assert.equal(native,1);await h.undo();assert.equal(native,0);await h.redo();await h.redo();assert.equal(native,1);assert.equal(h.read('home',()=>0),1);
});
test('older durable history redoes before the session settings undone before it',async()=>{
 const h=new AppHistory();let native=1;
 h.fallback={undoLabel:'Older library edit',undo:async()=>{native=0;h.fallback!.undoLabel=null;h.fallback!.redoLabel='Older library edit';},redo:async()=>{native=1;h.fallback!.undoLabel='Older library edit';h.fallback!.redoLabel=null;}};
 h.commit('Home',{home:0},{home:1});await h.undo();await h.undo();assert.equal(native,0);
 await h.redo();assert.equal(native,1);assert.equal(h.read('home',()=>-1),0);await h.redo();assert.equal(h.read('home',()=>-1),1);
});
test('a new preference edit does not expose an abandoned native redo branch',async()=>{
 const h=new AppHistory();let redos=0;h.fallback={redoLabel:'Abandoned library edit',undo:async()=>{},redo:async()=>{redos++;}};
 h.commit('Style',{style:0},{style:1});await h.undo();await h.redo();await h.redo();assert.equal(redos,0);assert.equal(h.redoLabel,null);
});
test('queued library changes cannot be overtaken by Undo and a failed save releases the queue',async()=>{
 const h=new AppHistory();let finish:()=>void=()=>{},undos=0;const order:string[]=[];
 h.record({label:'Earlier',undo:()=>{undos++;},redo:()=>{}});
 const first=h.perform(async()=>{order.push('start');await new Promise<void>(r=>finish=r);throw Error('save failed');});
 const second=h.perform(async()=>{order.push('second');return 42;});await Promise.resolve();const waitingUndo=h.undo();assert.equal(undos,0);finish();
 await assert.rejects(first);assert.equal(await second,42);assert.deepEqual(order,['start','second']);await waitingUndo;assert.equal(h.busy,false);assert.equal(undos,1);
});
test('Undo cancels a live gesture before touching the previous committed edit',async()=>{
 const h=new AppHistory();h.commit('Earlier',{size:1},{size:2});let cancelled=false;h.cancelGesture=()=>{cancelled=true;};await h.undo();assert.equal(cancelled,true);assert.equal(h.past.length,1);await h.undo();assert.equal(h.read('size',()=>0),1);
});

test('Undo requested while an archive is saving restores it after the save',async()=>{
 const h=new AppHistory();let finish:()=>void=()=>{},archived=false;
 const save=h.perform(async()=>{await new Promise<void>(resolve=>finish=resolve);archived=true;h.record({label:'Archive contact',kind:'library',undo:()=>{archived=false;},redo:()=>{archived=true;}});});
 await Promise.resolve();const undo=h.undo();finish();await save;await undo;assert.equal(archived,false);await h.redo();assert.equal(archived,true);
});
