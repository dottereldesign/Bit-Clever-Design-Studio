import { useState } from "react";
import { Folder, X } from "lucide-react";
import { categoryLabel, componentFoldersOf, designFoldersOf, type Item } from "./model";
import { isComponent, componentInbox } from "./componentsLibrary";

export default function CategoryPicker({categories,count,choose,close,componentItems=[],toggleComponent}: {componentItems?:Item[];toggleComponent?:(name:string,remove:boolean)=>Promise<void>;categories:string[];count:number;choose:(name:string)=>Promise<void>;close:()=>void}) {
  const [query,setQuery]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const commit=async(name:string)=>{if(busy)return;setBusy(true);setError("");try{await choose(name);}catch(e){setError(String(e));setBusy(false);}};
  const toggle=async(name:string,remove:boolean)=>{if(busy||!toggleComponent)return;setBusy(true);setError("");try{await toggleComponent(name,remove);}catch(e){setError(String(e));}finally{setBusy(false);}};
  const shown=categories.filter(c=>categoryLabel(c).toLocaleLowerCase().includes(query.trim().replace(/_/g," ").toLocaleLowerCase()));
  const isNew=!!query.trim()&&!categories.some(c=>categoryLabel(c).replace(/^Components \/ /, "").toLocaleLowerCase()===categoryLabel(query).toLocaleLowerCase());
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)close();}}><div className="modal category-picker" role="dialog" aria-modal="true" aria-label={count?"Change category":"New category"} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'&&!busy)close();}}>
    <div className="modal-heading"><h2>{count?`Organise folders · ${count}`:"New category"}</h2><button className="icon-button" aria-label="Close category picker" disabled={busy} onClick={close}><X size={17}/></button></div>
    <form onSubmit={e=>{e.preventDefault();const name=isNew?query.trim():count?shown[0]:undefined;if(name)void commit(name);}}>
      <input autoFocus aria-label="Find or create category" placeholder={count?"Find a folder or create a category…":"Category name"} maxLength={100} value={query} disabled={busy} onChange={e=>setQuery(e.target.value)}/>
      {count>0&&toggleComponent&&<><p>Add to several folders. Removing the last folder returns an item to Uncategorised.</p>{[false,true].map(component=><section key={String(component)}><h3>{component?'App Components':'Design Inspo'}</h3><div className="category-choices">{shown.filter(n=>!!n&&isComponent(n)===component&&n!==componentInbox).map(name=>{
        const assigned=componentItems.filter(i=>(component?componentFoldersOf(i):designFoldersOf(i)).includes(name)).length;
        const all=assigned===count;
        return <button type="button" role="checkbox" aria-checked={all?true:assigned?'mixed':false} disabled={busy} key={name} onClick={()=>void toggle(name,all)}><span aria-hidden="true">{all?'☑':assigned?'⊟':'☐'}</span>{categoryLabel(name).replace(/^Components \/ /,'')}{assigned>0&&count>1&&<small>{assigned}/{count}</small>}</button>;
      })}</div><button type="button" disabled={busy} onClick={()=>void commit(component?componentInbox:'')}>Move to {component?'App Components':'Design Inspo'} / Uncategorised</button></section>)}<p>Moving between Design Inspo and App Components clears the previous section’s folders.</p><button type="button" disabled={busy} onClick={close}>Done</button></>}
      {count>0&&!toggleComponent&&<div className="category-choices">{shown.map(name=><button type="button" disabled={busy} key={name} onClick={()=>void commit(name)}><Folder size={14}/>{categoryLabel(name)}</button>)}<button type="button" disabled={busy} onClick={()=>void commit('')}>Uncategorised</button></div>}
      {isNew&&<button className="primary" disabled={busy}>{count?`Create “${query.trim()}” & add`:`Create “${query.trim()}”`}</button>}
      {error&&<div className="form-error" role="alert">{error}</div>}
    </form>
  </div></div>;
}
