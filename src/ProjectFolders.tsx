import { useEffect, useMemo, useState, useRef, type ReactNode, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Folder, MoreHorizontal, X } from 'lucide-react';
import type { Item, Label, ProjectFolder } from './model';
import './projectFolders.css';

export type FolderScope = number | 'unfiled' | null;
type Change = { action:string; target?:number; ids?:number[]; name?:string; value?:string };
function useFolderDialogFocus(open:boolean){
  useEffect(()=>{if(!open)return;const previous=document.activeElement as HTMLElement;
    const key=(e:KeyboardEvent)=>{if(e.key!=='Tab')return;const controls=[...document.querySelectorAll<HTMLElement>('.project-folder-dialog button:not(:disabled),.project-folder-dialog input:not(:disabled),.project-folder-dialog select:not(:disabled)')];const first=controls[0],last=controls.at(-1);if(!first)return;
      if(e.shiftKey&&(document.activeElement===first||!controls.includes(document.activeElement as HTMLElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!controls.includes(document.activeElement as HTMLElement))){e.preventDefault();first.focus();}};
    document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('keydown',key,true);if(previous?.isConnected)previous.focus();};
  },[open]);
}
const descendant=(folder:ProjectFolder,parent:number|null,folders:ProjectFolder[])=>{let next=folder.parent_id;const seen=new Set<number>();while(next!==null&&!seen.has(next)){if(next===parent)return true;seen.add(next);next=folders.find(f=>f.id===next)?.parent_id??null;}return false;};
type Mutate = (change:Change)=>Promise<unknown>;
export const orderedFolders=(folders:ProjectFolder[])=>[...folders].sort((a,b)=>(a.position??Infinity)-(b.position??Infinity)||a.name.localeCompare(b.name));
export function folderPath(folder:ProjectFolder,folders:ProjectFolder[]):string {
  const names=[folder.name], seen=new Set([folder.id]);let parent=folder.parent_id;
  while(parent){const p=folders.find(f=>f.id===parent);if(!p||seen.has(p.id))break;seen.add(p.id);names.unshift(p.name);parent=p.parent_id;}
  return names.join(' / ');
}
export function ProjectTree({project,folders,items,active,scope,open,mutate,report,rename,remove,icon,externalDrop,homeProps,paste}: {
  paste:(folder:number|null)=>void;
  project:Label;folders:ProjectFolder[];items:Item[];active:boolean;scope:FolderScope;
  open:(scope:FolderScope)=>void;mutate:Mutate;report:(error:unknown)=>void;rename:()=>void;remove:()=>void;icon:ReactNode;
  homeProps?:HTMLAttributes<HTMLButtonElement>;
  externalDrop:(data:DataTransfer,folder:number|null)=>void;
}) {
  const [expanded,setExpanded]=useState(false),[closed,setClosed]=useState<Set<number>>(new Set());
  const [menu,setMenu]=useState<{id:number|null;x:number;y:number}|null>(null);
  const [dialog,setDialog]=useState<{action:'create'|'rename'|'move'|'delete';id:number|null}|null>(null);
  const [name,setName]=useState(''),[parent,setParent]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useFolderDialogFocus(dialog!==null);
  const tree=useRef<HTMLDivElement>(null);
  useEffect(()=>{const context=(event:Event)=>{const detail=(event as CustomEvent<{project:number;id:number;x:number;y:number}>).detail;if(detail.project===project.id)setMenu({id:detail.id,x:Math.min(detail.x,window.innerWidth-210),y:Math.min(detail.y,window.innerHeight-220)});};window.addEventListener('project-folder-context',context);return()=>window.removeEventListener('project-folder-context',context);},[project.id]);
  useEffect(()=>{if(!active||!expanded||typeof scope!=='number')return;let second=0;const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{const row=tree.current?.querySelector<HTMLElement>(`[data-project-folder-id="${scope}"]`),body=tree.current?.closest<HTMLElement>('.sidebar-section-body');if(!row||!body)return;const rect=row.getBoundingClientRect(),bounds=body.getBoundingClientRect();if(rect.bottom>bounds.bottom)body.scrollTop+=rect.bottom-bounds.bottom+4;else if(rect.top<bounds.top)body.scrollTop+=rect.top-bounds.top-4;});});return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};},[active,scope,expanded,folders]);
  const own=useMemo(()=>folders.filter(f=>f.project_id===project.id),[folders,project.id]);
  const counts=useMemo(()=>{const ownIds=new Set(own.map(f=>f.id)),byFolder=new Map<number,number>();let unfiled=0;for(const item of items){for(const id of item.project_folders??[])byFolder.set(id,(byFolder.get(id)??0)+1);if(item.projects.includes(project.id)&&!item.project_folders?.some(id=>ownIds.has(id)))unfiled++;}return {byFolder,unfiled};},[items,own,project.id]);
  useEffect(()=>{if(active)setExpanded(true);},[active]);
  useEffect(()=>{if(!menu&&!dialog)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMenu(null);if(!busy)setDialog(null);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[menu,dialog,busy]);
  const edit=(action:'create'|'rename'|'move'|'delete',id:number|null)=>{const f=own.find(f=>f.id===id);setDialog({action,id});setName(action==='rename'?f?.name??'':'');setParent(action==='create'?String(id??''):String(f?.parent_id??''));setError('');setMenu(null);};
  const context=(e:React.MouseEvent,id:number|null)=>{e.preventDefault();e.stopPropagation();setMenu({id,x:Math.min(e.clientX,window.innerWidth-210),y:Math.min(e.clientY,window.innerHeight-230)});};
  const dragProps=(id:number|'unfiled'|null)=>({
    onDragOver:(e:React.DragEvent)=>{if(e.dataTransfer.types.some(t=>['application/design-items','application/project-folder','Files','text/uri-list','text/html'].includes(t))){e.preventDefault();e.stopPropagation();e.currentTarget.classList.add('drop-target');}},
    onDragLeave:(e:React.DragEvent)=>e.currentTarget.classList.remove('drop-target'),
    onDrop:(e:React.DragEvent)=>{e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('drop-target');
      const data=e.dataTransfer.getData('application/design-items'),from=e.dataTransfer.getData('application/project-folder');
      try{if(data){const ids:unknown=JSON.parse(data);if(!Array.isArray(ids)||!ids.every(Number.isInteger))return;void mutate({action:id==='unfiled'?'unfile_project_folder':id===null?'add_project':'add_project_folder',target:typeof id==='number'?id:project.id,ids}).catch(report);}
        else if(from){if(id==='unfiled')return;const source=own.find(f=>f.id===Number(from)),target=own.find(f=>f.id===id);if(!source||source.id===id)return;
          if(target&&source.parent_id===target.parent_id){const siblings=orderedFolders(own.filter(f=>f.parent_id===target.parent_id)).map(f=>f.id).filter(i=>i!==source.id);const after=e.clientY>e.currentTarget.getBoundingClientRect().top+e.currentTarget.getBoundingClientRect().height/2;siblings.splice(siblings.indexOf(target.id)+(after?1:0),0,source.id);void mutate({action:'reorder_project_folders',ids:siblings}).catch(report);}
          else void mutate({action:'move_project_folder',target:source.id,value:String(id??'')}).catch(report);
        }else externalDrop(e.dataTransfer,typeof id==='number'?id:null);
      }catch(error){report(error);}
    }
  });
  const row=(f:ProjectFolder,depth:number):ReactNode=><div key={f.id}>
    <div className={`project-folder-row ${active&&scope===f.id?'active':''}`} style={{paddingLeft:12+depth*12}} data-project-folder-target={f.id} data-project-folder-name={f.name} {...dragProps(f.id)} onContextMenu={e=>context(e,f.id)}>
      <button className="folder-chevron" aria-expanded={!closed.has(f.id)} aria-label={`${closed.has(f.id)?'Expand':'Collapse'} ${f.name}`} onClick={()=>setClosed(prev=>{const next=new Set(prev);next.has(f.id)?next.delete(f.id):next.add(f.id);return next;})} style={{visibility:own.some(p=>p.parent_id===f.id)?'visible':'hidden'}}><ChevronRight size={12} style={{transform:closed.has(f.id)?undefined:'rotate(90deg)'}}/></button>
      <button className="nav-item" title={folderPath(f,folders)} data-project-folder-id={f.id} draggable onDragStart={e=>{e.stopPropagation();e.dataTransfer.setData('application/project-folder',String(f.id));e.dataTransfer.effectAllowed='move';}} onClick={()=>open(f.id)}><Folder size={14}/><span>{f.name}</span><small>{counts.byFolder.get(f.id)||''}</small></button>
      <button className="folder-more" aria-label={`Options for ${f.name}`} onClick={e=>context(e,f.id)}><MoreHorizontal size={13}/></button>
    </div>
    {!closed.has(f.id)&&orderedFolders(own.filter(p=>p.parent_id===f.id)).map(child=>row(child,depth+1))}
  </div>;
  return <div className="project-tree" ref={tree}>
    <div className={`project-row ${active&&scope===null?'active':''}`} data-project-id={project.id} data-project-name={project.name} {...dragProps(null)} onContextMenu={e=>context(e,null)}>
      <button className="folder-chevron" aria-expanded={expanded} aria-label={`${expanded?'Collapse':'Expand'} ${project.name}`} onClick={()=>setExpanded(!expanded)}><ChevronRight size={12} style={{transform:expanded?'rotate(90deg)':undefined}}/></button>
      <button className="nav-item" {...homeProps} onClick={()=>open(null)}>{icon}<span>{project.name}</span><small>{project.count||''}</small></button>
      <button className="folder-more" aria-label={`Options for ${project.name}`} onClick={e=>context(e,null)}><MoreHorizontal size={15}/></button>
    </div>
    {expanded&&<div className="project-folder-list">
      <button className={`nav-item project-scope ${active&&scope==='unfiled'?'active':''}`} data-project-unfiled={project.id} {...dragProps('unfiled')} onClick={()=>open('unfiled')}>Unfiled<small>{counts.unfiled||''}</small></button>
      {orderedFolders(own.filter(f=>f.parent_id===null)).map(f=>row(f,0))}
    </div>}
    {menu&&createPortal(<><div className="project-menu-dismiss" onClick={()=>setMenu(null)}/><div className="project-folder-menu" style={{left:menu.x,top:menu.y}} role="menu">
      <button onClick={()=>{paste(menu.id);setMenu(null);}}>Paste here</button>
      <button onClick={()=>edit('create',menu.id)}>New folder</button>
      <button onClick={()=>{if(menu.id===null){setMenu(null);rename();}else edit('rename',menu.id);}}>Rename</button>
      {menu.id!==null&&<button onClick={()=>edit('move',menu.id)}>Move folder…</button>}
      <button className="danger" onClick={()=>{if(menu.id===null){setMenu(null);remove();}else edit('delete',menu.id);}}>Delete {menu.id===null?'project':'folder'}…</button>
    </div></>,document.body)}
    {dialog&&createPortal(<div className="project-dialog-backdrop"><form className="project-folder-dialog" role="dialog" aria-modal="true" aria-label={`${dialog.action} folder`} onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await mutate({action:`${dialog.action}_project_folder`,target:dialog.action==='create'?project.id:dialog.id!,name,value:parent});setDialog(null);setExpanded(true);}catch(error){setError(String(error));}finally{setBusy(false);}}}>
      <div className="project-dialog-heading"><h2>{dialog.action==='create'?'New folder':dialog.action==='rename'?'Rename folder':dialog.action==='move'?'Move folder':'Delete folder?'}</h2><button autoFocus={dialog.action==='delete'} type="button" aria-label="Close" disabled={busy} onClick={()=>setDialog(null)}><X size={18}/></button></div>
      {(dialog.action==='create'||dialog.action==='rename')&&<label>Name<input autoFocus required maxLength={300} value={name} onChange={e=>setName(e.target.value)}/></label>}
      {dialog.action==='move'&&<label>Move into<select autoFocus value={parent} onChange={e=>setParent(e.target.value)}><option value="">{project.name}</option>{own.filter(f=>f.id!==dialog.id&&!descendant(f,dialog.id,own)).map(f=><option key={f.id} value={f.id}>{folderPath(f,own)}</option>)}</select></label>}
      {dialog.action==='delete'&&<p>This removes the folder and its subfolders. All references stay in {project.name} and your library.</p>}
      {error&&<p role="alert" className="danger">{error}</p>}<button className="primary" disabled={busy}>{busy?'Saving…':dialog.action==='delete'?'Delete folder':'Save'}</button>
    </form></div>,document.body)}
  </div>;
}
export function OrganiseProjectFolders({folders,projects,items,mutate,close}: {folders:ProjectFolder[];projects:Label[];items:Item[];mutate:Mutate;close:()=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useFolderDialogFocus(true);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy){e.stopPropagation();close();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[busy,close]);
  return createPortal(<div className="project-dialog-backdrop"><section className="project-folder-dialog" role="dialog" aria-modal="true" aria-label="Organise project folders"><div className="project-dialog-heading"><h2>Project folders</h2><button autoFocus aria-label="Close" onClick={close}><X size={18}/></button></div>
    <p>{items.length} selected · Changes save immediately.</p>
    <div className="project-membership-list">{projects.map(p=><div key={p.id}><strong>{p.name}</strong>{orderedFolders(folders.filter(f=>f.project_id===p.id)).map(f=>{const count=items.filter(i=>i.project_folders?.includes(f.id)).length;return <label key={f.id}><input type="checkbox" checked={count===items.length&&count>0} ref={el=>{if(el)el.indeterminate=count>0&&count<items.length;}} disabled={busy} onChange={async()=>{setBusy(true);setError('');try{await mutate({action:count===items.length?'remove_project_folder':'add_project_folder',target:f.id,ids:items.map(i=>i.id)});}catch(e){setError(String(e));}finally{setBusy(false);}}}/>{folderPath(f,folders)}</label>;})}</div>)}</div>
    {!folders.length&&<p>Create a folder from a project's menu in the sidebar.</p>}{error&&<p role="alert" className="danger">{error}</p>}
  </section></div>,document.body);
}
