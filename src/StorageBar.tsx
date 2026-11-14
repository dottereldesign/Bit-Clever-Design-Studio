import {useEffect,useRef,useState} from 'react';
import {invoke} from "./diagnostics";
import {HardDrive} from 'lucide-react';
import './storageBar.css';
type Usage={bytes:number;data_bytes:number;library_bytes:number;app_bytes:number;partial:boolean};
export function storageSize(bytes:number){const units=['B','KB','MB','GB','TB'];let n=0;while(bytes>=1024&&n<units.length-1){bytes/=1024;n++;}return `${bytes.toLocaleString(undefined,{maximumFractionDigits:n?1:0})} ${units[n]}`;}
let cachedUsage:Usage|null=null,lastMeasured=0,inflight:Promise<Usage>|null=null,lastRevision:unknown,rerun=false;
const subscribers=new Set<(usage:Usage)=>void>();
function measureUsage(force=false):Promise<Usage>{
 if(inflight){if(force)rerun=true;return inflight;}
 if(!force&&cachedUsage&&Date.now()-lastMeasured<60000)return Promise.resolve(cachedUsage);
 inflight=invoke<Usage>('storage_usage').then(value=>{cachedUsage=value;lastMeasured=Date.now();subscribers.forEach(fn=>fn(value));return value;}).finally(()=>{inflight=null;if(rerun){rerun=false;void measureUsage(true).catch(()=>{});}});return inflight;
}
const storageCapacity=15*1024**3;
export default function StorageBar({revision,onOpen}:{revision:unknown;onOpen:()=>void}){
 const [usage,setUsage]=useState<Usage|null>(cachedUsage),[error,setError]=useState(false);const refresh=useRef(()=>{});
 useEffect(()=>{let alive=true,busy=false;const update=async()=>{if(busy||document.hidden)return;busy=true;try{const next=await measureUsage();if(alive){setUsage(next);setError(false);}}catch{if(alive)setError(true);}finally{busy=false;}};refresh.current=()=>void update();void update();const timer=setInterval(()=>void update(),60000);window.addEventListener('focus',refresh.current);const focus=refresh.current;return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',focus);};},[]);
 useEffect(()=>{const changed=lastRevision!==undefined&&lastRevision!==revision;lastRevision=revision;if(!changed)return;const timer=setTimeout(()=>{void measureUsage(true).catch(()=>setError(true));},2000);return()=>clearTimeout(timer);},[revision]);
 useEffect(()=>{const receive=(value:Usage)=>{setUsage(value);setError(false);};subscribers.add(receive);return()=>{subscribers.delete(receive);};},[]);
 const detail=usage?`App ${storageSize(usage.app_bytes)} · Data ${storageSize(usage.data_bytes)} · Library ${storageSize(usage.library_bytes)}${usage.partial?' · Some files could not be measured':''}`:'App, saved data and library media';
 return <button className="sidebar-storage" aria-label="Storage and backup" title={`${detail}\nView file locations and create a portable backup`} onClick={onOpen}><span className="storage-summary"><HardDrive size={13}/><span>Storage</span><strong>{error?'Unavailable':usage?`${usage.partial?'≥ ':''}${storageSize(usage.bytes)} / 15 GB`:'Calculating…'}</strong></span><span className="storage-track" aria-hidden="true">{usage?[usage.app_bytes,usage.data_bytes,usage.library_bytes].map((n,i)=><i key={i} style={{width:`${n/Math.max(storageCapacity,usage.bytes)*100}%`}}/>):<i className="storage-pending"/>}</span></button>;
}
