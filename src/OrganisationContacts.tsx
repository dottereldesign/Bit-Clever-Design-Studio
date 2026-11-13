import {useState} from 'react';
import {Plus} from 'lucide-react';
import AddContactDialog from './AddContactDialog';
import type {StudioEntry} from './studio';
import type {Change} from './api';

export default function OrganisationContacts({organisation,entries,mutate,open}:{organisation:StudioEntry;entries:StudioEntry[];mutate:(change:Change)=>Promise<unknown>;open:(id:string)=>void}) {
 const [adding,setAdding]=useState(false);
 const contacts=entries.filter(e=>e.kind==='contact'&&!e.archived&&(e.organization===organisation.id||organisation.contacts.includes(e.id))).sort((a,b)=>a.name.localeCompare(b.name));
 return <section className="organisation-contacts">
  <button className="studio-add-contact" onClick={()=>setAdding(true)}><Plus size={15}/>Add contact</button>
  {contacts.length?<table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Location</th></tr></thead><tbody>{contacts.map(contact=><tr key={contact.id}><td><button onClick={()=>open(contact.id)}>{contact.name}</button></td><td>{contact.email||'—'}</td><td>{contact.phone||'—'}</td><td>{contact.location||'—'}</td></tr>)}</tbody></table>:<p className="empty">No contacts linked to this organisation yet.</p>}
  {adding&&<AddContactDialog entries={entries} organisation={organisation.id} mutate={mutate} close={()=>setAdding(false)} added={()=>setAdding(false)}/>}
 </section>;
}
