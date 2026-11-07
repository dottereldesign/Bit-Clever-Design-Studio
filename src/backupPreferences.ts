const keys=['collection-shortcuts','site-shortcuts','tile-size','sidebar-width','sidebar-section-style','home-style','home-appearance','reduce-motion','sidebar-layout','app-icons','folder-labels','folder-appearance','sidebar-folder-order','home-plan','home-tiles'];
const allowed=(key:string)=>keys.includes(key)||key.startsWith('sidebar-open:');
export function collectBackupPreferences(){
 const result:Record<string,unknown>={};
 for(const key of Object.keys(localStorage)){if(allowed(key)){try{result[key]=JSON.parse(localStorage.getItem(key)!);}catch{/* Skip invalid settings. */}}}
 return result;
}
export function applyBackupPreferences(values:Record<string,unknown>){
 for(const [key,value] of Object.entries(values)){if(allowed(key))localStorage.setItem(key,JSON.stringify(value));}
}
