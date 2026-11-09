import {useEffect,useRef,useState} from 'react';

// Keep the poster visible until the browser has a frame ready to paint.
export default function HoverPreview({src,animation,onError}:{src:string;animation:boolean;onError:()=>void}){
 const [ready,setReady]=useState(false);const video=useRef<HTMLVideoElement>(null),frame=useRef<number|null>(null);
 useEffect(()=>{const element=video.current;return()=>{if(frame.current!==null)element?.cancelVideoFrameCallback?.(frame.current);};},[]);
 const revealVideo=()=>{const element=video.current;if(!element||ready)return;if(element.requestVideoFrameCallback){if(frame.current===null)frame.current=element.requestVideoFrameCallback(()=>{frame.current=null;setReady(true);});}else if(!element.paused&&element.readyState>=2){setReady(true);}};
 const className=`hover-preview${ready?' is-ready':''}`;
 return animation?<img src={src} alt="" className={className} draggable={false} onLoad={()=>setReady(true)} onError={onError}/>:<video ref={video} src={src} autoPlay muted loop playsInline className={className} draggable={false} onLoadedData={revealVideo} onPlaying={revealVideo} onError={onError}/>;
}
