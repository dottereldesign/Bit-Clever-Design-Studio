import preset from './defaultAppearance.json';
export const defaultAppearance:Readonly<Record<string,unknown>>=preset;
const adoptedKey='studio-default-appearance-version';
// Browser storage is separate from the desktop WebView. Adopt the studio look
// once for existing browser profiles, then preserve all subsequent choices.
export function initializeAppearanceDefaults(storage:Storage,browser:boolean){
 const adopt=browser&&storage.getItem(adoptedKey)===null;
 for(const [key,value] of Object.entries(defaultAppearance))if(adopt||storage.getItem(key)===null)storage.setItem(key,JSON.stringify(value));
 storage.setItem(adoptedKey,'1');
}
