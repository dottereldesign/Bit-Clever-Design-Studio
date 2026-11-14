import type {Library} from './model';
import type {StudioRoute} from './studio';

export type HomeOverviewPrefs={enabled:boolean;share:number;theme:'sage'|'blue'|'mono';events:boolean;projects:boolean;revenue:boolean;eventDays:number;eventLimit:number;deadlines:boolean;projectScope:'active'|'open'|'all';projectLimit:number;progress:boolean;currency:string;months:number;chart:'line'|'bars';showChart:boolean};
export const defaultOverview:HomeOverviewPrefs={enabled:true,share:50,theme:'sage',events:true,projects:true,revenue:true,eventDays:30,eventLimit:5,deadlines:true,projectScope:'active',projectLimit:5,progress:true,currency:'NZD',months:6,chart:'line',showChart:true};
export function normalizeOverview(value:unknown):HomeOverviewPrefs{
 const v=(value&&typeof value==='object'?value:{}) as Partial<HomeOverviewPrefs>;
 const number=(key:keyof HomeOverviewPrefs,min:number,max:number)=>typeof v[key]==='number'&&Number.isFinite(v[key])?Math.max(min,Math.min(max,Math.round(v[key] as number))):defaultOverview[key] as number;
 const bool=(key:keyof HomeOverviewPrefs)=>typeof v[key]==='boolean'?v[key] as boolean:defaultOverview[key] as boolean;
 return {enabled:bool('enabled'),share:number('share',30,70),theme:['sage','blue','mono'].includes(v.theme??'')?v.theme!:defaultOverview.theme,events:bool('events'),projects:bool('projects'),revenue:bool('revenue'),eventDays:number('eventDays',7,90),eventLimit:number('eventLimit',3,12),deadlines:bool('deadlines'),projectScope:['active','open','all'].includes(v.projectScope??'')?v.projectScope!:'active',projectLimit:number('projectLimit',3,12),progress:bool('progress'),currency:typeof v.currency==='string'&&/^[A-Z]{3}$/.test(v.currency)?v.currency:'NZD',months:[3,6,12].includes(v.months??0)?v.months!:6,chart:v.chart==='bars'?'bars':'line',showChart:bool('showChart')};
}
export const localDay=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function validDay(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00');return Number.isFinite(d.getTime())&&localDay(d)===value;}
export type HomeEvent={id:string;name:string;day:string;time:string;kind:string;project?:number;route?:StudioRoute};
export function upcomingEvents(lib:Library,p:HomeOverviewPrefs,now=new Date()){
 const today=localDay(now),end=new Date(now);end.setDate(end.getDate()+p.eventDays);const last=localDay(end);
 const rows:HomeEvent[]=[],entries=lib.studio??[],byId=new Map(entries.map(e=>[e.id,e]));
 for(const e of entries){
  if(e.archived||e.status==='cancelled'||e.meeting?.cancelled||e.parent&&byId.get(e.parent)?.archived)continue;
  if(!(e.kind==='meeting'||e.kind==='client_entry'&&e.service==='meeting'||e.kind==='activity'&&e.activity_type==='meeting'))continue;
  let day=e.date,time=/^\d{2}:\d{2}$/.test(e.channel)?e.channel:'';
  if(e.meeting){const start=new Date(e.meeting.start),finish=new Date(e.meeting.end||e.meeting.start);if(!Number.isFinite(start.getTime())||finish.getTime()<now.getTime())continue;day=localDay(start);time=start.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});}
  else if(time&&validDay(day)&&new Date(`${day}T${time}`).getTime()<now.getTime())continue;
  const parent=e.parent?byId.get(e.parent):undefined;
  const route:StudioRoute=e.kind==='client_entry'?{section:'clients',page:'today',id:e.parent??undefined,tab:'meetings'}:e.kind==='activity'&&parent?{section:parent.kind==='lead'?'leads':'marketing',page:parent.kind==='lead'?'pipeline':'campaigns',id:parent.id,tab:'activity'}:{section:'marketing',page:'calendar',id:e.id};
  rows.push({id:e.id,name:e.name,day,time,kind:'Meeting',route});
 }
 for(const r of lib.client_records?.records??[]){if(r.kind==='meeting'&&!r.archived&&lib.projects.some(p=>p.id===r.project_id))rows.push({id:`project-meeting:${r.project_id}:${r.id}`,name:r.title,day:r.date,time:'',kind:'Project meeting',project:r.project_id});}
 if(p.deadlines)for(const o of lib.project_overviews??[]){const project=lib.projects.find(p=>p.id===o.project_id);if(project&&o.status!=='complete'&&o.deadline)rows.push({id:`deadline:${o.project_id}`,name:project.name,day:o.deadline,time:'',kind:'Project deadline',project:o.project_id});}
 return rows.filter(e=>validDay(e.day)&&e.day>=today&&e.day<=last).sort((a,b)=>a.day.localeCompare(b.day)||(a.time||'00:00').localeCompare(b.time||'00:00')||a.name.localeCompare(b.name));
}
export function activeProjects(lib:Library,p:HomeOverviewPrefs){
 const overviews=new Map((lib.project_overviews??[]).map(o=>[o.project_id,o]));
 return lib.projects.map(project=>{const o=overviews.get(project.id),actions=o?.actions??[];return {...project,status:o?.status??'planned',deadline:o?.deadline??'',done:actions.filter(a=>a.done).length,total:actions.length};}).filter(o=>p.projectScope==='all'||(p.projectScope==='open'?o.status!=='complete':['active','waiting'].includes(o.status))).sort((a,b)=>(a.deadline||'9999').localeCompare(b.deadline||'9999')||a.name.localeCompare(b.name));
}
export function recordedRevenue(lib:Library,p:HomeOverviewPrefs,now=new Date()){
 const records=[...new Map((lib.studio??[]).filter(e=>e.kind==='lead'&&e.status==='won'&&typeof e.value==='number'&&Number.isFinite(e.value)).map(e=>[e.id,e])).values()];
 const matching=records.filter(e=>e.currency.trim().toUpperCase()===p.currency);
 const months=Array.from({length:p.months},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-p.months+1+i,1);return {key:localDay(d).slice(0,7),label:d.toLocaleDateString(undefined,{month:'short',year:'2-digit'}),value:0,count:0};});
 const recordDay=(e:typeof matching[number])=>{const stamp=e.closed_at??e.created;return stamp>0?localDay(new Date(stamp*1000)):'';};
 for(const e of matching){const day=recordDay(e);if(!validDay(day))continue;const bucket=months.find(m=>m.key===day.slice(0,7));if(bucket){bucket.value+=e.value!;bucket.count++;}}
 return {total:matching.reduce((sum,e)=>sum+e.value!,0),count:matching.length,months,undated:matching.filter(e=>!validDay(recordDay(e))).length,legacy:matching.filter(e=>!e.closed_at).length,otherCurrencies:records.length-matching.length};
}
