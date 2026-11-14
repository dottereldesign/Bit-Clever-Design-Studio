import {recordError} from './diagnostics';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { convertFileSrc, invoke } from "./diagnostics";
import { createPortal } from "react-dom";
import { ArrowUpRight, Grip, Palette, Plus, SlidersHorizontal, X, Folder, Layers, LayoutGrid } from "lucide-react";
import "./homeDashboard.css";
import { appHistory } from "./appHistory";
import { useHistoryState, HistoryButtons } from "./useAppHistory";
import HomeTileLabel from "./HomeTileLabel";
import { AppIcon,type IconPreferences } from "./AppIcon";
import type { HomeAppearance } from "./Customization";
import { homeLayout, moveDivider, type HomePlan, type Divider } from "./homeLayout";
export { homeLayout } from "./homeLayout";
const loadPlan=():HomePlan|null=>{try{return JSON.parse(localStorage.getItem("home-plan")??"null");}catch{return null;}};

export type HomeDestination={id:string;label:string;kind:"category"|"collection"|"project"|"group"|"studio";value:string;group:string;count?:number};
export type HomeCover={path:string;width:number;height:number};
export type HomeTile={id:string;span?:number;height:number;radius:number;cover?:HomeCover;autoImageSize?:boolean};
export const homeMime="application/design-home-destination";
const tileMime="application/design-home-tile";
export const homeStyles=[
  ["Paper gallery","Warm paper, editorial serif titles."],
  ["Chromatic","Confident colour, oversized typography."],
  ["Cloud glass","Soft gradients and translucent surfaces."],
  ["Night console","Dark instruments and luminous details."],
  ["Archive","Tabbed folders and tactile paper layers."],
  ["Playground","Punchy outlines and offset shadows."],
  ["Departure","Numbered tickets and perforated edges."],
  ["Orbit","Deep colour and atmospheric light."],
  ["Swiss board","Graphic numbers and sharp rules."],
  ["Soft studio","Sculpted surfaces and quiet depth."],
  ["Porcelain","A clean surface with a bold corner of colour."],
  ["Ink stamp","Black and white, generous type."],
  ["Citrus","Bright curved shapes and playful colour."],
  ["Clay","Warm earth tones and soft inset surfaces."],
  ["Ocean","Deep sea colour with a luminous horizon."],
  ["Vellum","Layered translucent paper."],
  ["Blueprint","A fine grid with technical lettering."],
  ["Monograph","Large editorial type on warm ivory."],
  ["Lilac ribbon","Pastel surfaces and a broad ribbon of light."],
  ["Ember","Dark warm surfaces with a glowing edge."],
];
const loadTiles=():HomeTile[]=>{try {const rows=JSON.parse(localStorage.getItem("home-tiles")??"[]");if(!Array.isArray(rows))return [];const seen=new Set<string>();return rows.filter(t=>t&&typeof t.id==="string"&&!seen.has(t.id)&&seen.add(t.id)).slice(0,100).map(t=>({id:t.id,span:Number.isFinite(t.span)?Math.max(2,Math.min(12,t.span)):undefined,height:Number.isFinite(t.height)?Math.max(128,Math.min(512,t.height)):224,radius:Number.isFinite(t.radius)?Math.max(0,Math.min(48,t.radius)):18,cover:t.cover&&typeof t.cover.path==="string"&&Number.isFinite(t.cover.width)&&t.cover.width>0&&Number.isFinite(t.cover.height)&&t.cover.height>0?t.cover:undefined,autoImageSize:t.autoImageSize===true}));}catch{return [];}};
export default function HomeDashboard({destinations,open,incoming,received,dragging=false,style,appearance,customize,icons,headerActions,summary,summaryShare=50}:{summary?:ReactNode;summaryShare?:number;headerActions?:ReactNode;icons:IconPreferences;style:number;appearance:HomeAppearance;customize:()=>void;destinations:HomeDestination[];open:(d:HomeDestination)=>void;incoming?:string|null;received?:()=>void;dragging?:boolean}){
  const [reorderGhost,setReorderGhost]=useState<{id:string;x:number;y:number}|null>(null);
  const [dropTarget,setDropTarget]=useState<string|null>(null),[plan,,setPlan]=useHistoryState<HomePlan|null>("home-plan",loadPlan,"Home layout");
  const suppressTileClick=useRef(false);
  const [removePending,setRemovePending]=useState<string|null>(null);
  const removeTrigger=useRef<HTMLButtonElement|null>(null);
  const cancelRemoval=()=>{setRemovePending(null);requestAnimationFrame(()=>removeTrigger.current?.isConnected&&removeTrigger.current.focus());};
  const [tiles,,setTiles]=useHistoryState("home-tiles",loadTiles,"Home tiles"),[editing,setEditing]=useState(false),[over,setOver]=useState(false),[addPicker,setAddPicker]=useState(false),[group,setGroup]=useState<string|null>(null),[options,setOptions]=useState<string|null>(null),[resizing,setResizing]=useState<string|null>(null),[width,setWidth]=useState(0),[height,setHeight]=useState(0),[message,setMessage]=useState("");
  const board=useRef<HTMLDivElement>(null),previous=useRef(new Map<string,{left:number;top:number;width:number;height:number}>()),current=useRef(tiles);current.current=tiles;
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;const updated=()=>setTiles(loadTiles());window.addEventListener("home-tiles-updated",updated);return ()=>{mounted.current=false;window.removeEventListener("home-tiles-updated",updated);};},[]);
  const pendingCovers=useRef(new Set<string>());
  const [coverBusy,setCoverBusy]=useState<string[]>([]);
  const resizeCleanup=useRef<()=>void>(()=>{});
  useEffect(()=>()=>resizeCleanup.current(),[]);
  const byId=useMemo(()=>new Map(destinations.map(d=>[d.id,d])),[destinations]);
  const layout=useMemo(()=>homeLayout(tiles,width,height,plan,appearance.gap),[tiles,width,height,plan,appearance.gap]);
  const planRef=useRef(layout.plan);planRef.current=layout.plan;
  useEffect(()=>{if(width>0&&height>0&&(!plan||plan.count!==tiles.length))setPlan(layout.plan);},[layout,width,height,plan,tiles.length]);
  useEffect(()=>{if(!resizing){localStorage.setItem("home-tiles",JSON.stringify(tiles));localStorage.setItem("home-plan",JSON.stringify(plan));}},[tiles,plan,resizing]);
  useLayoutEffect(()=>{const node=board.current;if(!node)return;const measure=()=>{setWidth(node.clientWidth);setHeight(node.clientHeight);};const observer=new ResizeObserver(measure);observer.observe(node);measure();return ()=>observer.disconnect();},[]);
  useLayoutEffect(()=>{
    const next=new Map<string,{left:number;top:number;width:number;height:number}>();
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduce';
    tiles.forEach((tile,index)=>{
      const rect=layout.positions[index],old=previous.current.get(tile.id);next.set(tile.id,rect);
      const node=[...board.current?.querySelectorAll<HTMLElement>('[data-home-tile]')??[]].find(n=>n.dataset.homeTile===tile.id);
      if(!node)return;node.getAnimations().forEach(a=>a.cancel());
      if(reduced||resizing)return;
      if(old&&old.width>0&&old.height>0&&(Math.abs(old.left-rect.left)>1||Math.abs(old.top-rect.top)>1||Math.abs(old.width-rect.width)>1||Math.abs(old.height-rect.height)>1)){
        node.animate([{transform: `translate(${old.left-rect.left}px,${old.top-rect.top}px) scale(${old.width/rect.width},${old.height/rect.height})`},{transform:'none'}],{duration:380,easing:'cubic-bezier(.32,0,.2,1)'});
      }
    });previous.current=next;
  },[layout,resizing,tiles]);
  const change=(next:HomeTile[],rebalance=false)=>{
    const beforeTiles=appHistory.read('home-tiles',loadTiles),beforePlan=appHistory.read('home-plan',loadPlan);
    const nextPlan=rebalance||next.length!==beforeTiles.length?width>0&&height>0?homeLayout(next,width,height,null,appearance.gap).plan:null:beforePlan;
    appHistory.commit('Home tiles',{'home-tiles':beforeTiles,'home-plan':beforePlan},{'home-tiles':next,'home-plan':nextPlan});
  };
  const changePlan=(next:HomePlan)=>appHistory.commit('Resize Home tiles',{'home-plan':planRef.current},{'home-plan':next});
  const add=(id:string)=>{const destination=byId.get(id);if(!destination)return;if(current.current.some(t=>t.id===id)){setMessage(`${destination.label} is already on Home.`);return;}change([...current.current,{id,height:224,radius:18}]);setEditing(true);setMessage(`Added ${destination.label}. Drag the gaps to resize. Drag a tile to move it.`);};
  useEffect(()=>{if(incoming){add(incoming);received?.();}},[incoming]);
  const setCover=async(id:string,file:File)=>{
    if(pendingCovers.current.has(id))return;
    if(file.size>50*1024*1024){setMessage("Choose an image smaller than 50 MB.");return;}
    pendingCovers.current.add(id);setCoverBusy([...pendingCovers.current]);
    try {
      const bitmap=await createImageBitmap(file);const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
      const context=canvas.getContext('2d');if(!context){bitmap.close();throw Error("Image preview unavailable.");}context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error("Could not resize this image.")),"image/webp",.9));
      const cover=await invoke<HomeCover>("save_home_cover",{bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))});
      const rows=appHistory.read('home-tiles',loadTiles);
      if(!rows.some(t=>t.id===id))return;
      const span=cover.width/cover.height>1.5?8:cover.width/cover.height<.8?4:6;
      const next=rows.map(t=>t.id===id?{...t,cover,autoImageSize:true,span:t.span??span}:t);
      if(!mounted.current){change(next);return;}
      change(next);setMessage("Tile image updated. The layout has adapted to the image.");setOptions(null);
    }catch(error){recordError('home.cover',error);setMessage(`Could not use that image. ${error instanceof Error?error.message:String(error)}`);}
    finally{pendingCovers.current.delete(id);if(mounted.current)setCoverBusy([...pendingCovers.current]);}
  };
  const drop=(event:React.DragEvent,index?:number)=>{event.preventDefault();event.stopPropagation();setOver(false);if(event.dataTransfer.files.length){if(index===undefined){setMessage("Drop the image onto an existing tile to replace its cover.");return;}if(event.dataTransfer.files.length!==1){setMessage("Drop one image at a time onto a tile.");return;}void setCover(current.current[index].id,event.dataTransfer.files[0]);return;}const id=event.dataTransfer.getData(homeMime);if(id){add(id);return;}const moving=event.dataTransfer.getData(tileMime);if(moving){const next=[...current.current],from=next.findIndex(t=>t.id===moving);if(from<0)return;const [tile]=next.splice(from,1);next.splice(index??next.length,0,tile);change(next);}};
  const reorder=(event:React.PointerEvent<HTMLElement>,tile:HomeTile)=>{
    if(event.button!==0)return;event.stopPropagation();event.preventDefault();resizeCleanup.current();setOptions(null);
    const x=event.clientX,y=event.clientY,pointerId=event.pointerId,original=current.current;let active=false,target:string|null=null;
    const bounds=board.current!.getBoundingClientRect(),slots=layout.positions;
    const clear=()=>{resizeCleanup.current=()=>{};appHistory.cancelGesture=null;document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',cancel,true);document.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);setReorderGhost(null);setDropTarget(null);};
    const move=(e:PointerEvent)=>{if(e.pointerId!==pointerId)return;if(!active&&Math.hypot(e.clientX-x,e.clientY-y)<7)return;active=true;suppressTileClick.current=true;
      setReorderGhost({id:tile.id,x:e.clientX,y:e.clientY});
      const px=e.clientX-bounds.left,py=e.clientY-bounds.top,index=slots.findIndex(r=>px>=r.left&&px<=r.left+r.width&&py>=r.top&&py<=r.top+r.height);
      target=index>=0&&original[index].id!==tile.id?original[index].id:null;setDropTarget(target);
    };
    const finish=()=>{clear();window.setTimeout(()=>{suppressTileClick.current=false;},300);};
    const up=(e:PointerEvent)=>{if(e.pointerId!==pointerId)return;move(e);if(active&&target){const next=[...original],a=next.findIndex(t=>t.id===tile.id),b=next.findIndex(t=>t.id===target);[next[a],next[b]]=[next[b],next[a]];change(next);}finish();};
    const cancel=()=>finish();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();cancel();}};
    appHistory.cancelGesture=cancel;document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',cancel,true);document.addEventListener('keydown',key,true);window.addEventListener('blur',cancel);resizeCleanup.current=cancel;
  };
  const resize=(event:React.PointerEvent<HTMLDivElement>,divider:Divider)=>{
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();resizeCleanup.current();setOptions(null);
    const pointerId=event.pointerId,start=divider.axis==='x'?event.clientX:event.clientY,original=planRef.current;
    let frame=0,pending:HomePlan=original,moved=false;
    const oldCursor=document.body.style.cursor;document.body.style.cursor=divider.axis==='x'?'col-resize':'row-resize';document.body.classList.add('home-resizing');setResizing(divider.path);
    const flush=()=>{frame=0;setPlan(pending);};
    const move=(e:PointerEvent)=>{if(e.pointerId!==pointerId)return;const delta=(divider.axis==='x'?e.clientX:e.clientY)-start;if(Math.abs(delta)>1)moved=true;pending=moveDivider(original,divider,delta,e.altKey);if(!frame)frame=requestAnimationFrame(flush);};
    const clear=()=>{resizeCleanup.current=()=>{};appHistory.cancelGesture=null;cancelAnimationFrame(frame);document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',cancel,true);document.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);document.body.style.cursor=oldCursor;document.body.classList.remove('home-resizing');setResizing(null);};
    const up=(e:PointerEvent)=>{if(e.pointerId!==pointerId)return;move(e);if(moved){appHistory.commit('Resize Home tiles',{'home-plan':original},{'home-plan':pending});}else setPlan(original);clear();};
    const cancel=()=>{setPlan(original);clear();};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();cancel();}};
    appHistory.cancelGesture=cancel;document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',cancel,true);document.addEventListener('keydown',key,true);window.addEventListener('blur',cancel);resizeCleanup.current=cancel;
  };
  const activate=(d:HomeDestination)=>d.kind==="group"?setGroup(d.value):open(d);
  const modal=addPicker||group!==null;
  const modalRef=useRef<HTMLDivElement>(null),returnFocus=useRef<HTMLElement|null>(null);
  useEffect(()=>{if(modal){returnFocus.current=document.activeElement as HTMLElement;modalRef.current?.focus();}else{returnFocus.current?.focus();returnFocus.current=null;}},[modal]);
  const close=()=>{setAddPicker(false);setGroup(null);};
  return <div onClickCapture={e=>{if(suppressTileClick.current){e.preventDefault();e.stopPropagation();suppressTileClick.current=false;}}} data-drag-anywhere={appearance.dragAnywhere} className={`home-dashboard home-style-${style} ${appearance.labels?"has-label-overlays":""}`} style={{"--home-overlay":appearance.darkness/100,"--home-label-size":`${appearance.textSize}px`} as React.CSSProperties} onDragOver={e=>{if(e.dataTransfer.types.includes(homeMime)||e.dataTransfer.types.includes(tileMime)||e.dataTransfer.types.includes("Files")){e.preventDefault();e.dataTransfer.dropEffect=e.dataTransfer.types.includes(tileMime)?"move":"copy";setOver(true);}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOver(false);}} onDrop={e=>drop(e)}>
    <div className="home-toolbar"><h1>Home</h1><div>{headerActions}<button onClick={()=>setAddPicker(true)} title="Add a sidebar destination"><Plus size={15}/>Add tile</button><button aria-pressed={editing} onClick={()=>{setEditing(!editing);setOptions(null);}}><LayoutGrid size={14}/>{editing?"Done":"Arrange"}</button><HistoryButtons home/><button onClick={customize} title="Customise Home"><Palette size={15}/>Customise</button></div></div>
    <div className="home-body" data-overview={!!summary} style={{"--overview-share":`${summaryShare}fr`,"--tiles-share":`${100-summaryShare}fr`} as React.CSSProperties}>{summary}
    <div className="home-scroll"><div ref={board} className={`home-canvas ${editing||over||dragging?"show-grid":""} ${over?"is-over":""}`} style={{"--grid-unit":`${layout.unit+layout.gap}px`} as React.CSSProperties}>
      {!tiles.length&&<div className="home-empty"><span className="home-empty-mark" aria-hidden="true"><Plus size={22}/></span><p>{over?"Drop to make it yours":"Drag a destination here from the sidebar"}</p><small>Start with just one. Your space will grow with you.</small></div>}
      {tiles.map((tile,index)=>{const destination=byId.get(tile.id),position=layout.positions[index];return <article key={tile.id} data-home-tile={tile.id} data-home-edges={[position.top<1?"top":"",position.left<1?"left":"",position.left+position.width>=width-1?"right":"",position.top+position.height>=height-1?"bottom":""].filter(Boolean).join(" ")} data-tile-group={destination?.group??"design"} className={`home-tile ${tile.cover?"has-cover":""} ${coverBusy.includes(tile.id)?"cover-busy":""} ${editing?"is-editing":""} ${reorderGhost?.id===tile.id?"is-lifted":""} ${dropTarget===tile.id?"is-swap-target":""}`} id={`home-slot-${index}`} style={{...position,"--tile-radius":`${tile.radius}px`} as React.CSSProperties} onDragOver={e=>{if(e.dataTransfer.types.includes(tileMime)||e.dataTransfer.types.includes('Files')){e.preventDefault();e.currentTarget.classList.add('tile-drop-target');}}} onDragLeave={e=>e.currentTarget.classList.remove('tile-drop-target')} onDrop={e=>{e.currentTarget.classList.remove('tile-drop-target');drop(e,index);}}>
        <button className="home-tile-open" onPointerDown={e=>{if(appearance.dragAnywhere)reorder(e,tile);}} disabled={!destination} onClick={()=>destination&&activate(destination)} aria-label={`Open ${destination?.label??"unavailable destination"}`}>
          {tile.cover?<img className="home-tile-cover" src={convertFileSrc(tile.cover.path)} alt={destination?.label??"Tile image"} draggable={false}/>:<>
          <span className="home-tile-top"><span>{destination?.group??"Unavailable"}</span><ArrowUpRight size={18}/></span><span className="home-tile-art" aria-hidden="true"><i/><i/><i/></span><span className="home-tile-index" aria-hidden="true">{String(index+1).padStart(2,"0")}</span><span className="home-tile-icon" aria-hidden="true"><AppIcon size={27} value={icons.overrides[tile.id]??(tile.id==='category:All Components'?icons.overrides.components:undefined)} fallback={destination?.kind==="project"?<Folder size={27}/>:destination?.group==="components"?<Layers size={27}/>:<LayoutGrid size={27}/>}/></span>
          <span className="home-tile-title">{destination?.label??"Destination unavailable"}</span><span className="home-tile-count">{destination?.count!==undefined?`${destination.count.toLocaleString()} references`:destination?"Open collection":"Remove this tile or restore its destination"}</span></>}
          {appearance.labels&&<><span className="home-tile-scrim" aria-hidden="true"/><HomeTileLabel label={destination?.label??"Destination unavailable"} scale={appearance.textSize/32}/></>}
        </button>
        {coverBusy.includes(tile.id)&&<span className="home-cover-status" role="status">Preparing image…</span>}
        <div className="home-tile-tools"><button draggable={false} onPointerDown={e=>reorder(e,tile)} onDragStart={e=>{e.stopPropagation();e.dataTransfer.setData(tileMime,tile.id);e.dataTransfer.effectAllowed="move";setEditing(true);}} aria-label={`Rearrange ${destination?.label??"tile"}`} title="Drag to rearrange; use arrow keys to reorder" onKeyDown={e=>{if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(e.key)){e.preventDefault();const next=[...tiles],to=Math.max(0,Math.min(tiles.length-1,index+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)));next.splice(index,1);next.splice(to,0,tile);change(next);}}}><Grip size={14}/></button><button aria-label={`Shape and size ${destination?.label??"tile"}`} onClick={()=>setOptions(options===tile.id?null:tile.id)}><SlidersHorizontal size={14}/></button><button className="home-remove" aria-label={`Remove ${destination?.label??"tile"} from Home`} onClick={e=>{removeTrigger.current=e.currentTarget;setRemovePending(tile.id);setOptions(null);}}><X size={14}/></button></div>
        {options===tile.id&&<div className="home-tile-options"><span>Size</span><div>{([['Small',3,160],['Wide',8,192],['Tall',4,352],['Large',8,352]] as const).map(([label,span,height])=><button key={label} onClick={()=>change(tiles.map(t=>t.id===tile.id?{...t,span,height,autoImageSize:false}:t),true)}>{label}</button>)}</div><span>Shape</span><div>{([['Square',0],['Soft',18],['Round',48]] as const).map(([label,radius])=><button key={label} aria-pressed={tile.radius===radius} onClick={()=>change(tiles.map(t=>t.id===tile.id?{...t,radius}:t))}>{label}</button>)}</div><label className="home-cover-input">{tile.cover?"Replace image":"Add image"}<input type="file" accept="image/*" disabled={coverBusy.includes(tile.id)} onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void setCover(tile.id,file);e.currentTarget.value="";}}/></label>{tile.cover&&<button onClick={()=>{change(tiles.map(t=>t.id===tile.id?{...t,cover:undefined,autoImageSize:false}:t));setOptions(null);}}>Remove image</button>}<button onClick={()=>setOptions(null)}>Done</button></div>}
        {dropTarget===tile.id&&<div className="home-swap-preview"><span>Release to swap</span></div>}
      </article>;})}
      {layout.dividers.map(divider=><div key={divider.path} role="separator" tabIndex={0} aria-label={`Resize ${byId.get(tiles[divider.primary].id)?.label??'tiles'}`} aria-controls={`home-slot-${divider.primary}`} aria-orientation={divider.axis==='x'?'vertical':'horizontal'} aria-valuemin={Math.round(divider.min*100)} aria-valuemax={Math.round(divider.max*100)} aria-valuenow={Math.round(divider.ratio*100)} data-home-divider={divider.path} className={`home-divider axis-${divider.axis} ${resizing===divider.path?'is-active':''} ${editing?'is-editing':''}`} style={{left:divider.left,top:divider.top,width:divider.width,height:divider.height}} title="Drag to resize · Double-click to balance · Alt for precision" onPointerDown={e=>resize(e,divider)} onDoubleClick={()=>{changePlan({...layout.plan,splits:{...layout.plan.splits,[divider.path]:{...layout.plan.splits[divider.path],ratio:.5}}});}} onKeyDown={e=>{const keys=divider.axis==='x'?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'];if(keys.includes(e.key)){e.preventDefault();changePlan(moveDivider(layout.plan,divider,(keys.indexOf(e.key)?1:-1)*(e.shiftKey?32:8),true));}}}><span/></div>)}
    </div>{!removePending&&<p className="home-status" role="status">{message}</p>}
      {removePending&&<div className="home-remove-confirm" role="alertdialog" aria-label="Confirm tile removal" aria-describedby="home-remove-question" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancelRemoval();}}}>
        <span id="home-remove-question">Remove {byId.get(removePending)?.label??"this tile"} from Home?</span>
        <button className="confirm-remove" onClick={()=>{change(current.current.filter(t=>t.id!==removePending));setRemovePending(null);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[aria-label="Undo Home layout change"]')?.focus());}}>Remove</button>
        <button autoFocus onClick={cancelRemoval}>Cancel</button>
      </div>}
    </div>
    </div>
    {reorderGhost&&createPortal(<div className="home-drag-ghost home-tile-ghost" style={{left:reorderGhost.x+14,top:reorderGhost.y+16}}><Grip size={14}/>{byId.get(reorderGhost.id)?.label}<small>{dropTarget?"Release to swap":"Move over another tile"}</small>{current.current.find(t=>t.id===reorderGhost.id)?.cover&&<img src={convertFileSrc(current.current.find(t=>t.id===reorderGhost.id)!.cover!.path)} alt=""/>}</div>,document.body)}
    {modal&&createPortal(<div className="home-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Choose a destination" className="home-picker" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')close();if(e.key==='Tab'){const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===modalRef.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}><header><div><h2>{group?group==="projects"?"Your projects":"General":"Add to Home"}</h2></div><button aria-label="Close Home chooser" onClick={close}><X size={20}/></button></header>
      {<div className="home-destination-list">{destinations.filter(d=>group?d.group===group&&d.kind!=="group":true).map(d=><button key={d.id} disabled={!group&&tiles.some(t=>t.id===d.id)} onClick={()=>{if(group){close();open(d);}else{add(d.id);close();}}}><span>{d.label}</span><small>{group?"Open":tiles.some(t=>t.id===d.id)?"Added":d.group}</small></button>)}{group&&!destinations.some(d=>d.group===group&&d.kind!=="group")&&<p>No destinations here yet. Create a project in the sidebar to get started.</p>}</div>}
    </div></div>,document.body)}
  </div>;
}
