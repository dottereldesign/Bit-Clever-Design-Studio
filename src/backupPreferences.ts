import {record} from './diagnostics';
import {invoke,isTauri} from "./diagnostics";
import {appHistory} from "./appHistory";
const keys=['project-file-layouts','selection-style','colour-history','collection-shortcuts','site-shortcuts','tile-size','sidebar-width','sidebar-section-style','home-style','home-appearance','reduce-motion','sidebar-layout','app-icons','folder-labels','folder-appearance','sidebar-folder-order','home-plan','home-tiles'];
const allowed=(key:string)=>keys.includes(key)||key.startsWith('sidebar-open:');
export function collectBackupPreferences(){
 const result:Record<string,unknown>={};
 for(const key of Object.keys(localStorage)){if(allowed(key)){try{result[key]=JSON.parse(localStorage.getItem(key)!);}catch{/* Skip invalid settings. */}}}
 return result;
}
export function applyBackupPreferences(values:Record<string,unknown>){
 for(const [key,value] of Object.entries(values)){if(allowed(key))localStorage.setItem(key,JSON.stringify(value));}
}

export async function loadLibraryPreferences(){
 if(!isTauri())return;
 const values=await invoke<Record<string,unknown>|null>('library_preferences');
 if(values!==null){const {root}=await invoke<{root:string}>('library_overview');if(localStorage.getItem('active-library-root')!==root){localStorage.removeItem('last-workspace-view');localStorage.setItem('active-library-root',root);}for(const key of Object.keys(localStorage))if(allowed(key))localStorage.removeItem(key);applyBackupPreferences(values);}
}
let pending:Promise<void>|null=null,dirty=false,last='';
export async function flushLibraryPreferences(){
 if(!isTauri())return;
 dirty=true;if(pending)return pending;
 pending=(async()=>{try{while(dirty){dirty=false;const preferences=collectBackupPreferences(),text=JSON.stringify(preferences);if(text!==last){await invoke('save_library_preferences',{preferences});record('settings.saved','success',0,{count:Object.keys(preferences).length});last=text;}}}finally{pending=null;}})();
 return pending;
}
export function trackLibraryPreferences(report:(e:unknown)=>void){return appHistory.subscribe(()=>{void flushLibraryPreferences().catch(report);});}
