import { useState, type ReactNode } from 'react';
import { invoke, convertFileSrc } from "./diagnostics";
import SidebarIcon from './SidebarIcon';
import { isBoardDestination } from './model';
import type { Shortcut } from './Shortcuts';
import { Folder,FolderOpen,FolderArchive,FolderCheck,FolderClock,FolderCode,FolderCog,FolderDot,FolderGit2,FolderHeart,FolderInput,FolderKanban,FolderKey,FolderLock,FolderOutput,FolderRoot,FolderSearch,FolderSymlink,FolderTree,FolderUp,House,Layers,Grid2X2,PanelsTopLeft,Boxes,BookOpen,Image,Bookmark,Link,Palette,Sparkles,Code,Globe,Camera,Play,Star,Heart,Compass,Music,Upload } from 'lucide-react';

export const folderIcons=[['folder','Classic',Folder],['folder-open','Open',FolderOpen],['folder-archive','Archive',FolderArchive],['folder-check','Done',FolderCheck],['folder-clock','Recent',FolderClock],['folder-code','Code',FolderCode],['folder-cog','Tools',FolderCog],['folder-dot','Marked',FolderDot],['folder-git','Branch',FolderGit2],['folder-heart','Favourite',FolderHeart],['folder-input','Inbox',FolderInput],['folder-kanban','Board',FolderKanban],['folder-key','Key',FolderKey],['folder-lock','Locked',FolderLock],['folder-output','Outbox',FolderOutput],['folder-root','Root',FolderRoot],['folder-search','Search',FolderSearch],['folder-symlink','Shortcut',FolderSymlink],['folder-tree','Tree',FolderTree],['folder-up','Parent',FolderUp]] as const;
export const symbols=[['home','Home',House],['layers','Layers',Layers],['grid','Grid',Grid2X2],['panels','Panels',PanelsTopLeft],['boxes','Components',Boxes],['book','Book',BookOpen],['image','Image',Image],['bookmark','Bookmark',Bookmark],['link','Link',Link],['palette','Palette',Palette],['sparkles','Sparkles',Sparkles],['code','Code',Code],['globe','Website',Globe],['camera','Camera',Camera],['play','Video',Play],['star','Star',Star],['heart','Heart',Heart],['compass','Compass',Compass],['music','Music',Music],['folder','Folder',Folder]] as const;
const library=new Map<string,typeof Folder>([...folderIcons,...symbols].map(([id,,Icon])=>[id,Icon]));
export type IconValue={kind:'symbol'|'image'|'asset'|'text';value:string};
export type IconPreferences={folder:string;overrides:Record<string,IconValue>};
export const readIcons=():IconPreferences=>{try{const p=JSON.parse(localStorage.getItem('app-icons')??'{}');return {folder:folderIcons.some(([id])=>id===p.folder)?p.folder:'folder',overrides:p.overrides&&typeof p.overrides==='object'?p.overrides:{}};}catch{return {folder:'folder',overrides:{}};}};
export function AppIcon({value,fallback=<Folder size={15}/>,size=16}:{value?:IconValue;fallback?:ReactNode;size?:number}){
 if(value?.kind==='asset')return <img className="custom-nav-icon" src={convertFileSrc(value.value)} alt="" aria-hidden="true" style={{width:size,height:size}}/>;
 if(value?.kind==='image'&&/^data:image\/(png|webp|jpeg);base64,/.test(value.value))return <img className="custom-nav-icon" src={value.value} alt="" aria-hidden="true" style={{width:size,height:size}}/>;
 if(value?.kind==='text')return <i className="custom-nav-icon custom-text-icon" aria-hidden="true" style={{width:size,height:size,fontSize:size}}>{value.value.slice(0,12)}</i>;
 const Icon=value?.kind==='symbol'?library.get(value.value):null;
 return Icon?<Icon className="custom-nav-icon" size={size} aria-hidden="true"/>:<>{fallback}</>;
}
export function FolderIcon({preferences,id,size=15}:{preferences:IconPreferences;id:string;size?:number}){return <AppIcon value={preferences.overrides[id]??preferences.overrides.folders??{kind:'symbol',value:preferences.folder}} size={size}/>;}
export function GeneralEntryIcon({entry,preferences}:{entry:Shortcut;preferences:IconPreferences}){
 const target=entry.target??{kind:'view',value:entry.key},view=target.kind==='view'?target.value:'';
 const fallback=view==='websites'?<Globe size={16} color="#527da8"/>:isBoardDestination(view)||view==='facebook'||view==='resources'?<SidebarIcon name={view}/>:view==='links'?<Link size={15}/>:target.kind==='website'?<Globe size={15}/>:target.kind==='project'||target.kind==='category'?<FolderIcon preferences={preferences} id={`collection:${entry.key}`}/>:<Grid2X2 size={15}/>;
 return <AppIcon value={preferences.overrides[`collection:${entry.key}`]} fallback={fallback}/>;
}
export async function readCustomIcon(file:File):Promise<IconValue>{
 if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw Error('Choose a PNG, JPG, WebP or GIF image.');
 if(file.size>5*1024*1024)throw Error('Choose an image smaller than 5 MB.');
 const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const context=canvas.getContext('2d');
 if(!context){bitmap.close();throw Error('Image preview unavailable.');}
 const scale=128/Math.max(bitmap.width,bitmap.height),w=bitmap.width*scale,h=bitmap.height*scale;context.drawImage(bitmap,(128-w)/2,(128-h)/2,w,h);bitmap.close();
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not prepare this icon.')),'image/png'));
 const saved=await invoke<{path:string}>('save_home_cover',{bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))});
 return {kind:'asset',value:saved.path};
}
export function IconPicker({value,change,reset,live=false}:{live?:boolean;value?:IconValue;change:(v:IconValue)=>void;reset?:()=>void}){
 const [text,setText]=useState(value?.kind==='text'?value.value:''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <div className="icon-picker"><div className="symbol-grid">{symbols.map(([id,name,Icon])=><button type="button" key={id} title={name} aria-label={`Use ${name} icon`} aria-pressed={value?.kind==='symbol'&&value.value===id} onClick={()=>change({kind:'symbol',value:id})}><Icon size={21}/></button>)}</div>
 <div className="custom-icon-actions"><label className="custom-action"><Upload size={14}/>{busy?'Preparing…':'Upload image'}<input aria-label="Upload custom icon" type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setBusy(true);setError('');try{change(await readCustomIcon(file));}catch(e){setError(String(e));}finally{setBusy(false);}}}/></label><input aria-label="Emoji or initials" value={text} maxLength={12} placeholder="Emoji or initials" onChange={e=>{setText(e.target.value);if(live&&e.target.value.trim())change({kind:'text',value:e.target.value.trim()});}}/>{!live&&<button type="button" className="custom-action" disabled={!text.trim()} onClick={()=>change({kind:'text',value:text.trim()})}>Use</button>}{reset&&<button type="button" onClick={reset}>Reset</button>}</div>{error&&<p role="alert">{error}</p>}</div>;
}
