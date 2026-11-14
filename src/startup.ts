// Run after library preferences load, before the first React render.
// Collapse saved sections without changing their order, style or contents.
export function prepareHomeStartup(storage:Storage=localStorage){
 for(const key of Object.keys(storage))if(key.startsWith('sidebar-open:'))storage.setItem(key,'false');
}
