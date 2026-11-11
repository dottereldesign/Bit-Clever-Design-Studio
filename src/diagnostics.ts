import {invoke as nativeInvoke,isTauri,type InvokeArgs,type InvokeOptions} from '@tauri-apps/api/core';
export * from '@tauri-apps/api/core';
export type DiagnosticEvent={time?:number;name:string;operation:string;status:string;duration:number;fields:Record<string,unknown>};
let pending:DiagnosticEvent[]=[],timer:ReturnType<typeof setTimeout>|undefined;let failures=0;let detailedUntil=0;
export function detailedRecording(minutes=15){detailedUntil=Date.now()+minutes*60000;record('recording.detailed','success',0,{count:minutes});}
export function recordingRemaining(){return Math.max(0,Math.ceil((detailedUntil-Date.now())/60000));}
export function errorCode(error:unknown){const value=String(error).toLowerCase();return /cancel|abort/.test(value)?'cancelled':/timeout|timed out/.test(value)?'timeout':/denied|permission/.test(value)?'permission':/not found|cannot find|missing/.test(value)?'missing':/locked|busy/.test(value)?'busy':/disk|space/.test(value)?'storage':/network|connect|fetch/.test(value)?'network':'unknown';}
export function record(name:string,status='success',duration=0,fields:Record<string,unknown>={},operation=crypto.randomUUID()){
 if(!isTauri())return;if(pending.length>=2048){failures++;return;}pending.push({time:Date.now(),name,status,duration,fields,operation});if(!timer)timer=setTimeout(()=>void flushDiagnostics(),500);
}
export async function flushDiagnostics(){clearTimeout(timer);timer=undefined;const batch=pending.splice(0,255);if(failures){batch.push({name:'recording.frontend_loss',operation:'',status:'warning',duration:0,fields:{count:failures}});failures=0;}if(!batch.length)return;try{await nativeInvoke('diagnostics_record',{events:batch});}catch{failures+=batch.length;}if(pending.length)timer=setTimeout(()=>void flushDiagnostics(),500);}
export async function invoke<T>(command:string,args?:InvokeArgs,options?:InvokeOptions):Promise<T>{
 if(command.startsWith('diagnostics_'))return nativeInvoke<T>(command,args,options);
 const operation=crypto.randomUUID(),start=performance.now();const input=(args??{}) as Record<string,any>;const change=input.change??input.input??{};
 const fields:Record<string,unknown>={};if(typeof change.action==='string')fields.action=change.action;if(Array.isArray(change.ids))fields.count=change.ids.length;if(Array.isArray(change.files))fields.count=change.files.length;if(typeof input.id==='number')fields.id=input.id;if(typeof change.target==='number')fields.folder=change.target;if(Array.isArray(change.projects)&&typeof change.projects[0]==='number')fields.project=change.projects[0];if(typeof change.project_only==='boolean')fields.mode=change.project_only?'project_only':'shared';if(Array.isArray(change.ids)&&change.ids.length===1)fields.id=change.ids[0];
 const channel=input.onProgress;let priorPhase='';let progressHandler:((value:any)=>void)|undefined;if(channel&&typeof channel.onmessage==='function'){progressHandler=channel.onmessage;channel.onmessage=(value:any)=>{const phase=typeof value?.phase==='string'?value.phase:'progress';if(phase!==priorPhase){priorPhase=phase;record(command+'.phase',phase==='attention'?'warning':'success',performance.now()-start,{phase,completed:value?.completed_files??value?.checked,total:value?.total_files??value?.total},operation);}progressHandler?.(value);};}
 const noisy=['get_media','stage_chunk','storage_usage','save_library_preferences'].includes(command);const detailed=Date.now()<detailedUntil;
 if(!noisy||detailed)record(command,'started',0,fields,operation);
 try{const result=await nativeInvoke<T>(command,{...input,diagnosticOperation:operation},options);const duration=performance.now()-start;const output=result as any;if(Array.isArray(output?.items))fields.items=output.items.length;if(Array.isArray(output?.ids)&&output.ids.length===1)fields.id=output.ids[0];for(const key of ['added','reused','failed'])if(typeof output?.[key]==='number')fields[key]=output[key];if(!noisy||detailed||duration>500)record(command,'success',duration,fields,operation);return result;}
 catch(error){const code=errorCode(error);record(command,code==='cancelled'?'cancelled':'error',performance.now()-start,{...fields,error_code:code},operation);throw error;}finally{if(progressHandler)channel.onmessage=progressHandler;}
}
export function startDiagnostics(){
 const onError=()=>record('frontend.uncaught','error',0,{error_code:'javascript'});const onRejection=(e:PromiseRejectionEvent)=>record('frontend.rejection','error',0,{error_code:errorCode(e.reason)});
 window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);
 let observer:PerformanceObserver|undefined;try{observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())if(entry.duration>100)record('frontend.long_task','warning',entry.duration);});observer.observe({entryTypes:['longtask']});}catch{/* WebView versions may not expose long tasks. */}
 record('frontend.start');return()=>{window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection);observer?.disconnect();void flushDiagnostics();};
}
