import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultOverview,normalizeOverview,activeProjects,upcomingEvents,recordedRevenue} from './homeOverviewData';
import {blankEntry} from './studio';
import type {Library} from './model';
const empty=():Library=>({root:'test',items:[],projects:[],tags:[],sources:[],scanning:false});
test('Won business keeps currencies separate and uses close dates with a legacy fallback',()=>{
 const lib=empty(),stamp=new Date(2026,10,10).getTime()/1000;
 lib.studio=[{...blankEntry('lead','Won'),id:'one',status:'won',value:1200,currency:'NZD',created:1,closed_at:stamp},{...blankEntry('lead','Old'),id:'two',status:'won',value:300,currency:'NZD',created:stamp,archived:true},{...blankEntry('lead','USD'),id:'three',status:'won',value:800,currency:'USD',created:stamp},{...blankEntry('lead','Open'),id:'four',status:'proposal',value:900,currency:'NZD',created:stamp},{...blankEntry('client_entry','Paid quote'),id:'five',service:'quote',status:'paid',value:500,currency:'NZD'}];
 const result=recordedRevenue(lib,defaultOverview,new Date(2026,10,14));assert.equal(result.total,1500);assert.equal(result.count,2);assert.equal(result.otherCurrencies,1);assert.equal(result.legacy,1);assert.equal(result.months.at(-1)?.value,1500);
});
test('Upcoming meetings omit cancelled, archived, past and invalid entries and include project deadlines',()=>{
 const lib=empty();lib.projects=[{id:1,name:'Delivery',count:0}];lib.project_overviews=[{project_id:1,status:'active',brief:'',deadline:'2026-11-20',actions:[]}];
 lib.studio=[{...blankEntry('client_entry','Kickoff'),id:'one',service:'meeting',date:'2026-11-15',channel:'09:00'},{...blankEntry('client_entry','Cancelled'),id:'two',service:'meeting',date:'2026-11-16',status:'cancelled'},{...blankEntry('client_entry','Past'),id:'three',service:'meeting',date:'2026-11-14',channel:'08:00'},{...blankEntry('client_entry','Invalid'),id:'four',service:'meeting',date:'2026-11-31'},{...blankEntry('client_entry','Archived'),id:'five',service:'meeting',date:'2026-11-16',archived:true}];
 assert.deepEqual(upcomingEvents(lib,defaultOverview,new Date(2026,10,14,12)).map(e=>e.name),['Kickoff','Delivery']);
});
test('Active projects respect real status and default new projects to planned',()=>{
 const lib=empty();lib.projects=[{id:1,name:'Active',count:0},{id:2,name:'New',count:0},{id:3,name:'Finished',count:0}];lib.project_overviews=[{project_id:1,status:'active',brief:'',deadline:'',actions:[]},{project_id:3,status:'complete',brief:'',deadline:'',actions:[]}];
 assert.deepEqual(activeProjects(lib,defaultOverview).map(p=>p.name),['Active']);assert.equal(activeProjects(lib,{...defaultOverview,projectScope:'open'}).length,2);
});
test('Dashboard defaults to a half split and recovers from malformed preferences',()=>{assert.equal(normalizeOverview(null).share,50);assert.equal(normalizeOverview({share:999,currency:'bad currency',eventLimit:0}).share,70);assert.equal(normalizeOverview({currency:'bad currency'}).currency,'NZD');});
