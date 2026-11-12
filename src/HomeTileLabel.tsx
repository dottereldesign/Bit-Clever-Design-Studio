import { useLayoutEffect, useRef } from "react";

export default function HomeTileLabel({label,scale}:{label:string;scale:number}){
 const frame=useRef<HTMLSpanElement>(null),text=useRef<HTMLSpanElement>(null);
 useLayoutEffect(()=>{
  const box=frame.current!,content=text.current!;let pending=0,live=true;
  const fit=()=>{
   pending=0;if(!live)return;
   const css=getComputedStyle(box),width=box.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight),height=box.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom);
   if(width<=0||height<=0)return;
   let low=1,high=Math.max(12,Math.min(48,Math.min(width*.19,height*.36)*scale));
   content.style.fontSize=`${high}px`;
   const fits=()=>content.scrollWidth<=width+1&&content.offsetHeight<=height+1;
   if(fits())return;
   // Measure the actual name, including wrapping, rather than guessing from character count.
   while(high-low>.5){const middle=(low+high)/2;content.style.fontSize=`${middle}px`;if(fits())low=middle;else high=middle;}
   content.style.fontSize=`${low}px`;
  };
  const schedule=()=>{cancelAnimationFrame(pending);pending=requestAnimationFrame(fit);};
  const observer=new ResizeObserver(schedule);observer.observe(box);fit();
  void document.fonts.ready.then(()=>{if(live)schedule();});
  return ()=>{live=false;cancelAnimationFrame(pending);observer.disconnect();};
 },[label,scale]);
 return <span className="home-tile-label" ref={frame}><span ref={text}>{label}</span></span>;
}
