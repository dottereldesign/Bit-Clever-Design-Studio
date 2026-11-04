import { useEffect, useRef } from "react";
import { X, Check } from "lucide-react";
import SidebarSection from "./SidebarSection";
import "./sectionStyles.css";

export const sectionStyles = [
  ["Gallery", "Serif titles, fine rules, warm paper."],
  ["Colour blocks", "Bold terracotta and cobalt panels."],
  ["Aurora", "Soft glass, pastel light, floating icons."],
  ["Terminal", "Dark instruments with luminous accents."],
  ["File cabinet", "Layered tabs for two distinct collections."],
  ["Studio poster", "Heavy outlines and playful offset shadows."],
  ["Admission", "Perforated tickets with numbered stubs."],
  ["After hours", "Rich gradients and quiet orbital detail."],
  ["Swiss index", "Oversized numbers and precise typography."],
  ["Control deck", "Tactile switches with subtle status lights."],
];
export const readSectionStyle=()=>{const n=Number(localStorage.getItem("sidebar-section-style"));return Number.isInteger(n)&&n>=1&&n<=10?n:1;};
export default function SectionStylePicker({selected,choose,close}:{selected:number;choose:(id:number)=>void;close:()=>void}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current?.focus();return ()=>previous?.focus();},[]);
  return <div className="modal-backdrop section-style-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
    <div ref={ref} tabIndex={-1} className="section-style-dialog" role="dialog" aria-modal="true" aria-labelledby="section-style-title" onKeyDown={e=>{
      e.stopPropagation();if(e.key==="Escape")close();
      if(e.key==="Tab"){const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(b=>!b.closest('[inert]'));const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    }}>
      <header><div><span className="style-eyebrow">SIDEBAR STUDIES / 01—10</span><h2 id="section-style-title">Two libraries. Ten directions.</h2><p>Hover and click the sample headings. Choose a style for your sidebar.</p></div><button className="icon-button" aria-label="Close section styles" onClick={close}><X size={20}/></button></header>
      <div className="section-style-grid">{sectionStyles.map(([name,description],index)=><article className="style-study" key={name} data-style-study={index+1}>
        <div className="study-caption"><span>{String(index+1).padStart(2,"0")}</span><h3>{name}</h3>{selected===index+1&&<small><Check size={12}/> Current</small>}</div>
        <div className="study-samples">{(["design","components"] as const).map(identity=><SidebarSection key={identity} name={`sample-${index}-${identity}`} label={identity==="design"?"Design Inspo":"App Components"} identity={identity} styleId={index+1} preview>
          <div className="study-folders">{(identity==="design"?["All categories","Branding","Typography"]:["All Components","Uncategorised","Navbars"]).map(folder=><span key={folder}>{folder}</span>)}</div>
        </SidebarSection>)}</div>
        <p>{description}</p><button className="use-section-style" onClick={()=>choose(index+1)} aria-label={`Use ${name} style`}>{selected===index+1?"Keep this style":"Use this style"}<span aria-hidden="true">↗</span></button>
      </article>)}</div>
      <footer>Only Design Inspo and App Components change. Your folders keep their minimal styling.</footer>
    </div>
  </div>;
}
