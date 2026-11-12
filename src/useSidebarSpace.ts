import { useLayoutEffect } from "react";
export function shareSidebarSpace(demands:number[],available:number){
 const result=demands.map(()=>0),pending=new Set(demands.map((_,i)=>i));let left=Math.max(0,available);
 while(pending.size){const share=left/pending.size,small=[...pending].filter(i=>demands[i]<=share);if(!small.length){for(const i of pending)result[i]=share;break;}for(const i of small){result[i]=demands[i];left-=demands[i];pending.delete(i);}}
 return result;
}
export default function useSidebarSpace(layout=1){
 useLayoutEffect(()=>{
  const container=document.querySelector<HTMLElement>('.sidebar-scroll');if(!container)return;let frame=0;
  const measure=()=>{frame=0;
   const sections=[...container.querySelectorAll<HTMLElement>(':scope > .sidebar-section')];
   const bodies=sections.filter(s=>s.dataset.open==='true').map(s=>s.querySelector<HTMLElement>(':scope > .sidebar-section-body, :scope > .section-reveal > .section-reveal-inner > .sidebar-section-body, :scope > .section-reveal > .section-reveal-inner > nav')!).filter(Boolean);
   const total=[...container.children].reduce((sum,child)=>{const css=getComputedStyle(child);return sum+child.getBoundingClientRect().height+parseFloat(css.marginTop||'0')+parseFloat(css.marginBottom||'0');},0);
   const used=bodies.reduce((sum,body)=>sum+(body.parentElement?.classList.contains('section-reveal-inner')?body.parentElement.parentElement!.getBoundingClientRect().height:body.getBoundingClientRect().height),0);
   const heights=shareSidebarSpace(bodies.map(body=>body.scrollHeight),container.clientHeight-total+used);
   bodies.forEach((body,i)=>{const value=`${Math.max(0,Math.floor(heights[i]))}px`;if(body.style.maxHeight!==value)body.style.maxHeight=value;});
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
  const resize=new ResizeObserver(schedule);resize.observe(container);
  const watch=()=>{container.querySelectorAll('.sidebar-heading,.sidebar-section-body,.section-reveal,.section-reveal-inner > nav').forEach(node=>resize.observe(node));schedule();};
  const mutation=new MutationObserver(watch);mutation.observe(container,{subtree:true,childList:true,attributes:true,attributeFilter:['data-open','class']});watch();
  return ()=>{cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();};
 },[layout]);
}
