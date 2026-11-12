import { type ReactNode, type HTMLAttributes } from "react";
import { useHistoryState } from "./useAppHistory";
import { ChevronDown, ChevronRight, Palette, Blocks, LayoutGrid, FolderOpen } from "lucide-react";

export default function SidebarSection({name, label = name, action, children, nested = false, dropProps, styleId, identity, preview = false, icon}: {
  icon?:ReactNode; styleId?:number; identity?:"design"|"components"|"general"|"projects"; preview?:boolean; name: string; label?: string; action?: ReactNode; children: ReactNode; nested?: boolean; dropProps?: HTMLAttributes<HTMLDivElement> & {"data-category"?:string; "data-section-label"?:string};
}) {
  const identities={general:{number:"01",kicker:"Workspace",Icon:LayoutGrid},projects:{number:"02",kicker:"Client work",Icon:FolderOpen},design:{number:"03",kicker:"Visual library",Icon:Palette},components:{number:"04",kicker:"Interface library",Icon:Blocks}};
  const treatment=identity?identities[identity]:null;
  const key = "sidebar-open:" + name;
  const [open, setOpen, setPreview] = useHistoryState(key,() => {
    const saved = preview?"false":localStorage.getItem(key);
    return saved === null ? !nested : saved === "true";
  },`${label} section visibility`);
  return <section data-section={name} className={`${icon?"has-custom-icon":""} ${nested ? "folder-group" : "sidebar-section"} ${identity?`section-feature section-style-${styleId??1} section-${identity}`:""}`} data-open={open}>
    <div {...dropProps} className={`${nested ? "folder-heading" : "sidebar-heading"} ${dropProps?.className??""}`}>
      <button className="section-toggle" aria-label={label} aria-expanded={open} onClick={() => {
        if(preview)setPreview(!open);else setOpen(!open);
      }}>
        {identity?<>
          <span className="section-number" aria-hidden="true">{treatment?.number}</span>
          <span className="section-emblem" aria-hidden="true">{icon??(treatment&&<treatment.Icon size={17}/>)}</span>
          <span className="section-copy"><span className="section-kicker" aria-hidden="true">{treatment?.kicker}</span><span className="section-title">{label}</span></span>
          <ChevronRight className="section-chevron" size={14} aria-hidden="true"/>
        </>:<>{open ? <ChevronDown size={13}/> : <ChevronRight size={13}/>} {icon} {label}</>}
      </button>
      {action}
    </div>
    {identity?<div className="section-reveal" aria-hidden={!open} inert={!open}><div className="section-reveal-inner">{identity==="general"||identity==="projects"?<div className="sidebar-section-body">{children}</div>:children}</div></div>:open&&(nested?children:<div className="sidebar-section-body">{children}</div>)}
  </section>;
}
