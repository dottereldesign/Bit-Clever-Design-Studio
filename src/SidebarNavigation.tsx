import { Children, cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useHistoryState } from './useAppHistory';

export default function SidebarNavigation({order,children}:{order:string[];children:ReactNode}){
 const arranged=order.filter(n=>n!=="Projects");
 arranged.splice(Math.max(0,arranged.indexOf("General")),0,"Projects");
 const defaults=["Marketing","Leads",...arranged.filter(n=>!["Marketing","Leads","Research"].includes(n))];
 defaults.splice(defaults.indexOf("Components")+1,0,"Research");
 const [saved,setSaved]=useHistoryState<string[]>('sidebar-section-order',()=>{try{const v=JSON.parse(localStorage.getItem('sidebar-section-order')??'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[];}catch{return [];}},'Sidebar section order');
 const nodes=Children.toArray(children);
 const names=nodes.flatMap(c=>isValidElement<{name?:string}>(c)&&c.props.name?[c.props.name]:[]);
 const fullOrder=[...new Set([...saved,...defaults,...names])].filter(n=>names.includes(n));
 const root=useRef<HTMLDivElement>(null), cleanup=useRef<()=>void>(()=>{}), suppressClick=useRef(false);
 const positions=useRef(new Map<string,number>());
 const [visual,setVisual]=useState<{name:string;label:string;x:number;y:number;line:number;left:number;width:number}|null>(null);
 const [announcement,setAnnouncement]=useState('');
 const sections=()=>Array.from(root.current?.querySelectorAll<HTMLElement>(':scope > [data-section]')??[]);
 const commit=(next:string[])=>{if(next.join('|')===fullOrder.join('|'))return;positions.current=new Map(sections().map(el=>[el.dataset.section!,el.getBoundingClientRect().top]));setSaved(next);setAnnouncement('Sidebar order updated');};
 useEffect(()=>()=>cleanup.current(),[]);
 useLayoutEffect(()=>{
  for(const el of sections()){const name=el.dataset.section!,top=el.getBoundingClientRect().top,previous=positions.current.get(name);
   if(previous!==undefined&&previous!==top&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&document.documentElement.dataset.motion!=='reduce')el.animate([{transform:`translateY(${previous-top}px)`},{transform:'translateY(0)'}],{duration:380,easing:'cubic-bezier(.32,0,.2,1)'});
  }positions.current.clear();
 },[fullOrder.join('|')]);
 return <><div ref={root} className="sidebar-scroll" data-reordering={visual?.name} onKeyDownCapture={e=>{if(!e.altKey||!["ArrowUp","ArrowDown"].includes(e.key))return;const section=(e.target as HTMLElement).closest<HTMLElement>("[data-section]");if(section?.parentElement!==root.current)return;e.preventDefault();e.stopPropagation();const index=fullOrder.indexOf(section!.dataset.section!),target=index+(e.key==="ArrowUp"?-1:1);if(target<0||target>=fullOrder.length)return;const next=[...fullOrder];[next[index],next[target]]=[next[target],next[index]];commit(next);}} onClickCapture={e=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false;}}} onPointerDownCapture={e=>{
  const toggle=(e.target as HTMLElement).closest<HTMLElement>('.section-toggle');
  const section=toggle?.closest<HTMLElement>('[data-section]');
  if(e.button!==0||!section||section.parentElement!==root.current)return;
  cleanup.current();
  const name=section.dataset.section!,label=toggle!.getAttribute('aria-label')??name,startX=e.clientX,startY=e.clientY;
  let active=false,x=startX,y=startY,target=fullOrder.indexOf(name),frame=0;
  const update=()=>{
   const box=root.current!.getBoundingClientRect(),others=sections().filter(s=>s!==section);
   target=others.findIndex(s=>{const r=s.getBoundingClientRect();return y<r.top+r.height/2;});if(target<0)target=others.length;
   const line=target<others.length?others[target].getBoundingClientRect().top:others.at(-1)?.getBoundingClientRect().bottom??box.top;
   setVisual({name,label,x:Math.max(box.left,Math.min(x,box.right-100)),y,line:Math.max(box.top,Math.min(line,box.bottom)),left:box.left+4,width:box.width-8});
  };
  const tick=()=>{const box=root.current!.getBoundingClientRect();if(y<box.top+40)root.current!.scrollTop-=10;else if(y>box.bottom-40)root.current!.scrollTop+=10;update();frame=requestAnimationFrame(tick);};
  const move=(event:PointerEvent)=>{if(event.pointerId!==e.pointerId)return;x=event.clientX;y=event.clientY;if(!active&&Math.hypot(x-startX,y-startY)<7)return;event.preventDefault();if(!active){active=true;suppressClick.current=true;document.body.classList.add('reordering-sidebar');section.classList.add('sidebar-drag-source');frame=requestAnimationFrame(tick);}update();};
  const finish=(save=false)=>{if(save&&active){const box=root.current!.getBoundingClientRect();if(x>=box.left&&x<=box.right&&y>=box.top&&y<=box.bottom){const next=fullOrder.filter(n=>n!==name);next.splice(target,0,name);commit(next);}}
   cancelAnimationFrame(frame);document.body.classList.remove('reordering-sidebar');section.classList.remove('sidebar-drag-source');setVisual(null);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key,true);window.removeEventListener('dragstart',native,true);setTimeout(()=>{suppressClick.current=false;},0);cleanup.current=()=>{};};
  const up=()=>finish(true),cancel=()=>finish(),key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish();}},native=(event:DragEvent)=>event.preventDefault();
  cleanup.current=cancel;window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',key,true);window.addEventListener('dragstart',native,true);
 }}>{nodes.sort((a,b)=>{const rank=(c:ReactNode)=>isValidElement<{name?:string}>(c)?fullOrder.indexOf(c.props.name??''):-1;return rank(a)-rank(b);}).map(c=>{
  if(!isValidElement<{name?:string;reorder?:{up?:()=>void;down?:()=>void}}>(c)||!c.props.name)return c;
  const index=fullOrder.indexOf(c.props.name),shift=(delta:number)=>{const next=[...fullOrder];[next[index],next[index+delta]]=[next[index+delta],next[index]];commit(next);};
  return cloneElement(c,{reorder:{up:index>0?()=>shift(-1):undefined,down:index<fullOrder.length-1?()=>shift(1):undefined}});
 })}</div><span className="sidebar-order-announcement" role="status">{announcement}</span>{visual&&createPortal(<div className="sidebar-order-overlay"><div className="sidebar-order-line" style={{top:visual.line,left:visual.left,width:visual.width}}/><div className="sidebar-order-ghost" style={{top:visual.y+14,left:visual.x}}>{visual.label}</div></div>,document.body)}</>;
}
