import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {convertFileSrc} from '@tauri-apps/api/core';

export default function WebsiteThumbnail({poster,original}:{poster:string;original:string}){
 const frame=useRef<HTMLSpanElement>(null),image=useRef<HTMLImageElement>(null);
 const [hover,setHover]=useState(false),[load,setLoad]=useState(false),[ready,setReady]=useState(false),[distance,setDistance]=useState(0);
 const [reduced,setReduced]=useState(false);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>setReduced(media.matches||document.documentElement.dataset.motion==='reduce');
  const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
  media.addEventListener('change',update);update();return()=>{media.removeEventListener('change',update);observer.disconnect();};
 },[]);
 useEffect(()=>{
  const timer=setTimeout(()=>{setLoad(hover&&!reduced);if(!hover||reduced)setReady(false);},hover&&!reduced?300:220);
  return()=>clearTimeout(timer);
 },[hover,reduced]);
 const measure=()=>{const el=frame.current,img=image.current;if(el&&img?.naturalWidth)setDistance(Math.max(0,img.naturalHeight*el.clientWidth/img.naturalWidth-el.clientHeight));};
 useEffect(()=>{const observer=new ResizeObserver(measure);if(frame.current)observer.observe(frame.current);return()=>observer.disconnect();},[]);
 const scrolling=hover&&!reduced&&ready&&distance>0;
 return <span ref={frame} className="website-thumbnail" data-scrolling={scrolling} style={{'--website-scroll':`${distance}px`,'--website-scroll-time':`${Math.max(1,distance/24)}s`} as CSSProperties}
  onPointerEnter={event=>{if(event.pointerType!=='touch')setHover(true);}} onPointerLeave={()=>setHover(false)} onPointerCancel={()=>setHover(false)}>
  {poster?<img className="website-thumbnail-poster" loading="lazy" src={convertFileSrc(poster)} alt=""/>:<span className="link-card-placeholder"/>}
  {load&&<img ref={image} className="website-thumbnail-scroll" src={convertFileSrc(original)} alt="" draggable={false} onLoad={()=>{measure();setReady(true);}} onError={()=>setReady(false)}/>}
 </span>;
}
