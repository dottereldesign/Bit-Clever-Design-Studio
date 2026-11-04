import { useState, type ReactNode, type HTMLAttributes } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function SidebarSection({name, label = name, action, children, nested = false, dropProps}: {
  name: string; label?: string; action?: ReactNode; children: ReactNode; nested?: boolean; dropProps?: HTMLAttributes<HTMLDivElement> & {"data-category"?:string; "data-section-label"?:string};
}) {
  const key = "sidebar-open:" + name;
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved === null ? !nested : saved === "true";
  });
  return <section className={nested ? "folder-group" : "sidebar-section"}>
    <div {...dropProps} className={`${nested ? "folder-heading" : "sidebar-heading"} ${dropProps?.className??""}`}>
      <button className="section-toggle" aria-expanded={open} onClick={() => {
        localStorage.setItem(key, String(!open));
        setOpen(!open);
      }}>
        {open ? <ChevronDown size={13}/> : <ChevronRight size={13}/>} {label}
      </button>
      {action}
    </div>
    {open && children}
  </section>;
}
