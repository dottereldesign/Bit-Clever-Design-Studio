import { Check } from "lucide-react";
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
export function SectionStyleOptions({selected,choose}:{selected:number;choose:(id:number)=>void}) {
 return <div className="section-style-grid">{sectionStyles.map(([name],index)=><article className="style-study" key={name} data-style-study={index+1}>
  <div className="study-caption"><h3>{name}</h3>{selected===index+1&&<Check size={15}/>}</div>
  <div className="study-samples">{(["design","components"] as const).map(identity=><SidebarSection key={identity} name={`sample-${index}-${identity}`} label={identity==="design"?"Design Inspo":"App Components"} identity={identity} styleId={index+1} preview><div className="study-folders"><span>All folders</span><span>Uncategorised</span></div></SidebarSection>)}</div>
  <button className="use-section-style" aria-pressed={selected===index+1} onClick={()=>choose(index+1)} aria-label={`Use ${name} style`}>{selected===index+1?"Selected":"Apply"}</button>
 </article>)}</div>;
}
