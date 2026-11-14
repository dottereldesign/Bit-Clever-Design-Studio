import test from 'node:test';import assert from 'node:assert/strict';import {clientActivity,compactClientActivity,type ClientEvent} from './clientActivity';
const event=(before:any,after:any):ClientEvent=>({key:'1',entity:'studio',record:'r',project:null,title:'Review concepts',before,after,action:'update_studio',at:1,clients:['c']});
test('Meeting and pricing records have readable activity labels',()=>{assert.equal(clientActivity(event(null,{service:'meeting'}))[0].label,'Added a meeting');assert.equal(clientActivity(event({service:'quote',value:20},{service:'quote',value:30}))[0].label,'Updated a quote');});
test('Task changes identify the actual task instead of the client profile',()=>{const a={id:'task',text:'Send proposal',done:false};const row=clientActivity(event({actions:[a]},{actions:[{...a,done:true}]}))[0];assert.equal(row.label,'Completed a task');assert.equal(row.title,'Send proposal');assert.equal(row.task,'task');assert.equal(clientActivity(event({actions:[a]},{actions:[]}))[0].label,'Removed a task');});
test('File membership and undo keep their intent and destination',()=>{const e=event({files:[1]},{files:[1,2]});assert.equal(clientActivity(e)[0].file,2);e.action='undo_organisation';assert.equal(clientActivity(e)[0].label,'Undid: Added a file');});

test('Two tasks with deadlines, priorities and waiting toggles stay as two added rows',()=>{
 let actions:any[]=[];const events:ClientEvent[]=[];let at=100;
 const edit=(next:any[])=>{events.unshift({...event({actions},{actions:next}),at:at++,key:String(at)});actions=next;};
 edit([{id:'a',text:'Brand',done:false}]);edit([{...actions[0],deadline:'2026-11-24'}]);edit([...actions,{id:'b',text:'Website',done:false}]);edit(actions.map(t=>({...t,priority:'high'})));edit(actions.map(t=>t.id==='a'?{...t,waiting:true}:t));edit(actions.map(t=>({...t,waiting:false})));
 const rows=compactClientActivity(events);assert.equal(rows.length,2);assert.ok(rows.every(r=>r.item.label==='Added a task'));
 const later={...event({actions},{actions:actions.map(t=>t.id==='a'?{...t,deadline:'2026-12-01'}:t)}),at:1000};assert.equal(compactClientActivity([later,...events]).length,3);
});
test('Completion and undo remain separate from ordinary edits',()=>{
 const task={id:'a',text:'Brand',done:false};const added={...event({actions:[]},{actions:[task]}),at:100};const completed={...event({actions:[task]},{actions:[{...task,done:true}]}),at:110};assert.equal(compactClientActivity([completed,added]).length,2);
 const undo={...completed,action:'undo_organisation',at:120};assert.equal(compactClientActivity([undo,completed,added]).length,3);
});
test('Equivalent defaults and property order do not manufacture activity',()=>{assert.deepEqual(clientActivity(event({actions:[{id:'a',text:'Brand',done:false}]},{actions:[{done:false,text:'Brand',id:'a',priority:'normal',waiting:false,source_record:null}]})),[]);});
