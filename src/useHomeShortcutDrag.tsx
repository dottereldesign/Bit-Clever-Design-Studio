import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { homeMime } from "./HomeDashboard";

// Pointer-based sidebar dragging also works when switching the main view to Home.
export default function useHomeShortcutDrag(start:()=>void,drop:(id:string)=>void,reorder?:(id:string,target:string,after:boolean)=>void){
  const latest=useRef({start,drop,reorder});latest.current={start,drop,reorder};
  const cleanup=useRef<()=>void>(()=>{}),suppress=useRef(false),timer=useRef(0);
  const [ghost,setGhost]=useState<{label:string;x:number;y:number}|null>(null);
  useEffect(()=>()=>{cleanup.current();clearTimeout(timer.current);},[]);
  const pointerDown=(event:ReactPointerEvent,id:string,label:string)=>{
    if(event.button!==0||event.isPrimary===false||(event.target as HTMLElement).closest('.icon-button'))return;
    event.stopPropagation();cleanup.current();const x=event.clientX,y=event.clientY,pointerId=event.pointerId;let active=false,opened=false,activeSince=0;const sortable=!!document.querySelector('[data-folder-order]')&&id.startsWith('category:')&&id!=='category:All Components';
    const clear=()=>{document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',cancel,true);document.removeEventListener('keydown',key,true);document.querySelectorAll('[data-reorder-edge]').forEach(n=>n.removeAttribute('data-reorder-edge'));setGhost(null);};
    const move=(e:PointerEvent)=>{if(e.pointerId!==pointerId)return;if(!active&&Math.hypot(e.clientX-x,e.clientY-y)<7)return;if(!active){active=true;activeSince=performance.now();suppress.current=true;clearTimeout(timer.current);}const target=document.elementFromPoint(e.clientX,e.clientY);if(!opened&&(!sortable||!target?.closest('.sidebar'))){opened=true;latest.current.start();}document.querySelectorAll('[data-reorder-edge]').forEach(n=>n.removeAttribute('data-reorder-edge'));const row=target?.closest<HTMLElement>('[data-folder-order]');if(sortable&&row&&row.dataset.homeDestination!==id&&row.dataset.folderOrder===(id.startsWith('category:Components / ')?'components':'design'))row.dataset.reorderEdge=e.clientY>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2?'after':'before';const list=target?.closest<HTMLElement>('.section-reveal-inner > nav');if(list&&list.scrollHeight>list.clientHeight+1&&performance.now()-activeSince>250){const r=list.getBoundingClientRect();if(e.clientY<r.top+30)list.scrollTop-=12;else if(e.clientY>r.bottom-30)list.scrollTop+=12;}if(e.cancelable)e.preventDefault();setGhost({label,x:e.clientX,y:e.clientY});};
    const end=()=>{clear();if(active)timer.current=window.setTimeout(()=>{suppress.current=false;},300);};
    const up=(e:PointerEvent)=>{if(e.pointerId!==pointerId)return;if(active){e.preventDefault();const target=document.elementFromPoint(e.clientX,e.clientY);const row=target?.closest<HTMLElement>('[data-reorder-edge]');if(row?.dataset.homeDestination)latest.current.reorder?.(id,row.dataset.homeDestination,row.dataset.reorderEdge==='after');else if(target?.closest('.home-dashboard'))latest.current.drop(id);}end();};
    const cancel=()=>end();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();end();}};
    document.addEventListener('pointermove',move,{capture:true,passive:false});document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',cancel,true);document.addEventListener('keydown',key,true);cleanup.current=clear;
  };
  return {ghost,captureClick:(e:React.MouseEvent)=>{if(suppress.current){e.preventDefault();e.stopPropagation();suppress.current=false;}},props:(id:string,label:string)=>({draggable:false,'data-home-destination':id,onPointerDown:(e:ReactPointerEvent)=>pointerDown(e,id,label),onDragStart:(e:React.DragEvent)=>{e.stopPropagation();e.dataTransfer.setData(homeMime,id);e.dataTransfer.effectAllowed='copy';latest.current.start();}})};
}
