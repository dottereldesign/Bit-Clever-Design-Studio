// Diagnostic metadata is an allowlisted description, never a copy of user data.
export type DiagnosticFields = Record<string, string | number | boolean | null>;
export const diagnosticSections = ['marketing','leads','general','projects','designs','components','home','settings'] as const;
const kinds = ['lead','campaign','contact','organization','content','activity','pipeline'];
const fields = new Set(['name','archived','organization','contacts','projects','campaign','parent','files','tags','status','service','source','value','currency','date','end_date','body','email','phone','website','audience','message','offer','channel','results','activity_type','actions','moodboard','stages','brief','deadline','action','done','text','primary','role','company','notes','title','people','related','kind']);
let context: DiagnosticFields = {};
let recordKinds = new Map<string,string>();
export function opaqueId(value:string):string {let hash=2166136261;for(const char of value)hash=Math.imul(hash^char.charCodeAt(0),16777619);return `record-${(hash>>>0).toString(16).padStart(8,'0')}`;}
export function setDiagnosticRecords(records:{id:string;kind:string}[]) {recordKinds=new Map(records.filter(r=>kinds.includes(r.kind)).map(r=>[r.id,r.kind]));}
export function setDiagnosticContext(next:DiagnosticFields) {context={...next};}
export function diagnosticContext():DiagnosticFields {return {...context};}
function recordContext(id:string,kind?:string):DiagnosticFields {
 const known=kind&&kinds.includes(kind)?kind:recordKinds.get(id);
 return {record_id:opaqueId(id),record_kind:known??'unknown',...(known?{section:['campaign','content'].includes(known)?'marketing':'leads'}:{})};
}
export function commandFields(command:string,input:Record<string,any>):DiagnosticFields {
 const change=input.change??input.input??{};
 const result:DiagnosticFields={...context};
 if(typeof change.action==='string')result.action=change.action;
 for(const key of ['ids','files'])if(Array.isArray(change[key]))result.count=change[key].length;
 if(typeof input.id==='number')result.id=input.id;
 if(typeof change.target==='number')result.folder=change.target;
 if(Array.isArray(change.projects)&&typeof change.projects[0]==='number'){result.project=change.projects[0];result.section='projects';}
 if(typeof change.project_only==='boolean')result.mode=change.project_only?'project_only':'shared';
 if(Array.isArray(change.ids)&&change.ids.length===1&&typeof change.ids[0]==='number')result.id=change.ids[0];
 if(typeof change.studio==='string')Object.assign(result,recordContext(change.studio),{mode:'studio_only'});
 if(command==='update'){
  if(change.action==='convert_studio_lead'&&typeof change.value==='string')Object.assign(result,recordContext(change.value,'lead'),{phase:'handover'});
  if(['update_studio','update_client_records','update_project_overview'].includes(change.action)&&typeof change.value==='string'){
   try{const value=JSON.parse(change.value);
    if(change.action==='update_studio'&&typeof value.id==='string')Object.assign(result,recordContext(value.id,value.patch?.kind),{mode:recordKinds.has(value.id)?'edit':'create'});
    else {result.section='projects';if(typeof change.target==='number')result.project=change.target;if(typeof value.id==='string')result.record_id=opaqueId(value.id);if(['contact','record','action'].includes(value.type))result.record_kind=value.type;}
    const patch=change.action==='update_project_overview'?value:value.patch;
    if(patch&&typeof patch==='object'){const names=Object.keys(patch).filter(k=>fields.has(k)).sort();result.field=names.join('.');result.count=names.length;}
    else if(fields.has(value.field))result.field=value.field;
   }catch{result.error_code='invalid_payload';}
  }
 }
 return result;
}
