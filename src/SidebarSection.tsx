import { useState, type ReactNode, type HTMLAttributes } from "react";
import { ChevronDown, ChevronRight, Palette, Blocks } from "lucide-react";

export default function SidebarSection({name, label = name, action, children, nested = false, dropProps, styleId, identity, preview = false}: {
  styleId?:number; identity?:"design"|"components"; preview?:boolean; name: string; label?: string; action?: ReactNode; children: ReactNode; nested?: boolean; dropProps?: HTMLAttributes<HTMLDivElement> & {"data-category"?:string; "data-section-label"?:string};
}) {
  const key = "sidebar-open:" + name;
  const [open, setOpen] = useState(() => {
    const saved = preview?"false":localStorage.getItem(key);
    return saved === null ? !nested : saved === "true";
  });
  return <section className={`${nested ? "folder-group" : "sidebar-section"} ${identity?`section-feature section-style-${styleId??1} section-${identity}`:""}`} data-open={open}>
    <div {...dropProps} className={`${nested ? "folder-heading" : "sidebar-heading"} ${dropProps?.className??""}`}>
      <button className="section-toggle" aria-label={label} aria-expanded={open} onClick={() => {
        if(!preview)localStorage.setItem(key, String(!open));
        setOpen(!open);
      }}>
        {identity?<>
          <span className="section-number" aria-hidden="true">{identity==="design"?"01":"02"}</span>
          <span className="section-emblem" aria-hidden="true">{identity==="design"?<Palette size={17}/>:<Blocks size={17}/>}</span>
          <span className="section-copy"><span className="section-kicker" aria-hidden="true">{identity==="design"?"Visual library":"Interface library"}</span><span className="section-title">{label}</span></span>
          <ChevronRight className="section-chevron" size={14} aria-hidden="true"/>
        </>:<>{open ? <ChevronDown size={13}/> : <ChevronRight size={13}/>} {label}</>}
      </button>
      {action}
    </div>
    {identity?<div className="section-reveal" aria-hidden={!open} inert={!open}><div className="section-reveal-inner">{children}</div></div>:open&&children}
  </section>;
}
