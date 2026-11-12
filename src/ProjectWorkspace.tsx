import ProjectOverview from './ProjectOverview';
import ClientRecords from './ClientRecords';
import type {ProjectOverviewData,ProjectSection,ClientData} from './model';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useVirtualizer} from '@tanstack/react-virtual';
import {ArrowLeft,ArrowRight,Columns3,ExternalLink,Eye,File,Folder,FolderPlus,Grid2X2,List,Plus,X} from 'lucide-react';
import {convertFileSrc,invoke} from './diagnostics';
import {media,openUrl,type Change} from './api';
import {revealItemInDir} from '@tauri-apps/plugin-opener';
import {useHistoryState} from './useAppHistory';
import {orderedFolders,folderPath,type FolderScope} from './ProjectFolders';
import type {Item,Label,ProjectFolder} from './model';
import LinkRating from './LinkRating';
import './projectWorkspace.css';

type Info={id:number;bytes:number|null;modified:number|null};
type Layout='details'|'tiles'|'columns';
type Preferences={layout:Layout;columns:string[];nameWidth:number};
const initial:Preferences={layout:'details',columns:['type','size','modified','rating'],nameWidth:360};
export const fileType=(item:Item)=>item.kind==='link'?'Link':item.path.split(/[\\/]/).at(-1)?.split('.').slice(1).at(-1)?.toUpperCase()||'File';
const bytes=(value:number|null|undefined)=>value==null?'—':value<1024?`${value} B`:value<1024**2?`${(value/1024).toFixed(1)} KB`:value<1024**3?`${(value/1024**2).toFixed(1)} MB`:`${(value/1024**3).toFixed(2)} GB`;
function FileThumb({item}:{item:Item}) {
  const [url,setUrl]=useState('');
  useEffect(()=>{setUrl('');if(item.kind==='file'||item.kind==='link'&&!item.thumbnail)return;const abort=new AbortController();void media(item,'thumbnail',abort.signal,0).then(setUrl).catch(()=>{});return()=>abort.abort();},[item.id,item.modified,item.path,item.thumbnail]);
  return url?<img src={url} alt="" onError={()=>setUrl('')}/>:<span className="project-file-glyph"><File size={28}/>{item.kind==='file'&&<small>{fileType(item)}</small>}</span>;
}

export default function ProjectWorkspace({fileToolbar,section,changeSection,clients,overview,project,folders,items,allItems,scope,navigate,mutate,report,addFiles,paste,drop,selected,select,menu,preview,size,order,search,scroller}: {
  fileToolbar:React.ReactNode;section:ProjectSection;changeSection:(section:ProjectSection)=>void;clients?:ClientData;overview?:ProjectOverviewData;project:Label;folders:ProjectFolder[];items:Item[];allItems:Item[];scope:FolderScope;navigate:(scope:FolderScope)=>void;
  mutate:(change:Change)=>Promise<unknown>;report:(error:unknown)=>void;addFiles:()=>void;paste:(folder:number|null)=>void;
  drop:(data:DataTransfer,folder:number|null)=>void;selected:Set<number>;select:(item:Item,event:React.MouseEvent)=>void;
  menu:(item:Item,event:React.MouseEvent)=>void;preview:(item:Item)=>void;size:number;order:string;search:string;scroller:React.RefObject<HTMLDivElement|null>;
}) {
  const [preferences,setPreferences]=useHistoryState<Record<string,Preferences>>('project-file-layouts',()=>{try{return JSON.parse(localStorage.getItem('project-file-layouts')??'{}');}catch{return {};}},'Project file layout');
  const prefs={...initial,...preferences[`project:${project.id}`]};
  const save=(value:Partial<Preferences>)=>setPreferences(previous=>({...previous,[`project:${project.id}`]:{...initial,...previous[`project:${project.id}`],...value}}));
  const [info,setInfo]=useState<Map<number,Info>>(new Map()),[newFolder,setNewFolder]=useState(false),[name,setName]=useState(''),[busy,setBusy]=useState(false);
  const [sort,setSort]=useState<'name'|'type'|'size'|'modified'|null>(null),[descending,setDescending]=useState(false);
  useEffect(()=>setSort(null),[order]);
  type Location={section:ProjectSection;scope:FolderScope};
  const location={section,scope};const locationKey=JSON.stringify(location);
  const [history,setHistory]=useState<Location[]>([location]),[position,setPosition]=useState(0);
  const travelling=useRef(false),lastLocation=useRef(locationKey),lastFile=useRef<FolderScope>((()=>{try{return JSON.parse(localStorage.getItem(`project-files-location:${project.id}`)??'null')??scope;}catch{return scope;}})()),positions=useRef<Record<string,number>>((()=>{try{return JSON.parse(localStorage.getItem(`project-scroll:${project.id}`)??'{}');}catch{return {};}})());
  const [requestedRecord,setRequestedRecord]=useState<{id:string;nonce:number}|null>(null);
  useEffect(()=>{if(section==='files'){lastFile.current=scope;localStorage.setItem(`project-files-location:${project.id}`,JSON.stringify(scope));}},[section,scope,project.id]);
  useEffect(()=>{const element=scroller.current;if(!element)return;let timer=0;const write=()=>{try{localStorage.setItem(`project-scroll:${project.id}`,JSON.stringify(positions.current));}catch{}};const save=()=>{positions.current[lastLocation.current]=element.scrollTop;clearTimeout(timer);timer=window.setTimeout(write,150);};element.addEventListener('scroll',save);return()=>{clearTimeout(timer);write();element.removeEventListener('scroll',save);};},[scroller,project.id]);
  useLayoutEffect(()=>{const previous=lastLocation.current;if(previous===locationKey)return;lastLocation.current=locationKey;if(travelling.current)travelling.current=false;else{setHistory(previous=>[...previous.slice(0,position+1),location]);setPosition(position+1);}const frame=requestAnimationFrame(()=>{if(scroller.current)scroller.current.scrollTop=positions.current[locationKey]??0;});return()=>cancelAnimationFrame(frame);},[locationKey]);
  const visit=(next:ProjectSection,folder=lastFile.current)=>{if(next==='files')navigate(typeof folder==='number'&&!folders.some(f=>f.id===folder&&f.project_id===project.id)?null:folder);changeSection(next);};
  const travel=(offset:number)=>{const next=position+offset;if(next<0||next>=history.length)return;travelling.current=true;setPosition(next);const loc=history[next];navigate(loc.scope);changeSection(loc.section);};
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(!event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight'].includes(event.key)||document.querySelector('main')?.inert)return;event.preventDefault();(document.activeElement as HTMLElement)?.blur();travel(event.key==='ArrowLeft'?-1:1);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[position,history]);
  const openRecord=(id:string)=>{setRequestedRecord({id,nonce:performance.now()});changeSection('client');};
  useEffect(()=>{let current=true;void invoke<Info[]>('project_file_details',{project:project.id}).then(rows=>{if(current)setInfo(new Map(rows.map(row=>[row.id,row])));}).catch(report);return()=>{current=false;};},[project.id,allItems,report]);
  const own=useMemo(()=>folders.filter(folder=>folder.project_id===project.id),[folders,project.id]);
  const ownIds=useMemo(()=>new Set(own.map(folder=>folder.id)),[own]);
  const unfiled=useMemo(()=>allItems.filter(item=>!item.project_folders?.some(id=>ownIds.has(id))),[allItems,ownIds]);
  const counts=useMemo(()=>{const result=new Map<number,number>();for(const item of allItems)for(const folder of item.project_folders??[])result.set(folder,(result.get(folder)??0)+1);return result;},[allItems]);
  const children=orderedFolders(own.filter(folder=>folder.parent_id===(typeof scope==='number'?scope:null)));
  const visibleFolders=scope==='unfiled'?[]:children;
  const files=useMemo(()=>[...(scope===null&&!search?[]:items)].sort((a,b)=>{
    if(sort===null)return 0;
    const difference=sort==='size'?(info.get(a.id)?.bytes??-1)-(info.get(b.id)?.bytes??-1):sort==='modified'?(info.get(a.id)?.modified??a.modified)-(info.get(b.id)?.modified??b.modified):sort==='type'?fileType(a).localeCompare(fileType(b)):a.name.localeCompare(b.name,undefined,{numeric:true});
    return (descending?-1:1)*(difference||a.id-b.id);
  }),[items,scope,search,sort,descending,info]);
  const chain:ProjectFolder[]=[];let current=typeof scope==='number'?own.find(folder=>folder.id===scope):undefined;const seen=new Set<number>();
  while(current&&!seen.has(current.id)){chain.unshift(current);seen.add(current.id);current=own.find(folder=>folder.id===current!.parent_id);}
  const folderDrop=(folder:FolderScope)=>({
    onDragOver:(event:React.DragEvent)=>{if(event.dataTransfer.types.some(type=>['application/design-items','application/project-folder','Files','text/uri-list','text/html'].includes(type))){event.preventDefault();event.stopPropagation();event.currentTarget.classList.add('drop-target');}},
    onDragLeave:(event:React.DragEvent)=>event.currentTarget.classList.remove('drop-target'),
    onDrop:(event:React.DragEvent)=>{event.preventDefault();event.stopPropagation();event.currentTarget.classList.remove('drop-target');const draggedFolder=event.dataTransfer.getData('application/project-folder');if(draggedFolder){if(folder==='unfiled')return;const id=Number(draggedFolder);if(Number.isInteger(id)&&ownIds.has(id)&&id!==folder)void mutate({action:'move_project_folder',target:id,value:typeof folder==='number'?String(folder):''}).catch(report);return;}const text=event.dataTransfer.getData('application/design-items');if(!text){drop(event.dataTransfer,typeof folder==='number'?folder:null);return;}try{const ids:unknown=JSON.parse(text);if(!Array.isArray(ids)||!ids.every(Number.isInteger))return;void mutate({action:typeof folder==='number'?'add_project_folder':'unfile_project_folder',target:typeof folder==='number'?folder:project.id,ids}).catch(report);}catch(error){report(error);}}
  });
  const root=useRef<HTMLDivElement>(null),[width,setWidth]=useState(800),[margin,setMargin]=useState(0);
  useEffect(()=>{const element=root.current;if(!element)return;const update=()=>{setWidth(element.clientWidth);const parent=scroller.current;if(parent)setMargin(element.getBoundingClientRect().top-parent.getBoundingClientRect().top+parent.scrollTop);};const observer=new ResizeObserver(update);observer.observe(element);update();return()=>observer.disconnect();},[scroller,scope,section,prefs.layout,visibleFolders.length,newFolder]);
  const columns=prefs.layout==='tiles'?Math.max(1,Math.floor((width+12)/(size+12))):1;
  const rowHeight=prefs.layout==='tiles'?Math.max(180,(width-(columns-1)*12)/columns*.7+68):48;
  const virtual=useVirtualizer({count:Math.ceil(files.length/columns),getScrollElement:()=>scroller.current,estimateSize:()=>rowHeight,overscan:4,scrollMargin:margin});
  useEffect(()=>virtual.measure(),[virtual,rowHeight]);
  const rowStyle={'--file-name-width':`${prefs.nameWidth}px`,'--file-min-width':`${prefs.nameWidth+prefs.columns.length*100+90}px`} as React.CSSProperties;
  const open=(item:Item)=>void (item.kind==='link'?openUrl(item.path):invoke('open_project_file',{id:item.id})).catch(report);
  const renderFile=(item:Item)=><div key={item.id} role="row" tabIndex={0} data-item-id={item.id} aria-selected={selected.has(item.id)} className={`project-file ${selected.has(item.id)?'selected':''}`} draggable
    onClick={event=>select(item,event)} onDoubleClick={()=>preview(item)} onContextMenu={event=>{event.preventDefault();menu(item,event);}}
    onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();preview(item);}}}
    onDragStart={event=>{event.dataTransfer.setData('application/design-items',JSON.stringify(selected.has(item.id)?[...selected]:[item.id]));event.dataTransfer.effectAllowed='copyMove';}}>
    <span className="project-file-name" title={item.path.split(/[\\/]/).at(-1)}><span className="project-file-thumb"><FileThumb item={item}/></span><span>{item.name}{item.missing&&<small>Missing file</small>}</span></span>
    {prefs.columns.includes('type')&&<span className="project-file-type">{fileType(item)}</span>}
    {prefs.columns.includes('size')&&<span className="project-file-size">{bytes(info.get(item.id)?.bytes)}</span>}
    {prefs.columns.includes('modified')&&<span className="project-file-date">{new Date(info.get(item.id)?.modified||(item.modified||item.added)).toLocaleDateString()}</span>}
    {prefs.columns.includes('rating')&&<span className="project-file-rating" onClick={event=>event.stopPropagation()}>{item.kind==='link'&&<LinkRating value={item.rating} onChange={value=>void mutate({action:'rate_links',ids:[item.id],value:value==null?'':String(value)}).catch(report)}/>}</span>}
    <span className="project-file-actions"><button title="Preview" aria-label={`Preview ${item.name}`} onClick={event=>{event.stopPropagation();preview(item);}}><Eye size={15}/></button><button title={item.kind==='link'?'Open website':'Open in default app'} aria-label={`Open ${item.name}`} onClick={event=>{event.stopPropagation();open(item);}}><ExternalLink size={15}/></button></span>
  </div>;
  return <section className="project-workspace" aria-label="Project workspace">
    <nav className="project-section-nav" aria-label="Project sections"><button className="project-history" aria-label="Back in project" disabled={position===0} onClick={()=>travel(-1)}><ArrowLeft size={16}/></button><button className="project-history" aria-label="Forward in project" disabled={position>=history.length-1} onClick={()=>travel(1)}><ArrowRight size={16}/></button>{(['overview','files','client'] as ProjectSection[]).map(tab=><button key={tab} aria-current={section===tab?'page':undefined} onClick={()=>visit(tab)}>{tab==='overview'?'Overview':tab==='files'?'Files':'Client records'}</button>)}</nav>
    <div className="project-pane" hidden={section!=='overview'}><ProjectOverview project={project.id} data={overview} mutate={mutate} openRecord={openRecord}/></div>
    <div className="project-pane" hidden={section!=='client'}><ClientRecords project={project.id} data={clients} items={allItems} overview={overview} mutate={mutate} preview={preview} openOverview={()=>changeSection('overview')} requestedRecord={requestedRecord}/></div>
    <div className="project-pane" hidden={section!=='files'}>{section==='files'&&fileToolbar}
    <div className="project-workspace-toolbar"><div className="project-workspace-location"><button onClick={()=>navigate(null)}>{project.name}</button>{chain.map(folder=><span key={folder.id}> / <button onClick={()=>navigate(folder.id)}>{folder.name}</button></span>)}{scope==='unfiled'&&<span> / Unfiled</span>}</div>
      <div className="project-workspace-actions"><button onClick={addFiles}><Plus size={15}/>Add files</button><button onClick={()=>paste(typeof scope==='number'?scope:null)}>Paste here</button><button onClick={()=>setNewFolder(value=>!value)}><FolderPlus size={15}/>New folder</button>
      <div role="group" aria-label="File layout">{(['details','tiles','columns'] as Layout[]).map(layout=><button key={layout} title={layout} aria-label={`${layout} layout`} aria-pressed={prefs.layout===layout} onClick={()=>save({layout})}>{layout==='details'?<List size={16}/>:layout==='tiles'?<Grid2X2 size={16}/>:<Columns3 size={16}/>}</button>)}</div>
      <details className="project-view-options"><summary>View options</summary><div>{['type','size','modified','rating'].map(column=><label key={column}><input type="checkbox" checked={prefs.columns.includes(column)} onChange={()=>save({columns:prefs.columns.includes(column)?prefs.columns.filter(c=>c!==column):[...prefs.columns,column]})}/>{column}</label>)}<label>Name column<input aria-label="Name column width" type="range" min="180" max="600" value={prefs.nameWidth} onChange={event=>save({nameWidth:Number(event.target.value)})}/></label></div></details></div></div>
    {newFolder&&<form className="project-new-folder" onSubmit={async event=>{event.preventDefault();if(busy||!name.trim())return;setBusy(true);try{await mutate({action:'create_project_folder',target:project.id,name:name.trim(),value:typeof scope==='number'?String(scope):''});setName('');setNewFolder(false);}catch(error){report(error);}finally{setBusy(false);}}}><input aria-label="Folder name" placeholder="Folder name" autoFocus required value={name} onChange={event=>setName(event.target.value)}/><button className="primary" disabled={busy}>Create folder</button><button type="button" onClick={()=>setNewFolder(false)}>Cancel</button></form>}
    <div className={`project-explorer project-explorer-${prefs.layout}`}>
      {prefs.layout==='columns'&&<nav className="project-folder-column" aria-label="Project folder column"><button onClick={()=>navigate(null)}>Project root</button><button {...folderDrop('unfiled')} onClick={()=>navigate('unfiled')}>Unfiled <small>{unfiled.length}</small></button>{orderedFolders(own).map(folder=><button key={folder.id} {...folderDrop(folder.id)} aria-current={scope===folder.id?'page':undefined} onClick={()=>navigate(folder.id)}><Folder size={15}/><span>{folderPath(folder,own)}</span></button>)}</nav>}
      <div className="project-explorer-body">
      {!search&&<div className="project-folder-cards">{scope===null&&<button {...folderDrop('unfiled')} className="project-folder-card" onClick={()=>navigate('unfiled')}><Folder size={24}/><span>Unfiled<small>{unfiled.length} {unfiled.length===1?'item':'items'}</small></span></button>}{visibleFolders.map(folder=><button key={folder.id} {...folderDrop(folder.id)} className="project-folder-card" draggable onDragStart={event=>{event.dataTransfer.setData('application/project-folder',String(folder.id));event.dataTransfer.effectAllowed='move';}} onClick={()=>navigate(folder.id)} onContextMenu={event=>{event.preventDefault();window.dispatchEvent(new CustomEvent('project-folder-context',{detail:{project:project.id,id:folder.id,x:event.clientX,y:event.clientY}}));}}><Folder size={24}/><span>{folder.name}<small>{counts.get(folder.id)??0} items</small></span></button>)}</div>}
      {search&&<p className="project-file-summary">{files.length} matching items</p>}
      {scope===null&&!search&&<p className="project-file-summary">Drop files here to add them to Unfiled, or drop onto a folder.</p>}
      {(scope!==null||search)&&<div className={`project-file-list project-file-list-${prefs.layout}`} role="table" aria-label="Files" style={rowStyle}>
        {prefs.layout!=='tiles'&&<div className="project-file-head" role="row"><button onClick={()=>{setSort('name');setDescending(sort==='name'?!descending:false);}}>Name</button>{prefs.columns.includes('type')&&<button onClick={()=>{setSort('type');setDescending(sort==='type'?!descending:false);}}>Type</button>}{prefs.columns.includes('size')&&<button className="project-file-size" onClick={()=>{setSort('size');setDescending(sort==='size'?!descending:true);}}>Size</button>}{prefs.columns.includes('modified')&&<button className="project-file-date" onClick={()=>{setSort('modified');setDescending(sort==='modified'?!descending:true);}}>Modified</button>}{prefs.columns.includes('rating')&&<span className="project-file-rating">Rating</span>}<span/></div>}
        <div ref={root} className="project-file-rows" style={{height:virtual.getTotalSize()}}>{virtual.getVirtualItems().map(row=><div key={row.key} className="project-file-row" style={{position:'absolute',top:0,left:0,width:'100%',height:rowHeight-(prefs.layout==='tiles'?12:0),transform:`translateY(${row.start-margin}px)`,display:'grid',gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`,gap:12}}>{files.slice(row.index*columns,(row.index+1)*columns).map(renderFile)}</div>)}</div>
        {!files.length&&<div className="project-file-empty">{search?'No matching files.':'No files here yet. Paste or drop files into this folder.'}</div>}
      </div>}
      </div>
    </div>
    </div>
  </section>;
}

export function ProjectFilePreview({item,close}:{item:Item;close:()=>void}) {
  const [data,setData]=useState<{kind:string;path:string;text:string|null;truncated:boolean}|null>(null),[error,setError]=useState('');
  const panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{let current=true;setData(null);setError('');void invoke<NonNullable<typeof data>>('project_file_preview',{id:item.id}).then(value=>{if(current)setData(value);}).catch(error=>{if(current)setError(String(error));});return()=>{current=false;};},[item.id,item.modified]);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;panel.current?.querySelector<HTMLButtonElement>('button')?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}if(event.key==='Tab'){const controls=[...panel.current!.querySelectorAll<HTMLElement>('button,video,audio,object')];if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}}};window.addEventListener('keydown',key,true);return()=>{window.removeEventListener('keydown',key,true);previous?.focus();};},[close]);
  const src=data?convertFileSrc(data.path):'';
  return createPortal(<div className="project-file-preview-backdrop" onClick={close}><div ref={panel} className="project-file-preview" role="dialog" aria-modal="true" aria-label={`Preview ${item.name}`} onClick={event=>event.stopPropagation()}><header><strong>{item.name}</strong><button onClick={()=>void invoke('open_project_file',{id:item.id}).catch(error=>setError(String(error)))}><ExternalLink size={15}/>Open in default app</button><button onClick={()=>void revealItemInDir(item.path).catch(error=>setError(String(error)))}>Reveal in Explorer</button><button aria-label="Close file preview" onClick={close}><X size={18}/></button></header>
    {error&&<p role="alert">{error}</p>}<div className="project-file-preview-content">{!data&&!error?<p>Opening preview…</p>:data?.kind==='text'?<><pre>{data.text}</pre>{data.truncated&&<p>Preview limited to the first 1 MB. Open the file to read the rest.</p>}</>:data?.kind==='pdf'?<object tabIndex={0} data={src} type="application/pdf"><p>Open in the default app to view this PDF.</p></object>:data?.kind==='image'?<img src={src} alt={item.name}/>:data?.kind==='video'?<video src={src} controls onError={()=>setError('This format needs its default app to play.')}/>:data?.kind==='audio'?<audio src={src} controls onError={()=>setError('This format needs its default app to play.')}/>:data?<div className="project-file-unsupported"><File size={42}/><h2>{fileType(item)} file</h2><p>Saved in your project. Open it in its default app to view or edit.</p></div>:null}</div></div></div>,document.body);
}
