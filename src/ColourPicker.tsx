import {useEffect,useRef,useState} from 'react';
import {Pipette,X,Copy} from 'lucide-react';
import {invoke} from '@tauri-apps/api/core';
import {useHistoryState} from './useAppHistory';
import type {Label} from './model';
type Colour={hex:string;projects:string[]};
type EyeDropperConstructor=new()=>{open:()=>Promise<{sRGBHex:string}>};
const readColours=():Colour[]=>{try{const rows=JSON.parse(localStorage.getItem('colour-history')??'[]');return Array.isArray(rows)?rows.filter(c=>c&&/^#[0-9A-F]{6}$/i.test(c.hex)&&Array.isArray(c.projects)):[];}catch{return [];}};
const useColours=()=>useHistoryState<Colour[]>('colour-history',readColours,'Colour collection');

export function ProjectColours({project}:{project:number}){
 const [colours]=useColours();
 const [message,setMessage]=useState('');
 useEffect(()=>{setMessage('');},[project]);
 useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),3500);return()=>clearTimeout(timer);},[message]);
 const saved=colours.filter(c=>c.projects.includes(`project:${project}`));
 if(!saved.length)return null;
 const copy=async(hex:string)=>{try{await invoke('copy_colour',{hex});setMessage(`${hex} copied`);}catch{setMessage('Clipboard unavailable. Click a colour to retry.');}};
 return <section className="project-colours" aria-label="Project colours">
  <span className="project-colours-label">Colours</span>
  <div className="project-colour-list">{saved.map(c=><button key={c.hex} className="project-colour" title={`Copy ${c.hex}`} aria-label={`Copy ${c.hex}`} onClick={()=>void copy(c.hex)}><span style={{background:c.hex}} aria-hidden="true"/><code>{c.hex}</code></button>)}</div>
  <span className="project-colour-status" role="status">{message}</span>
 </section>;
}

export default function ColourPicker({projects}:{projects:Label[]}){
 const [colours,setColours]=useColours();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[selected,setSelected]=useState(''),[filter,setFilter]=useState(''),[message,setMessage]=useState('');
 const root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),running=useRef(false);
 useEffect(()=>{if(!open)return;root.current?.querySelector('select')?.focus();const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',outside,true);return()=>document.removeEventListener('pointerdown',outside,true);},[open]);
 useEffect(()=>{if(!message)return;const t=setTimeout(()=>setMessage(''),3500);return()=>clearTimeout(t);},[message]);
 const copy=async(hex:string)=>{try{await invoke('copy_colour',{hex});setMessage(`${hex} copied`);}catch{setMessage(`${hex} saved. Clipboard unavailable; try Copy again.`);}};
 const pick=async()=>{
  if(running.current)return;running.current=true;setBusy(true);setOpen(false);setMessage('');
  try{
   const EyeDropper=(window as unknown as {EyeDropper?:EyeDropperConstructor}).EyeDropper;
   let value:string|null;
   if(EyeDropper){try{value=(await new EyeDropper().open()).sRGBHex;}catch(e){if((e as {name?:string}).name!=='NotSupportedError')throw e;value=await invoke<string|null>('pick_colour');}}else value=await invoke<string|null>('pick_colour');
   if(!value)return;const hex=value.toUpperCase();if(!/^#[0-9A-F]{6}$/.test(hex))throw Error('Invalid colour returned');
   setColours(old=>[{hex,projects:old.find(c=>c.hex===hex)?.projects??[]},...old.filter(c=>c.hex!==hex)].filter((c,i)=>i<100||c.projects.length>0));setSelected(hex);await copy(hex);
  }catch(e){if((e as {name?:string}).name!=='AbortError')setMessage(String(e));}
  finally{running.current=false;setBusy(false);button.current?.focus();}
 };
 const visible=colours.filter(c=>!filter||c.projects.includes(filter));
 const chosen=visible.find(c=>c.hex===selected)??visible[0];
 return <div ref={root} className="colour-tool">
  <button ref={button} className="icon-button" aria-label="Pick a colour" title="Pick a colour · Right-click for history and projects" disabled={busy} onClick={()=>void pick()} onContextMenu={e=>{e.preventDefault();e.stopPropagation();setOpen(v=>!v);}} onKeyDown={e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();e.stopPropagation();setOpen(true);}}}><Pipette size={18}/></button>
  {message&&!open&&<span className="colour-message" role="status">{message}</span>}
  {open&&<div className="colour-panel" role="dialog" aria-label="Colour history" onContextMenu={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){setOpen(false);button.current?.focus();}}}>
   <header><strong>Colours</strong><button className="icon-button" aria-label="Close colour history" onClick={()=>setOpen(false)}><X size={15}/></button></header>
   <select aria-label="Filter colours by project" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All colours</option>{projects.map(p=><option key={p.id} value={`project:${p.id}`}>{p.name}</option>)}</select>
   {!colours.length?<p>Pick a colour anywhere on screen. Its hex code is copied automatically.</p>:<>
    <div className="colour-swatches">{visible.map(c=><button key={c.hex} aria-label={`Select ${c.hex}`} aria-pressed={chosen?.hex===c.hex} title={c.hex} style={{background:c.hex}} onClick={()=>setSelected(c.hex)}/>)}</div>
    {chosen&&<><div className="colour-value"><code>{chosen.hex}</code><button className="subtle-button" onClick={()=>void copy(chosen.hex)}><Copy size={13}/> Copy</button></div><strong className="colour-project-label">Projects</strong><div className="colour-projects">{projects.length?projects.map(p=>{const key=`project:${p.id}`,checked=chosen.projects.includes(key);return <label key={key}><input type="checkbox" checked={checked} onChange={()=>setColours(old=>old.map(c=>c.hex!==chosen.hex?c:{...c,projects:checked?c.projects.filter(id=>id!==key):[...c.projects,key]}))}/>{p.name}</label>;}):<p>Create a project to save colours to it.</p>}</div></>}
   </>}
   {message&&<p role="status">{message}</p>}
  </div>}
 </div>;
}
