import {isOrganisation} from './studio';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import type {StudioEntry} from './studio';
import {blankEntry} from './studio';
import type {Change} from './api';
import {recordError} from './diagnostics';

export default function AddContactDialog({entries,mutate,close,added}:{entries:StudioEntry[];mutate:(change:Change)=>Promise<unknown>;close:()=>void;added:(id:string)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),saving=useRef(false),contactId=useRef(crypto.randomUUID()),createdOrg=useRef<{name:string;id:string}|null>(null);
 const [first,setFirst]=useState(''),[last,setLast]=useState(''),[org,setOrg]=useState(''),[orgChoice,setOrgChoice]=useState(''),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const element=dialog.current!;element.showModal();element.querySelector<HTMLInputElement>('input')?.focus();return()=>element.close();},[]);
 const save=async(event:React.FormEvent<HTMLFormElement>)=>{
  event.preventDefault();if(saving.current)return;
  if(!first.trim()||!orgChoice||(orgChoice==='__new__'&&!org.trim())||!email.trim()){setError('Enter a first name, organisation and email.');return;}
  saving.current=true;setBusy(true);setError('');
  try{
   const normalized=org.trim().toLocaleLowerCase();
   const matches=entries.filter(e=>isOrganisation(e)&&!e.archived&&e.name.trim().toLocaleLowerCase()===normalized);
   if(orgChoice==='__new__'&&matches.length>1)throw Error('More than one organisation has this name. Rename the duplicate organisation before adding this contact.');
   let organization=orgChoice==='__new__'?(matches[0]?.id??(createdOrg.current?.name===normalized?createdOrg.current.id:undefined)):entries.find(e=>e.id===orgChoice&&isOrganisation(e)&&!e.archived)?.id;
   if(orgChoice!=='__new__'&&!organization)throw Error('Choose an available organisation.');
   if(!organization){const entry=blankEntry('client',org.trim());const {id,created,updated,...patch}=entry;await mutate({action:'update_studio',value:JSON.stringify({id,patch:{...patch,status:"active"}})});createdOrg.current={name:normalized,id};organization=id;}
   const {id:unused,created,updated,...patch}=blankEntry('contact',[first.trim(),last.trim()].filter(Boolean).join(' '));
   await mutate({action:'update_studio',value:JSON.stringify({id:contactId.current,patch:{...patch,organization,phone:phone.trim(),email:email.trim()}})});
   added(contactId.current);
  }catch(e){recordError('studio.contact.create',e);setError(String(e));}finally{saving.current=false;setBusy(false);}
 };
 return createPortal(<dialog ref={dialog} className="add-contact-dialog" aria-labelledby="add-contact-title" onCancel={e=>{e.preventDefault();if(!saving.current)close();}} onKeyDown={e=>e.stopPropagation()}>
 <form onSubmit={save}><header><h2 id="add-contact-title">Add contact</h2><button type="button" aria-label="Close add contact" disabled={busy} onClick={close}><X size={18}/></button></header>
 <div className="add-contact-fields">
 <label>First name<input autoFocus required maxLength={140} autoComplete="given-name" value={first} onChange={e=>setFirst(e.target.value)} disabled={busy}/></label>
 <label>Last name <span>(optional)</span><input maxLength={140} autoComplete="family-name" value={last} onChange={e=>setLast(e.target.value)} disabled={busy}/></label>
 <label className="wide">Organisation<select required aria-label="Organisation" value={orgChoice} onChange={e=>setOrgChoice(e.target.value)} disabled={busy}><option value="">Choose organisation</option>{entries.filter(e=>isOrganisation(e)&&!e.archived).sort((a,b)=>a.name.localeCompare(b.name)).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}<option value="__new__">Add new organisation…</option></select></label>
 {orgChoice==='__new__'&&<label className="wide">New organisation<input autoFocus required aria-label="New organisation" maxLength={300} autoComplete="organization" value={org} onChange={e=>setOrg(e.target.value)} disabled={busy}/></label>}
 <label className="wide">Email<input required type="email" maxLength={500} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>
 <label className="wide">Phone number <span>(optional)</span><input type="tel" maxLength={100} autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} disabled={busy}/></label>
 </div>{error&&<p role="alert">{error}</p>}<footer><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="studio-add-contact" disabled={busy}>{busy?'Saving…':'Save contact'}</button></footer></form></dialog>,document.body);
}
