// Preserve code locations and error identity, never exception messages or URLs.
export function fingerprint(text:string){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0).toString(16).padStart(8,'0');}
export function codeFrames(stack:unknown):string {
 if(typeof stack!=='string')return '';
 return [...stack.matchAll(/(?:\/src\/|\/assets\/|\\src\\)([A-Za-z0-9_./\\-]+\.(?:tsx?|jsx?|rs))(?::(\d+):(\d+)|\?[^\s):]*:(\d+):(\d+))/g)]
  .slice(0,8).map(m=>`${m[1].split(/[\/\\]/).pop()}:${m[2]??m[4]}:${m[3]??m[5]}`).join(',');
}
export function errorEvidence(error:unknown,callsite?:string){
 const candidate=error as {name?:unknown;stack?:unknown;message?:unknown}|null;
 const type=typeof candidate?.name==='string'&&['Error','TypeError','RangeError','ReferenceError','SyntaxError','URIError','EvalError','DOMException','AbortError','SecurityError','QuotaExceededError','NotAllowedError'].includes(candidate.name)?candidate.name:'Error';
 const stack=codeFrames(candidate?.stack)||codeFrames(callsite);
 return {error_type:type,error_fingerprint:fingerprint(`${type}:${String(candidate?.message??error)}:${stack}`),code_frames:stack};
}
export type EvidenceEvent={time?:number;name:string;operation:string;status:string;duration:number;fields:Record<string,unknown>};
export function incidentTimeline(events:EvidenceEvent[],selected:EvidenceEvent){
 const time=selected.time??0,root=selected.fields.interaction;
 const priority=(e:EvidenceEvent)=>e===selected?0:selected.operation&&e.operation===selected.operation?1:root&&e.fields.interaction===root?2:3;
 const candidates=events.filter(e=>e!==selected&&!(e.operation===selected.operation&&e.time===selected.time&&e.name===selected.name&&e.status===selected.status)&&
  (priority(e)<3||Math.abs((e.time??0)-time)<=5000));
 return [selected,...candidates].sort((a,b)=>priority(a)-priority(b)||Math.abs((a.time??0)-time)-Math.abs((b.time??0)-time)).slice(0,120)
  .sort((a,b)=>(a.time??0)-(b.time??0));
}
