export type ImportProgress={phase:string;checked:number;total:number;current:string;elapsed_ms:number;remaining_seconds:number|null;bytes?:number;total_bytes?:number};
export default function CaptureProgress({progress,queued=0}:{progress:ImportProgress|null;queued?:number}){
 const p=progress;const total=p?.total_bytes??p?.total??0,done=p?.bytes??p?.checked??0;
 const label=p?.phase==='saving'?'Saving files':p?.phase==='checking'?'Checking for duplicates':p?.phase==='finishing'?'Finishing import':p?.phase==='waiting'?'Waiting for library':'Reading files';
 const remaining=p?.remaining_seconds;const estimate=remaining!=null&&remaining>0?remaining<60?'About '+Math.max(5,Math.ceil(remaining/5)*5)+' seconds left':'About '+Math.ceil(remaining/60)+' minutes left':null;
 return <div className="import-progress" role="status" aria-live="polite"><div><strong>{label}</strong><span>{p&&p.total>0?`${p.checked.toLocaleString()} / ${p.total.toLocaleString()} files`:''}{total>0?` · ${Math.min(100,Math.floor(done/total*100))}%`:''}</span></div><progress aria-label={label} max={total||1} value={total>0?Math.min(done,total):undefined}/><div><span className="import-current" title={p?.current}>{p?.current||'Please keep the app open'}</span><span>{[estimate,queued>0?`${queued} import${queued===1?'':'s'} queued`:null].filter(Boolean).join(' · ')}</span></div></div>;
}
