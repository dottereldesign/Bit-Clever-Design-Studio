import {useEffect,useRef,useState} from 'react';
import {Channel,invoke} from "./diagnostics";
import type {CaptureFile} from './CaptureDialog';
type Browser={id:string;name:string};
type Progress={phase:string;message:string};
export default function WebsiteAutoCapture({url,autoStart,image,busy}:{url:string;autoStart:boolean;image:(file:CaptureFile)=>void;busy:(value:boolean)=>void}){
 const [browsers,setBrowsers]=useState<Browser[]>([]),[progress,setProgress]=useState<Progress|null>(null),[error,setError]=useState('');
 const [preferred,setPreferred]=useState(()=>localStorage.getItem('website-capture-browser')??''),[remember,setRemember]=useState(true);
 const running=useRef(false),started=useRef(''),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;void invoke<Browser[]>('website_capture_browsers').then(setBrowsers).catch(()=>setError('Automatic capture is unavailable. You can still paste an image below.'));return()=>{mounted.current=false;if(running.current)void invoke('website_capture_control',{action:'cancel'}).catch(()=>{});};},[]);
 const capture=async(browser:string)=>{
  if(running.current)return;running.current=true;busy(true);setError('');setProgress({phase:'opening',message:'Opening capture browser…'});
  if(remember){localStorage.setItem('website-capture-browser',browser);setPreferred(browser);}else{localStorage.removeItem('website-capture-browser');setPreferred('');}
  try{const onProgress=new Channel<Progress>();onProgress.onmessage=p=>{if(mounted.current)setProgress(p);};const file=await invoke<CaptureFile>('capture_website',{url,browser,onProgress});if(mounted.current)image(file);else void invoke('discard_capture',{paths:[file.path]});}
  catch(e){if(mounted.current)setError(String(e).includes('cancelled')?'Capture cancelled. Choose a browser to retry, or paste an image.':String(e));}
  finally{running.current=false;if(mounted.current){busy(false);setProgress(null);}}
 };
 useEffect(()=>{if(autoStart&&preferred&&browsers.some(b=>b.id===preferred)&&started.current!==url){started.current=url;void capture(preferred);}},[autoStart,url,browsers]);
 return <section className="website-auto-capture" aria-label="Automatic website capture">
  {progress?<><p role="status">{progress.message}</p><div className="website-capture-stages" aria-label="Capture progress">{['opening','loading','preparing','capturing'].map((phase,i)=><span key={phase} data-active={['opening','loading','preparing','capturing'].indexOf(progress.phase)>=i}>{['Browser','Load','Prepare','Capture'][i]}</span>)}</div>
  {progress.phase==='attention'&&<button className="primary" onClick={()=>void invoke('website_capture_control',{action:'continue'}).catch(e=>setError(String(e)))}>Continue capture</button>}
  <button className="subtle-button" onClick={()=>void invoke('website_capture_control',{action:'cancel'}).catch(e=>setError(String(e)))}>Cancel capture</button></>:
  <><p>Capture the full page · 1440px wide</p><div className="button-row">{browsers.map(b=><button className="primary" key={b.id} onClick={()=>void capture(b.id)}>Capture with {b.name}</button>)}</div>
  {!!browsers.length&&<label><input type="checkbox" checked={remember} onChange={e=>{setRemember(e.target.checked);if(!e.target.checked){localStorage.removeItem('website-capture-browser');setPreferred('');}}}/> Remember browser and capture automatically next time</label>}
  {!browsers.length&&!error&&<small>Chrome or Edge is needed for automatic capture.</small>}</>}
  {error&&<p className="form-error" role="alert">{error}</p>}
 </section>;
}
