import {traceDiagnostic} from './diagnostics';
import {invoke, isTauri} from './diagnostics';
export const businessPages = [['overview','Overview'],['details','Business details'],['setup','Setup checklist'],['domains','Domains'],['tax','Taxes & records'],['budget','Budget'],['hosting','Hosting & services'],['subscriptions','Subscriptions']] as const;
export type BusinessKind = 'setup'|'tax'|'domain'|'hosting'|'subscription'|'purchase';
export type BusinessRecord = {id:string;kind:BusinessKind;name:string;status:'planned'|'active'|'done'|'paused';due:string;amount:string;frequency:'once'|'monthly'|'yearly';currency:string;provider:string;url:string;notes:string};
export type BusinessData = {version:1;profile:{name:string;email:string;website:string;country:string;structure:string;registration:string;currency:string;budget:string;notes:string};records:BusinessRecord[]};
export type BusinessSnapshot = {revision:number;data:BusinessData};
export const emptyBusiness = ():BusinessData => ({version:1,profile:{name:'',email:'',website:'',country:'',structure:'Undecided',registration:'',currency:'NZD',budget:'',notes:''},records:[]});
const key='private-business-workspace-v1';
// Diagnostic metadata only; record contents never enter history or appearance/library exports.
export async function loadBusiness():Promise<BusinessSnapshot> {
 if(isTauri())return traceDiagnostic('business.load',{section:'business'},()=>invoke('business_load'));
 const raw=localStorage.getItem(key);return raw?JSON.parse(raw):{revision:0,data:emptyBusiness()};
}
export async function saveBusiness(snapshot:BusinessSnapshot,data:BusinessData):Promise<BusinessSnapshot> {
 if(isTauri())return traceDiagnostic('business.save',{section:'business',count:data.records.length},()=>invoke('business_save',{revision:snapshot.revision,data}));
 const current=await loadBusiness();if(current.revision!==snapshot.revision)throw Error('Business information changed in another tab. Reload before saving.');
 const next={revision:current.revision+1,data};localStorage.setItem(key,JSON.stringify(next));return next;
}
export const isCost=(r:BusinessRecord)=>['domain','hosting','subscription','purchase'].includes(r.kind);
export function budgetTotals(records:BusinessRecord[],currency:string){
 const rows=records.filter(r=>isCost(r)&&r.currency===currency&&r.amount!==''&&Number.isFinite(Number(r.amount))&&Number(r.amount)>=0);
 const monthly=(r:BusinessRecord)=>Number(r.amount)/(r.frequency==='yearly'?12:1);
 return {upfront:rows.filter(r=>r.status==='planned'&&r.frequency==='once').reduce((n,r)=>n+Number(r.amount),0),activeMonthly:rows.filter(r=>r.status==='active'&&r.frequency!=='once').reduce((n,r)=>n+monthly(r),0),plannedMonthly:rows.filter(r=>r.status==='planned'&&r.frequency!=='once').reduce((n,r)=>n+monthly(r),0),unpriced:records.filter(r=>isCost(r)&&r.status!=='paused'&&r.amount==='').length};
}
export const money=(value:number,currency:string)=>new Intl.NumberFormat('en-NZ',{style:'currency',currency,currencyDisplay:'code',maximumFractionDigits:2}).format(value);
export function newBusinessRecord(kind:BusinessKind,currency:string):BusinessRecord{return {id:crypto.randomUUID(),kind,name:'',status:'planned',due:'',amount:'',frequency:kind==='subscription'||kind==='hosting'?'monthly':kind==='domain'?'yearly':'once',currency,provider:'',url:'',notes:''};}
export const setupSuggestions=['Choose a business structure','Check business name availability','Confirm registration requirements','Set up a business bank account','Choose bookkeeping and invoicing tools','Prepare a client contract and scope template','Set deposit and payment terms','Plan insurance and professional advice','Create a privacy policy and data backup plan'];
