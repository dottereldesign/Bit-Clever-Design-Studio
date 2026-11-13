export type ClientEvent={key:string;entity:string;record:string;project:number|null;title:string;before:Record<string,any>|null;after:Record<string,any>|null;action:string;at:number;clients:string[]};
export type Activity={kind:'meeting'|'pricing'|'file'|'task'|'note'|'contact'|'client';label:string;title:string;task?:string;file?:number;removed?:boolean};
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
    for(const id of new Set([...next.keys(),...old.keys()])){const previous=old.get(id),current=next.get(id);if(JSON.stringify(previous)===JSON.stringify(current))continue;
     const action=!previous?'Added':!current?'Removed':current.done&&!previous.done?'Completed':previous.done&&!current.done?'Reopened':'Updated';
     rows.push({kind:'task',label:prefix+action+' a task',title:(current??previous).text,task:id,removed:!current});}
   }else{for(const id of new Set([...after,...before])){if(after.includes(id)===before.includes(id))continue;rows.push({kind:'file',label:prefix+(after.includes(id)?'Added a file':'Removed a file'),title:e.title,file:id,removed:!after.includes(id)});}}
  }
 }
 if(rows.length)return rows;
 const service=data.service??data.kind;
 const kind:Activity['kind']=e.entity==='files'?'file':service==='meeting'?'meeting':service==='quote'?'pricing':e.entity==='client_contacts'?'contact':data.kind==='client'?'client':'note';
 const noun=kind==='pricing'?'a quote':kind==='client'?'client details':kind==='note'&&e.entity==='project_overviews'?'project details':`a ${kind}`;
 return [{kind,label:prefix+verb+' '+noun,title:e.title,removed:!a,file:kind==='file'?Number(e.record):undefined}];
}
