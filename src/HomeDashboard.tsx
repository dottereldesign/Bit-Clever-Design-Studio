import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { createPortal } from "react-dom";
import { ArrowUpRight, Grip, MoveDiagonal2, Palette, Plus, SlidersHorizontal, X, Undo2, Folder, Layers, LayoutGrid } from "lucide-react";
import "./homeDashboard.css";

export type HomeDestination={id:string;label:string;kind:"category"|"collection"|"project"|"group";value:string;group:string;count?:number};
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
];
const loadTiles=():HomeTile[]=>{try {const rows=JSON.parse(localStorage.getItem("home-tiles")??"[]");if(!Array.isArray(rows))return [];const seen=new Set<string>();return rows.filter(t=>t&&typeof t.id==="string"&&!seen.has(t.id)&&seen.add(t.id)).slice(0,100).map(t=>({id:t.id,span:Number.isFinite(t.span)?Math.max(2,Math.min(12,t.span)):undefined,height:Number.isFinite(t.height)?Math.max(128,Math.min(512,t.height)):224,radius:Number.isFinite(t.radius)?Math.max(0,Math.min(48,t.radius)):18,cover:t.cover&&typeof t.cover.path==="string"&&Number.isFinite(t.cover.width)&&t.cover.width>0&&Number.isFinite(t.cover.height)&&t.cover.height>0?t.cover:undefined,autoImageSize:t.autoImageSize===true}));}catch{return [];}};
export function homeLayout(tiles:HomeTile[],width:number,height:number){
  const columns=12,gap=Math.min(10,width/40,height/40),unit=Math.max(1,(width-gap*(columns-1))/columns);
  const positions=tiles.map(()=>({left:0,top:0,width:0,height:0}));
  const preferences=tiles.map(tile=>{
    const w=(tile.span??6)*60,h=tile.cover&&tile.autoImageSize?w*tile.cover.height/tile.cover.width:tile.height;
    return {weight:w*Math.max(64,Math.min(900,h)),ratio:Math.max(.25,Math.min(4,w/h))};
  });
  // Partition the entire viewport: tile sizes are relative preferences, never extra scroll height.
  const fill=(start:number,end:number,left:number,top:number,w:number,h:number)=>{
    if(end-start===1){positions[start]={left,top,width:w,height:h};return;}
    const total=preferences.slice(start,end).reduce((sum,p)=>sum+p.weight,0);
    let split=start+1,best=Infinity,weight=0;
    for(let i=start+1;i<end;i++){weight+=preferences[i-1].weight;const score=Math.abs(weight/total-.5);if(score<best){best=score;split=i;}}
    const first=preferences.slice(start,split).reduce((sum,p)=>sum+p.weight,0)/total;
    const preferred=preferences.slice(start,end).reduce((sum,p)=>sum+p.ratio*p.weight,0)/total;
    if(w/h>preferred){const cut=(w-gap)*first;fill(start,split,left,top,cut,h);fill(split,end,left+cut+gap,top,w-cut-gap,h);}
    else{const cut=(h-gap)*first;fill(start,split,left,top,w,cut);fill(split,end,left,top+cut+gap,w,h-cut-gap);}
  };
  if(tiles.length&&width>0&&height>0)fill(0,tiles.length,0,0,width,height);
  return {positions,height,columns,unit,gap};
}
export default function HomeDashboard({destinations,open,incoming,received,dragging=false}:{destinations:HomeDestination[];open:(d:HomeDestination)=>void;incoming?:string|null;received?:()=>void;dragging?:boolean}){
  const [reorderGhost,setReorderGhost]=useState<{id:string;x:number;y:number}|null>(null);
  const suppressTileClick=useRef(false);
  const [tiles,setTiles]=useState(loadTiles),[style,setStyle]=useState(()=>{const n=Number(localStorage.getItem("home-style"));return Number.isInteger(n)&&n>=1&&n<=10?n:1;}),[editing,setEditing]=useState(false),[over,setOver]=useState(false),[stylePicker,setStylePicker]=useState(false),[addPicker,setAddPicker]=useState(false),[group,setGroup]=useState<string|null>(null),[options,setOptions]=useState<string|null>(null),[resizing,setResizing]=useState<string|null>(null),[width,setWidth]=useState(900),[height,setHeight]=useState(600),[undo,setUndo]=useState<HomeTile[][]>([]),[message,setMessage]=useState("");
  const board=useRef<HTMLDivElement>(null),previous=useRef(new Map<string,{left:number;top:number;width:number;height:number}>()),current=useRef(tiles);current.current=tiles;
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;const updated=()=>setTiles(loadTiles());window.addEventListener("home-tiles-updated",updated);return ()=>{mounted.current=false;window.removeEventListener("home-tiles-updated",updated);};},[]);
  const pendingCovers=useRef(new Set<string>());
  const [coverBusy,setCoverBusy]=useState<string[]>([]);
  const resizeCleanup=useRef<()=>void>(()=>{});
  useEffect(()=>()=>resizeCleanup.current(),[]);
  const byId=useMemo(()=>new Map(destinations.map(d=>[d.id,d])),[destinations]);
  const layout=useMemo(()=>homeLayout(tiles,width,height),[tiles,width,height]);
  useEffect(()=>{localStorage.setItem("home-tiles",JSON.stringify(tiles));},[tiles]);
  useEffect(()=>{localStorage.setItem("home-style",String(style));},[style]);
  useLayoutEffect(()=>{const node=board.current;if(!node)return;const measure=()=>{setWidth(node.clientWidth);setHeight(node.clientHeight);};const observer=new ResizeObserver(measure);observer.observe(node);measure();return ()=>observer.disconnect();},[]);
  useLayoutEffect(()=>{
    const next=new Map<string,{left:number;top:number;width:number;height:number}>();
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    tiles.forEach((tile,index)=>{
      const rect=layout.positions[index],old=previous.current.get(tile.id);next.set(tile.id,rect);
      const node=[...board.current?.querySelectorAll<HTMLElement>('[data-home-tile]')??[]].find(n=>n.dataset.homeTile===tile.id);
      if(!node)return;node.getAnimations().forEach(a=>a.cancel());
      if(reduced||tile.id===resizing)return;
      if(old&&(Math.abs(old.left-rect.left)>1||Math.abs(old.top-rect.top)>1||Math.abs(old.width-rect.width)>1||Math.abs(old.height-rect.height)>1)){
        node.animate([{transform: `translate(${old.left-rect.left}px,${old.top-rect.top}px) scale(${old.width/rect.width},${old.height/rect.height})`},{transform:'none'}],{duration:360,easing:'cubic-bezier(.22,1.12,.36,1)'});
      }else if(!old){node.animate([{opacity:0,transform:'translateY(12px) scale(.97)'},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.2,.8,.2,1)'});}
    });previous.current=next;
  },[layout,resizing,tiles]);
  const remember=()=>setUndo(history=>[...history.slice(-19),current.current.map(t=>({...t}))]);
  const change=(next:HomeTile[])=>{remember();setTiles(next);};
  const add=(id:string)=>{const destination=byId.get(id);if(!destination)return;if(current.current.some(t=>t.id===id)){setMessage(`${destination.label} is already on Home.`);return;}change([...current.current,{id,height:224,radius:18}]);setEditing(true);setMessage(`Added ${destination.label}. Drag its corner to resize.`);};
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
      const rows=mounted.current?current.current:loadTiles();
      if(!rows.some(t=>t.id===id))return;
      const span=cover.width/cover.height>1.5?8:cover.width/cover.height<.8?4:6;
      const next=rows.map(t=>t.id===id?{...t,cover,autoImageSize:true,span:t.span??span}:t);
      if(!mounted.current){localStorage.setItem("home-tiles",JSON.stringify(next));window.dispatchEvent(new Event("home-tiles-updated"));return;}
      change(next);setMessage("Tile image updated. The layout has adapted to the image.");setOptions(null);
    }catch(error){setMessage(`Could not use that image. ${error instanceof Error?error.message:String(error)}`);}
    finally{pendingCovers.current.delete(id);if(mounted.current)setCoverBusy([...pendingCovers.current]);}
  };
  const drop=(event:React.DragEvent,index?:number)=>{event.preventDefault();event.stopPropagation();setOver(false);if(event.dataTransfer.files.length){if(index===undefined){setMessage("Drop the image onto an existing tile to replace its cover.");return;}if(event.dataTransfer.files.length!==1){setMessage("Drop one image at a time onto a tile.");return;}void setCover(current.current[index].id,event.dataTransfer.files[0]);return;}const id=event.dataTransfer.getData(homeMime);if(id){add(id);return;}const moving=event.dataTransfer.getData(tileMime);if(moving){const next=[...current.current],from=next.findIndex(t=>t.id===moving);if(from<0)return;const [tile]=next.splice(from,1);next.splice(index??next.length,0,tile);change(next);}};
  const reorder=(event:React.PointerEvent<HTMLButtonElement>,tile:HomeTile)=>{
    if(event.button!==0)return;event.stopPropagation();event.preventDefault();resizeCleanup.current();const x=event.clientX,y=event.clientY,pointerId=event.pointerId,original=current.current;let active=false,last="";
    const clear=()=>{document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',cancel,true);document.removeEventListener('keydown',key,true);setReorderGhost(null);};
    const move=(e:PointerEvent)=>{if(e.pointerId!==pointerId)return;if(!active&&Math.hypot(e.clientX-x,e.clientY-y)<7)return;if(!active){active=true;remember();suppressTileClick.current=true;setEditing(true);}setReorderGhost({id:tile.id,x:e.clientX,y:e.clientY});const id=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-home-tile]')?.dataset.homeTile;if(id&&id!==tile.id&&id!==last){last=id;const next=[...current.current],from=next.findIndex(t=>t.id===tile.id),to=next.findIndex(t=>t.id===id);if(from>=0&&to>=0){const [moving]=next.splice(from,1);next.splice(to,0,moving);setTiles(next);}}};
    const finish=()=>{clear();window.setTimeout(()=>{suppressTileClick.current=false;},300);};
    const up=(e:PointerEvent)=>{if(e.pointerId===pointerId)finish();};const cancel=()=>{if(active)setTiles(original);finish();};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();cancel();}};
    document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',cancel,true);document.addEventListener('keydown',key,true);resizeCleanup.current=clear;
  };
  const resize=(event:React.PointerEvent<HTMLButtonElement>,tile:HomeTile,index:number)=>{event.preventDefault();event.stopPropagation();resizeCleanup.current();remember();setResizing(tile.id);setEditing(true);const x=event.clientX,y=event.clientY,initial=layout.positions[index],pointerId=event.pointerId;
    const move=(e:PointerEvent)=>{if(e.pointerId!==pointerId)return;const span=Math.max(2,Math.min(12,Math.round((tile.span??6)*(1+(e.clientX-x)/initial.width))));const height=Math.max(128,Math.min(512,Math.round((tile.height*(1+(e.clientY-y)/initial.height))/32)*32));setTiles(rows=>rows.map(t=>t.id===tile.id?{...t,span,height,autoImageSize:false}:t));};
    const clear=()=>{document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',end,true);document.removeEventListener('pointercancel',end,true);};const end=()=>{setResizing(null);clear();};resizeCleanup.current=clear;document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true);
  };
  const activate=(d:HomeDestination)=>d.kind==="group"?setGroup(d.value):open(d);
  const modal=stylePicker||addPicker||group!==null;
  const modalRef=useRef<HTMLDivElement>(null),returnFocus=useRef<HTMLElement|null>(null);
  useEffect(()=>{if(modal){returnFocus.current=document.activeElement as HTMLElement;modalRef.current?.focus();}else{returnFocus.current?.focus();returnFocus.current=null;}},[modal]);
  const close=()=>{setStylePicker(false);setAddPicker(false);setGroup(null);};
  return <div onClickCapture={e=>{if(suppressTileClick.current){e.preventDefault();e.stopPropagation();suppressTileClick.current=false;}}} className={`home-dashboard home-style-${style}`} onDragOver={e=>{if(e.dataTransfer.types.includes(homeMime)||e.dataTransfer.types.includes(tileMime)||e.dataTransfer.types.includes("Files")){e.preventDefault();e.dataTransfer.dropEffect=e.dataTransfer.types.includes(tileMime)?"move":"copy";setOver(true);}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOver(false);}} onDrop={e=>drop(e)}>
    <div className="home-toolbar"><h1>Home</h1><div><button onClick={()=>setAddPicker(true)} title="Add a sidebar destination"><Plus size={15}/>Add tile</button><button aria-pressed={editing} onClick={()=>{setEditing(!editing);setOptions(null);}}><LayoutGrid size={14}/>{editing?"Done":"Arrange"}</button><button disabled={!undo.length} aria-label="Undo Home layout change" onClick={()=>{const last=undo.at(-1);if(last){setTiles(last);setUndo(undo.slice(0,-1));}}}><Undo2 size={15}/></button><button onClick={()=>setStylePicker(true)} title="Home styles · 10 variations"><Palette size={15}/>Styles</button></div></div>
    <div className="home-scroll"><div ref={board} className={`home-canvas ${editing||over||dragging?"show-grid":""} ${over?"is-over":""}`} style={{"--grid-unit":`${layout.unit+layout.gap}px`} as React.CSSProperties}>
      {!tiles.length&&<div className="home-empty"><span className="home-empty-mark" aria-hidden="true"><Plus size={22}/></span><p>{over?"Drop to make it yours":"Drag a destination here from the sidebar"}</p><small>Start with just one. Your space will grow with you.</small></div>}
      {tiles.map((tile,index)=>{const destination=byId.get(tile.id),position=layout.positions[index];return <article key={tile.id} data-home-tile={tile.id} data-tile-group={destination?.group??"design"} className={`home-tile ${tile.cover?"has-cover":""} ${coverBusy.includes(tile.id)?"cover-busy":""} ${editing?"is-editing":""} ${resizing===tile.id?"is-resizing":""}`} style={{...position,"--tile-radius":`${tile.radius}px`} as React.CSSProperties} onDragOver={e=>{if(e.dataTransfer.types.includes(tileMime)||e.dataTransfer.types.includes('Files')){e.preventDefault();e.currentTarget.classList.add('tile-drop-target');}}} onDragLeave={e=>e.currentTarget.classList.remove('tile-drop-target')} onDrop={e=>{e.currentTarget.classList.remove('tile-drop-target');drop(e,index);}}>
        <button className="home-tile-open" disabled={!destination} onClick={()=>destination&&activate(destination)} aria-label={`Open ${destination?.label??"unavailable destination"}`}>
          {tile.cover?<img className="home-tile-cover" src={convertFileSrc(tile.cover.path)} alt={destination?.label??"Tile image"} draggable={false}/>:<>
          <span className="home-tile-top"><span>{destination?.group??"Unavailable"}</span><ArrowUpRight size={18}/></span><span className="home-tile-art" aria-hidden="true"><i/><i/><i/></span><span className="home-tile-index" aria-hidden="true">{String(index+1).padStart(2,"0")}</span><span className="home-tile-icon" aria-hidden="true">{destination?.kind==="project"?<Folder size={27}/>:destination?.group==="components"?<Layers size={27}/>:<LayoutGrid size={27}/>}</span>
          <span className="home-tile-title">{destination?.label??"Destination unavailable"}</span><span className="home-tile-count">{destination?.count!==undefined?`${destination.count.toLocaleString()} references`:destination?"Open collection":"Remove this tile or restore its destination"}</span></>}
        </button>
        {coverBusy.includes(tile.id)&&<span className="home-cover-status" role="status">Preparing image…</span>}
        <div className="home-tile-tools"><button draggable={false} onPointerDown={e=>reorder(e,tile)} onDragStart={e=>{e.stopPropagation();e.dataTransfer.setData(tileMime,tile.id);e.dataTransfer.effectAllowed="move";setEditing(true);}} aria-label={`Rearrange ${destination?.label??"tile"}`} title="Drag to rearrange; use arrow keys to reorder" onKeyDown={e=>{if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(e.key)){e.preventDefault();const next=[...tiles],to=Math.max(0,Math.min(tiles.length-1,index+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)));next.splice(index,1);next.splice(to,0,tile);change(next);}}}><Grip size={14}/></button><button aria-label={`Shape and size ${destination?.label??"tile"}`} onClick={()=>setOptions(options===tile.id?null:tile.id)}><SlidersHorizontal size={14}/></button><button aria-label={`Remove ${destination?.label??"tile"} from Home`} onClick={()=>{change(tiles.filter(t=>t.id!==tile.id));setOptions(null);}}><X size={14}/></button></div>
        {options===tile.id&&<div className="home-tile-options"><span>Size</span><div>{([['Small',3,160],['Wide',8,192],['Tall',4,352],['Large',8,352]] as const).map(([label,span,height])=><button key={label} onClick={()=>change(tiles.map(t=>t.id===tile.id?{...t,span,height,autoImageSize:false}:t))}>{label}</button>)}</div><span>Shape</span><div>{([['Square',0],['Soft',18],['Round',48]] as const).map(([label,radius])=><button key={label} aria-pressed={tile.radius===radius} onClick={()=>change(tiles.map(t=>t.id===tile.id?{...t,radius}:t))}>{label}</button>)}</div><label className="home-cover-input">{tile.cover?"Replace image":"Add image"}<input type="file" accept="image/*" disabled={coverBusy.includes(tile.id)} onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void setCover(tile.id,file);e.currentTarget.value="";}}/></label>{tile.cover&&<button onClick={()=>{change(tiles.map(t=>t.id===tile.id?{...t,cover:undefined,autoImageSize:false}:t));setOptions(null);}}>Remove image</button>}<button onClick={()=>setOptions(null)}>Done</button></div>}
        <button className="home-resize" aria-label={`Resize ${destination?.label??"tile"}`} title="Drag to resize; arrow keys adjust size" onPointerDown={e=>resize(e,tile,index)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();change(tiles.map(t=>t.id===tile.id?{...t,span:Math.max(2,Math.min(12,(t.span??(tiles.length===1?12:tiles.length===2||tiles.length===4?6:4))+(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0))),autoImageSize:false,height:Math.max(128,Math.min(512,t.height+(e.key==='ArrowUp'?-32:e.key==='ArrowDown'?32:0)))}:t));}}}><MoveDiagonal2 size={14}/></button>
      </article>;})}
    </div><p className="home-status" role="status">{message}</p></div>
    {reorderGhost&&createPortal(<div className="home-drag-ghost" style={{left:reorderGhost.x+14,top:reorderGhost.y+16}}><Grip size={14}/>{byId.get(reorderGhost.id)?.label}<small>Rearrange</small></div>,document.body)}
    {modal&&createPortal(<div className="home-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={stylePicker?"Home styles":"Choose a destination"} className="home-picker" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')close();if(e.key==='Tab'){const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===modalRef.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}><header><div><span className="home-picker-eyebrow">{stylePicker?"HOME / TEN DIRECTIONS":"YOUR SIDEBAR, WITH ROOM TO BREATHE"}</span><h2>{stylePicker?"Find your kind of space.":group?group==="projects"?"Your projects":"General":"Add to Home"}</h2><p>{stylePicker?"Same layout. Ten completely different moods.":"Choose a destination, or drag it here from the sidebar."}</p></div><button aria-label="Close Home chooser" onClick={close}><X size={20}/></button></header>
      {stylePicker?<div className="home-style-choices">{homeStyles.map(([name,description],i)=><button key={name} className={`home-style-choice home-style-${i+1}`} aria-pressed={style===i+1} onClick={()=>{setStyle(i+1);close();}}><div className="home-style-mini"><div className="home-tile" data-tile-group="design"><span className="home-tile-index">01</span><span className="home-tile-title">Inspiration</span></div><div className="home-tile" data-tile-group="components"><span className="home-tile-index">02</span><span className="home-tile-title">Components</span></div></div><strong>{String(i+1).padStart(2,'0')} / {name}</strong><small>{description}</small></button>)}</div>:<div className="home-destination-list">{destinations.filter(d=>group?d.group===group&&d.kind!=="group":true).map(d=><button key={d.id} disabled={!group&&tiles.some(t=>t.id===d.id)} onClick={()=>{if(group){close();open(d);}else{add(d.id);close();}}}><span>{d.label}</span><small>{group?"Open":tiles.some(t=>t.id===d.id)?"Added":d.group}</small></button>)}{group&&!destinations.some(d=>d.group===group&&d.kind!=="group")&&<p>No destinations here yet. Create a project in the sidebar to get started.</p>}</div>}
    </div></div>,document.body)}
  </div>;
}
