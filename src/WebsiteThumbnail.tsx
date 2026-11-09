import {useEffect,useRef,useState} from 'react';
import {convertFileSrc} from '@tauri-apps/api/core';

export default function WebsiteThumbnail({poster,original,active,deactivate}:{poster:string;original:string;active:boolean;deactivate:()=>void}){
 const frame=useRef<HTMLSpanElement>(null),viewport=useRef<HTMLSpanElement>(null);
 const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{setReady(false);setFailed(false);if(viewport.current)viewport.current.scrollTop=0;},[active,original]);
 useEffect(()=>{
  if(!active)return;
  const el=viewport.current!,button=frame.current!.closest('button')!;
  const outside=(event:PointerEvent)=>{if(!button.contains(event.target as Node))deactivate();};
  const wheel=(event:WheelEvent)=>{
   if(event.ctrlKey||event.metaKey||!event.deltaY)return;
   event.preventDefault();event.stopPropagation();
   el.scrollTop+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?el.clientHeight:1);
  };
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();deactivate();return;}
   if(event.ctrlKey||event.metaKey||event.altKey)return;
   const amount=({ArrowDown:48,ArrowUp:-48,PageDown:el.clientHeight*.85,PageUp:-el.clientHeight*.85,Home:-el.scrollHeight,End:el.scrollHeight} as Record<string,number>)[event.key];
   if(amount!==undefined){event.preventDefault();event.stopPropagation();el.scrollTop+=amount;}
  };
  document.addEventListener('pointerdown',outside,true);window.addEventListener('blur',deactivate);
  el.addEventListener('wheel',wheel,{passive:false});button.addEventListener('keydown',key);
  return()=>{document.removeEventListener('pointerdown',outside,true);window.removeEventListener('blur',deactivate);el.removeEventListener('wheel',wheel);button.removeEventListener('keydown',key);};
 },[active,deactivate]);
 return <span ref={frame} className="website-thumbnail" data-active={active} data-ready={active&&ready}>
  {poster?<img className="website-thumbnail-poster" loading="lazy" src={convertFileSrc(poster)} alt=""/>:<span className="link-card-placeholder"/>}
  <span ref={viewport} className="website-thumbnail-viewport">
   {active&&<img className="website-thumbnail-page" src={convertFileSrc(original)} alt="" draggable={false} onLoad={()=>setReady(true)} onError={()=>setFailed(true)}/>}
  </span>
  {active&&<span className="website-thumbnail-hint">{failed?'Preview unavailable':ready?'Scroll to explore · Esc to exit':'Loading screenshot…'}</span>}
 </span>;
}
