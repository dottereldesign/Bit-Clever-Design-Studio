import {useEffect,useState} from 'react';
import {Plus,Trash2} from 'lucide-react';
import type {ProjectOverviewData} from './model';
import type {Change} from './api';
import './projectOverview.css';

function SavedField({value,label,multiline=false,type='text',save}:{value:string;label:string;multiline?:boolean;type?:string;save:(value:string)=>Promise<unknown>}) {
 const [draft,setDraft]=useState(value),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setDraft(value);setError('');},[value]);
 const commit=async()=>{if(busy||draft===value)return;setBusy(true);setError('');try{await save(draft);}catch{setError('Not saved. Try again.');}finally{setBusy(false);}};
 const props={value:draft,disabled:busy,'aria-label':label,onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setDraft(e.target.value),onBlur:()=>void commit()};
 return <div className="overview-field">{multiline?<textarea {...props} maxLength={20000} placeholder="What are we making, who is it for, and what does success look like?" rows={4}/>:<input {...props} type={type} maxLength={1000} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}}/>}{busy&&<small role="status">Saving…</small>}{error&&<small role="alert">{error} <button onClick={()=>void commit()}>Retry</button></small>}</div>;
}
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export default function ProjectOverview({project,data,mutate}:{project:number;data?:ProjectOverviewData;mutate:(change:Change)=>Promise<unknown>}) {
 const overview=data??{project_id:project,brief:'',status:'planned',deadline:'',actions:[]};
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[text,setText]=useState(''),[showCompleted,setShowCompleted]=useState(false);
 const save=(patch:Record<string,unknown>)=>mutate({action:'update_project_overview',target:project,value:JSON.stringify(patch)});
 const change=async(patch:Record<string,unknown>)=>{setBusy(true);setError('');try{await save(patch);return true;}catch(e){setError(String(e));return false;}finally{setBusy(false);}};
 const completed=overview.actions.filter(a=>a.done),active=overview.actions.filter(a=>!a.done);
 const overdue=overview.deadline&&overview.deadline<today()&&overview.status!=='complete';
 const action=(a:ProjectOverviewData['actions'][number])=><div className={`overview-action ${a.done?'done':''}`} key={a.id}>
  <input type="checkbox" aria-label={`Complete ${a.text}`} checked={a.done} disabled={busy} onChange={()=>void change({field:'action',id:a.id,done:!a.done})}/>
  <SavedField value={a.text} label={`Action: ${a.text}`} save={text=>save({field:'action',id:a.id,text})}/>
  <div className={!a.done&&a.deadline&&a.deadline<today()?'overdue':''}><SavedField type="date" label={`Due date: ${a.text}`} value={a.deadline} save={deadline=>save({field:'action',id:a.id,deadline})}/>{!a.done&&a.deadline&&a.deadline<today()&&<small>Overdue</small>}</div>
  <button className="overview-remove" aria-label={`Remove action: ${a.text}`} title="Remove action · Undo available" disabled={busy} onClick={()=>void change({field:'action',id:a.id,remove:true})}><Trash2 size={14}/></button>
 </div>;
 return <section className="project-overview" aria-label="Project overview">
  <div className="overview-heading"><h2>Overview</h2><span>Changes save when you leave a field</span></div>
  <div className="overview-meta"><label>Status<select aria-label="Project status" value={overview.status} disabled={busy} onChange={e=>void change({field:'status',value:e.target.value})}>{[['planned','Planned'],['active','In progress'],['waiting','Waiting on client'],['paused','On hold'],['complete','Complete']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <div className={overdue?'overdue':''}><span className="overview-label">Project deadline</span><SavedField type="date" label="Project deadline" value={overview.deadline} save={value=>save({field:'deadline',value})}/>{overdue&&<small>Overdue</small>}</div>
  </div>
  <div className="overview-content"><div className="overview-brief"><h3>Brief</h3><SavedField multiline label="Project brief" value={overview.brief} save={value=>save({field:'brief',value})}/></div>
   <div className="overview-actions"><h3>Next actions</h3>{active.map(action)}
    <form onSubmit={async e=>{e.preventDefault();if(!text.trim()||busy)return;if(await change({field:'action',id:crypto.randomUUID(),text:text.trim()}))setText('');}}><input aria-label="New action" placeholder="Add a next action…" maxLength={1000} value={text} disabled={busy} onChange={e=>setText(e.target.value)}/><button aria-label="Add action" disabled={busy||!text.trim()}><Plus size={17}/></button></form>
    {completed.length>0&&<><button className="overview-completed" aria-expanded={showCompleted} onClick={()=>setShowCompleted(!showCompleted)}>{showCompleted?'Hide':'Show'} completed ({completed.length})</button>{showCompleted&&completed.map(action)}</>}
   </div>
  </div>{error&&<p role="alert">{error}</p>}
 </section>;
}
