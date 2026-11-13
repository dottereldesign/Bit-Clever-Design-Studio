import {useEffect, useState} from 'react';
import {useHistoryState} from './useAppHistory';
import {appHistory} from './appHistory';
import {invoke,isTauri} from './diagnostics';
import appLogo from './assets/app-logo.svg';
import './branding.css';
type Branding={name:string;logo:string;size:number;desktopSync:boolean};
const defaults=():Branding=>({name:'Bit Clever Studio',logo:'',size:80,desktopSync:false});
export const useBranding=()=>useHistoryState<Branding>('app-branding',defaults,'Change app branding');
let queue:Promise<unknown>=Promise.resolve();
export function useAppBranding(){
 const [saved]=useBranding();
 const branding={...defaults(),...saved,name:saved.name.trim()||'Bit Clever Studio',size:Math.max(40,Math.min(100,saved.size||80))};
 useEffect(()=>{
  document.title=branding.name;
  const icon=document.querySelector<HTMLLinkElement>('link[rel="icon"]');if(icon)icon.href=branding.logo||appLogo;
  const timer=setTimeout(()=>{if(isTauri()){queue=queue.catch(()=>{}).then(()=>invoke('apply_app_branding',{name:branding.name,logo:branding.logo||null,shortcut:branding.desktopSync}));void queue.then(()=>window.dispatchEvent(new CustomEvent('branding-status',{detail:'Branding updated.'})),()=>window.dispatchEvent(new CustomEvent('branding-status',{detail:'Windows branding could not update. See Settings → Diagnostics.'})));}},400);
  return()=>clearTimeout(timer);
 },[branding.name,branding.logo,branding.desktopSync]);
 return branding;
}
export function BrandingControls(){
 const [value,set]=useBranding(),[status,setStatus]=useState('');
 useEffect(()=>{const listener=(e:Event)=>setStatus((e as CustomEvent<string>).detail);window.addEventListener('branding-status',listener);return()=>window.removeEventListener('branding-status',listener);},[]);
 async function upload(file?:File){if(!file)return;try{if(file.size>12*1024*1024)throw Error('Choose an image under 12 MB.');const bitmap=await createImageBitmap(file);try{const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d')!;const scale=Math.min(256/bitmap.width,256/bitmap.height);ctx.drawImage(bitmap,(256-bitmap.width*scale)/2,(256-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);set(v=>({...v,logo:canvas.toDataURL('image/png')}));setStatus('Logo updated.');}finally{bitmap.close();}}catch(e){setStatus(e instanceof Error?e.message:'Could not read that image.');}}
 return <div className="branding-controls"><div className="branding-preview"><img src={value.logo||appLogo} alt="App logo preview"/><strong>{value.name||'Bit Clever Studio'}</strong></div><div className="branding-fields"><label>App name<input aria-label="App name" maxLength={64} value={value.name} onFocus={()=>appHistory.beginGesture('brand-name')} onBlur={()=>appHistory.endGesture()} onChange={e=>set({...value,name:e.target.value})}/></label><label>Logo<input aria-label="Choose app logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/></label><label>Logo size · {value.size}px<input aria-label="Logo size" type="range" min={40} max={100} value={value.size} onChange={e=>set({...value,size:Number(e.target.value)})}/></label><label className="custom-toggle"><span>Create and keep a branded desktop shortcut updated</span><input type="checkbox" checked={value.desktopSync} onChange={e=>set({...value,desktopSync:e.target.checked})}/></label><small>Updates this app’s name, logo and running window icon. Your original shortcuts stay intact. Re-pin the branded shortcut if Windows keeps an old taskbar icon. Installer and executable names stay unchanged.</small><button onClick={()=>set(defaults())}>Reset branding</button><p role="status">{status}</p></div></div>;
}
