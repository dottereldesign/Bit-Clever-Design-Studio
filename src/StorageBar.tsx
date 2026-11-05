import {useEffect,useRef,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {HardDrive} from 'lucide-react';
import './storageBar.css';
type Usage={bytes:number;data_bytes:number;library_bytes:number;app_bytes:number;partial:boolean};
export function storageSize(bytes:number){const units=['B','KB','MB','GB','TB'];let n=0;while(bytes>=1024&&n<units.length-1){bytes/=1024;n++;}return `${bytes.toLocaleString(undefined,{maximumFractionDigits:n?1:0})} ${units[n]}`;}
export default function StorageBar({revision,report}:{revision:unknown;report:(e:unknown)=>void}){
 const [usage,setUsage]=useState<Usage|null>(null),[error,setError]=useState(false),[opening,setOpening]=useState(false);const refresh=useRef(()=>{});
 useEffect(()=>{let alive=true,busy=false;const update=async()=>{if(busy||document.hidden)return;busy=true;try{const next=await invoke<Usage>('storage_usage');if(alive){setUsage(next);setError(false);}}catch{if(alive)setError(true);}finally{busy=false;}};refresh.current=()=>void update();void update();const timer=setInterval(()=>void update(),60000);window.addEventListener('focus',refresh.current);const focus=refresh.current;return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',focus);};},[]);
 useEffect(()=>{const timer=setTimeout(()=>refresh.current(),2000);return()=>clearTimeout(timer);},[revision]);
 const detail=usage?`App ${storageSize(usage.app_bytes)} · Data ${storageSize(usage.data_bytes)} · Library ${storageSize(usage.library_bytes)}${usage.partial?' · Some files could not be measured':''}`:'App, saved data and library media';
 return <button className="sidebar-storage" aria-label="Open app data folder" title={`${detail}\nClick to open the app data folder in File Explorer`} disabled={opening} onClick={async()=>{setOpening(true);try{await invoke('open_data_folder');}catch(e){report(e);}finally{setOpening(false);}}}><span className="storage-summary"><HardDrive size={13}/><span>Storage</span><strong>{error?'Unavailable':usage?`${usage.partial?'≥ ':''}${storageSize(usage.bytes)}`:'Calculating…'}</strong></span><span className="storage-track" aria-hidden="true">{usage&&usage.bytes>0?[usage.app_bytes,usage.data_bytes,usage.library_bytes].map((n,i)=><i key={i} style={{width:`${n/usage.bytes*100}%`}}/>):<i className="storage-pending"/>}</span></button>;
}
