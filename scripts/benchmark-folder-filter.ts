import { deepStrictEqual } from 'node:assert';
import { performance } from 'node:perf_hooks';
import { createMembershipIndex, filterItems, type Filters, type Item } from '../src/model';

// Synthetic references only; never reads the user's library or media.
const items: Item[] = Array.from({length:4000}, (_,id) => ({
  id, name:`Reference ${id}`, path:`C:/fixture/${id}.png`, kind:id%10===0?'link':'image',
  source:id%10===0?'Fonts':'Design/Captures', category:id%3===0?'Components / Headers':`Design ${id%30}`,
  component_folders:id%4===0?['Components / Pricing']:[], design_folders:id%7===0?['Illustration']:[],
  tags:[id%12], projects:[id%20], project_folders:id%2===0?[id%80]:[],
  added:id, modified:1, missing:false,
}));
const defaults: Filters = {search:'',type:'all',tags:[],source:'',project:null,linksOnly:false,sort:'recent',seed:123};
const start = performance.now(), index = createMembershipIndex(items), buildMs = performance.now()-start;
function measure(run:()=>unknown) {
  for(let i=0;i<30;i++)run();
  const timings = Array.from({length:200},()=>{const start=performance.now();run();return performance.now()-start;}).sort((a,b)=>a-b);
  return {medianMs:+timings[100].toFixed(3),p95Ms:+timings[190].toFixed(3)};
}
const cases: [string,Partial<Filters>][] = [['Design folder',{category:'Design 4'}],['Shared design folder',{category:'Illustration'}],
  ['Components',{category:'Components / Pricing'}],['All Components',{category:'All Components'}],
  ['All Designs',{designsOnly:true}],['Project folder',{project:4,projectFolder:4}],
  ['Project Unfiled',{project:4,projectFolder:'unfiled',projectFolderIds:[4,24,44,64]}]];
console.log(JSON.stringify({items:items.length,coldBuildMs:+buildMs.toFixed(3),rebuild:measure(()=>createMembershipIndex(items)),results:cases.map(([view,options])=>{
  const filters={...defaults,...options};
  const expected=filterItems(items,filters);
  deepStrictEqual(filterItems(items,filters,index),expected);
  return {view,matches:expected.length,scan:measure(()=>filterItems(items,filters)),indexed:measure(()=>filterItems(items,filters,index))};
})},null,2));
