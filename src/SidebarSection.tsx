import { createPortal } from "react-dom";
import { SectionColourControl, useSectionColours, sectionColourStyle } from "./SectionColours";
import { useState, type ReactNode, type HTMLAttributes } from "react";
import { useHistoryState } from "./useAppHistory";
import { ChevronDown, ChevronRight, Palette, Blocks, LayoutGrid, FolderOpen, Megaphone, Users, BookOpen } from "lucide-react";

export default function SidebarSection({name, label = name, action, children, nested = false, dropProps, styleId, identity, preview = false, icon, onOpen, reorder}: {
  reorder?:{up?:()=>void;down?:()=>void}; onOpen?:()=>void; icon?:ReactNode; styleId?:number; identity?:"design"|"components"|"general"|"projects"|"marketing"|"leads"|"research"; preview?:boolean; name: string; label?: string; action?: ReactNode; children: ReactNode; nested?: boolean; dropProps?: HTMLAttributes<HTMLDivElement> & {"data-category"?:string; "data-section-label"?:string};
}) {
  const [colours]=useSectionColours();
  const [colourMenu,setColourMenu]=useState<{x:number;y:number}|null>(null);
  const identities={research:{number:"07",kicker:"Knowledge",Icon:BookOpen},marketing:{number:"01",kicker:"Campaigns",Icon:Megaphone},leads:{number:"02",kicker:"Relationships",Icon:Users},general:{number:"04",kicker:"Workspace",Icon:LayoutGrid},projects:{number:"03",kicker:"Client work",Icon:FolderOpen},design:{number:"05",kicker:"Visual library",Icon:Palette},components:{number:"06",kicker:"Interface library",Icon:Blocks}};
  const treatment=identity?identities[identity]:null;
  const key = "sidebar-open:" + name;
  const [open, setOpen, setPreview] = useHistoryState(key,() => {
    const saved = preview?"false":localStorage.getItem(key);
    return saved === null ? (identity==="marketing"||identity==="leads"||identity==="research"?false:!nested) : saved === "true";
  },`${label} section visibility`);
  return <section style={identity?sectionColourStyle(identity,colours,styleId??1):undefined} data-custom-colour={identity&&colours[identity]?true:undefined} data-section={name} className={`${icon?"has-custom-icon":""} ${nested ? "folder-group" : "sidebar-section"} ${identity?`section-feature section-style-${styleId??1} section-${identity}`:""}`} data-open={open}>
    <div {...dropProps} onContextMenu={identity&&!preview?e=>{e.preventDefault();setColourMenu({x:Math.min(e.clientX,window.innerWidth-290),y:Math.min(e.clientY,window.innerHeight-250)});}:dropProps?.onContextMenu} className={`${nested ? "folder-heading" : "sidebar-heading"} ${dropProps?.className??""}`}>
      <button title={reorder?"Drag to reorder · Alt+↑/↓ to move":undefined} className="section-toggle" aria-label={label} aria-expanded={open} onClick={() => {
        if(preview)setPreview(!open);else {setOpen(!open);onOpen?.();}
      }}>
        {identity?<>
          <span className="section-number" aria-hidden="true">{treatment?.number}</span>
          <span className="section-emblem" aria-hidden="true">{icon??(treatment&&<treatment.Icon size={17}/>)}</span>
          <span className="section-copy"><span className="section-kicker" aria-hidden="true">{treatment?.kicker}</span><span className="section-title">{label}</span></span>
          <ChevronRight className="section-chevron" size={14} aria-hidden="true"/>
        </>:<>{open ? <ChevronDown size={13}/> : <ChevronRight size={13}/>} {icon} {label}</>}
      </button>
      {onOpen&&<button className="icon-button" aria-label={`Toggle ${label}`} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<ChevronDown size={13}/>:<ChevronRight size={13}/>}</button>}
      {action}
    </div>
    {identity?<div className="section-reveal" aria-hidden={!open} inert={!open}><div className="section-reveal-inner">{identity==="general"||identity==="projects"||identity==="marketing"||identity==="leads"||identity==="research"?<div className="sidebar-section-body">{children}</div>:children}</div></div>:open&&(nested?children:<div className="sidebar-section-body">{children}</div>)}
    {colourMenu&&identity&&createPortal(<div className="section-colour-dismiss" onMouseDown={()=>setColourMenu(null)} onKeyDown={e=>{if(e.key==='Escape')setColourMenu(null);}}><div role="dialog" aria-label={`${label} colour`} className="section-colour-menu" style={{left:colourMenu.x,top:colourMenu.y}} onMouseDown={e=>e.stopPropagation()}>{reorder&&<div className="sidebar-reorder-actions"><button disabled={!reorder.up} onClick={()=>{reorder.up?.();setColourMenu(null);}}>Move up</button><button disabled={!reorder.down} onClick={()=>{reorder.down?.();setColourMenu(null);}}>Move down</button></div>}<SectionColourControl identity={identity}/><button autoFocus onClick={()=>setColourMenu(null)}>Done</button></div></div>,document.body)}
  </section>;
}
