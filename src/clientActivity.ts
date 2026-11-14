export type ClientEvent={key:string;entity:string;record:string;project:number|null;title:string;before:Record<string,any>|null;after:Record<string,any>|null;action:string;at:number;clients:string[]};
export type Activity={kind:'meeting'|'pricing'|'file'|'task'|'note'|'contact'|'client';label:string;title:string;task?:string;file?:number;removed?:boolean};
const taskValue=(t:any)=>t?JSON.stringify([t.text??'',t.deadline??'',!!t.done,t.priority||'normal',!!t.waiting,t.source_record??null]):null;
export function clientActivity(e:ClientEvent):Activity[]{
 const a=e.after,b=e.before,data=a??b??{};
 const verb=!b?'Added':!a?'Removed':a.archived&&!b.archived?'Archived':b.archived&&!a.archived?'Restored':'Updated';
 const prefix=e.action==='undo_organisation'?'Undid: ':e.action==='redo_organisation'?'Redid: ':'';
 const rows:Activity[]=[];
 if(a&&b){
  for(const field of ['actions','files']){
   const before=Array.isArray(b[field])?b[field]:[],after=Array.isArray(a[field])?a[field]:[];
   if(field==='actions'){
    const old=new Map(before.map(t=>[t.id,t]));const next=new Map(after.map(t=>[t.id,t]));
    for(const id of new Set([...next.keys(),...old.keys()])){const previous=old.get(id),current=next.get(id);if(taskValue(previous)===taskValue(current))continue;
     const action=!previous?'Added':!current?'Removed':current.done&&!previous.done?'Completed':previous.done&&!current.done?'Reopened':'Updated';
     rows.push({kind:'task',label:prefix+action+' a task',title:(current??previous).text,task:id,removed:!current});}
   }else{for(const id of new Set([...after,...before])){if(after.includes(id)===before.includes(id))continue;rows.push({kind:'file',label:prefix+(after.includes(id)?'Added a file':'Removed a file'),title:e.title,file:id,removed:!after.includes(id)});}}
  }
 }
 if(rows.length)return rows;
 if(a&&b&&!Object.keys({...b,...a}).some(k=>!['actions','files','updated','created'].includes(k)&&JSON.stringify(a[k])!==JSON.stringify(b[k])))return [];
 const service=data.service??data.kind;
 const kind:Activity['kind']=e.entity==='files'?'file':service==='meeting'?'meeting':service==='quote'?'pricing':e.entity==='client_contacts'||data.kind==='contact'?'contact':['client','organization'].includes(data.kind)?'client':'note';
 const noun=kind==='pricing'?'a quote':kind==='client'?'organisation details':kind==='note'&&e.entity==='project_overviews'?'project details':`a ${kind}`;
 return [{kind,label:prefix+verb+' '+noun,title:e.title,removed:!a,file:kind==='file'?Number(e.record):undefined}];
}

/** Fold task setup/edit bursts for display only; retain the full durable event log. */
export function compactClientActivity<T extends ClientEvent>(events:T[]){
 const rows:{event:T;item:Activity}[]=[],groups=new Map<string,{event:T;item:Activity}>();
 for(const event of [...events].sort((a,b)=>b.at-a.at))for(const item of clientActivity(event)){
  if(!item.task){rows.push({event,item});continue;}
  const key=JSON.stringify([event.entity,event.record,item.task]);
  const mergeable=event.action==='update_studio'||event.action==='update_project_overview';
  if(!mergeable||!['Added a task','Updated a task'].includes(item.label)){groups.delete(key);rows.push({event,item});continue;}
  const current=groups.get(key);
  if(current&&current.event.at-event.at<=300){
   if(item.label==='Added a task'){current.item={...current.item,label:'Added a task'};groups.delete(key);}
   continue;
  }
  const row={event,item};rows.push(row);
  if(item.label==='Updated a task')groups.set(key,row);else groups.delete(key);
 }
 return rows;
}
