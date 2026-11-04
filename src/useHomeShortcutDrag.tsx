import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { homeMime } from "./HomeDashboard";

// Pointer-based sidebar dragging also works when switching the main view to Home.
export default function useHomeShortcutDrag(start:()=>void,drop:(id:string)=>void){
  const latest=useRef({start,drop});latest.current={start,drop};
  const cleanup=useRef<()=>void>(()=>{}),suppress=useRef(false),timer=useRef(0);
  const [ghost,setGhost]=useState<{label:string;x:number;y:number}|null>(null);
  useEffect(()=>()=>{cleanup.current();clearTimeout(timer.current);},[]);
  const pointerDown=(event:ReactPointerEvent,id:string,label:string)=>{
    if(event.button!==0||event.isPrimary===false||(event.target as HTMLElement).closest('.icon-button'))return;
    event.stopPropagation();cleanup.current();const x=event.clientX,y=event.clientY,pointerId=event.pointerId;let active=false;
    const clear=()=>{document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',cancel,true);document.removeEventListener('keydown',key,true);setGhost(null);};
    const move=(e:PointerEvent)=>{if(e.pointerId!==pointerId)return;if(!active&&Math.hypot(e.clientX-x,e.clientY-y)<7)return;if(!active){active=true;suppress.current=true;clearTimeout(timer.current);latest.current.start();}if(e.cancelable)e.preventDefault();setGhost({label,x:e.clientX,y:e.clientY});};
    const end=()=>{clear();if(active)timer.current=window.setTimeout(()=>{suppress.current=false;},300);};
    const up=(e:PointerEvent)=>{if(e.pointerId!==pointerId)return;if(active){e.preventDefault();const target=document.elementFromPoint(e.clientX,e.clientY);if(target?.closest('.home-dashboard'))latest.current.drop(id);}end();};
    const cancel=()=>end();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();end();}};
    document.addEventListener('pointermove',move,{capture:true,passive:false});document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',cancel,true);document.addEventListener('keydown',key,true);cleanup.current=clear;
  };
  return {ghost,captureClick:(e:React.MouseEvent)=>{if(suppress.current){e.preventDefault();e.stopPropagation();suppress.current=false;}},props:(id:string,label:string)=>({draggable:false,'data-home-destination':id,onPointerDown:(e:ReactPointerEvent)=>pointerDown(e,id,label),onDragStart:(e:React.DragEvent)=>{e.stopPropagation();e.dataTransfer.setData(homeMime,id);e.dataTransfer.effectAllowed='copy';latest.current.start();}})};
}
