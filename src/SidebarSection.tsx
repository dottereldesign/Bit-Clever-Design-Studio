import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function SidebarSection({name, label = name, action, children, nested = false}: {
  name: string; label?: string; action?: ReactNode; children: ReactNode; nested?: boolean;
}) {
  const key = "sidebar-open:" + name;
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved === null ? !nested : saved === "true";
  });
  return <section className={nested ? "folder-group" : "sidebar-section"}>
    <div className={nested ? "folder-heading" : "sidebar-heading"}>
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
