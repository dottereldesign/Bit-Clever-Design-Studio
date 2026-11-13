import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {StudioEntry} from './studio';

export default function ClientSidebar({clients,order,save,selected,open}:{clients:StudioEntry[];order:string[];save:(ids:string[])=>void;selected?:string;open:(id:string)=>void}){
 const ids=[...new Set([...order,...clients.map(c=>c.id)])].filter(id=>clients.some(c=>c.id===id));
 const root=useRef<HTMLDivElement>(null),cleanup=useRef(()=>{}),suppress=useRef(false);
 const [drag,setDrag]=useState<{id:string;name:string;x:number;y:number;line:number;left:number;width:number}|null>(null);
 const [message,setMessage]=useState('');
 useEffect(()=>()=>cleanup.current(),[]);
 const commit=(next:string[])=>{if(next.join('|')!==ids.join('|')){save(next);setMessage('Client order updated');}};
 return <><div ref={root} className="client-sidebar-list" onClickCapture={e=>{if(suppress.current){e.preventDefault();e.stopPropagation();}}}>
 {ids.map(id=>{const client=clients.find(c=>c.id===id)!;return <button key={id} data-client-id={id} className={`nav-item client-nav-item ${selected===id?'active':''} ${drag?.id===id?'sidebar-drag-source':''}`} title={`${client.name} · Drag to reorder, or Alt + ↑ / ↓`} onClick={()=>open(id)} onKeyDown={e=>{
  if(!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const index=ids.indexOf(id),to=index+(e.key==='ArrowUp'?-1:1);if(to<0||to>=ids.length)return;const next=[...ids];[next[index],next[to]]=[next[to],next[index]];commit(next);
 }} onPointerDown={e=>{
  if(e.button!==0)return;cleanup.current();const startX=e.clientX,startY=e.clientY,pointer=e.pointerId;let active=false,x=startX,y=startY,target=0,frame=0;
  const container=root.current!.closest<HTMLElement>('.sidebar-section-body')!;
  const update=()=>{const rows=Array.from(root.current!.querySelectorAll<HTMLElement>('[data-client-id]')).filter(r=>r.dataset.clientId!==id),box=container.getBoundingClientRect();target=rows.findIndex(r=>{const b=r.getBoundingClientRect();return y<b.top+b.height/2;});if(target<0)target=rows.length;const line=rows[target]?.getBoundingClientRect().top??rows.at(-1)?.getBoundingClientRect().bottom??root.current!.getBoundingClientRect().top;setDrag({id,name:client.name,x,y,line:Math.max(box.top,Math.min(box.bottom,line)),left:box.left+24,width:box.width-28});};
  const tick=()=>{const b=container.getBoundingClientRect();if(y<b.top+24)container.scrollTop-=5;else if(y>b.bottom-24)container.scrollTop+=5;update();frame=requestAnimationFrame(tick);};
  const move=(event:PointerEvent)=>{if(event.pointerId!==pointer)return;x=event.clientX;y=event.clientY;if(!active&&Math.hypot(x-startX,y-startY)<7)return;event.preventDefault();if(!active){active=true;suppress.current=true;document.body.classList.add('reordering-sidebar');frame=requestAnimationFrame(tick);}update();};
  const finish=(keep=false)=>{if(keep&&active){const b=root.current!.getBoundingClientRect(),viewport=container.getBoundingClientRect();if(x>=b.left&&x<=b.right&&y>=Math.max(b.top,viewport.top)&&y<=Math.min(b.bottom,viewport.bottom)){const next=ids.filter(v=>v!==id);next.splice(target,0,id);commit(next);}}cancelAnimationFrame(frame);setDrag(null);document.body.classList.remove('reordering-sidebar');window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key,true);window.removeEventListener('dragstart',native,true);setTimeout(()=>{suppress.current=false;},0);cleanup.current=()=>{};};
  const up=(event:PointerEvent)=>{if(event.pointerId===pointer)finish(true);},cancel=()=>finish(),key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish();}},native=(event:DragEvent)=>event.preventDefault();
  cleanup.current=cancel;window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',key,true);window.addEventListener('dragstart',native,true);
 }}><span>{client.name}</span></button>;})}</div><span className="sidebar-order-announcement" role="status">{message}</span>{drag&&createPortal(<div className="sidebar-order-overlay"><div className="sidebar-order-line" style={{top:drag.line,left:drag.left,width:drag.width}}/><div className="sidebar-order-ghost" style={{top:drag.y+14,left:drag.x+12}}>{drag.name}</div></div>,document.body)}</>;
}
