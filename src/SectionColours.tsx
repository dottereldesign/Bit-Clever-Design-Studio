import {appHistory} from "./appHistory";
import type { CSSProperties } from 'react';
import { useHistoryState } from './useAppHistory';

export const sectionIdentities=['marketing','leads','projects','general','design','components','research'] as const;
type Identity=typeof sectionIdentities[number];
type Colours=Partial<Record<Identity,string>>;
const labels:Record<Identity,string>={marketing:'Marketing',leads:'Leads',projects:'Projects',general:'General',design:'Design Inspo',components:'App Components',research:'Research'};
const defaults:Record<Identity,string>={marketing:'#a52b62',leads:'#007b83',projects:'#8c70a4',general:'#626b5d',design:'#b72e42',components:'#5369c3',research:'#8c6418'};
function read():Colours {try{const value=JSON.parse(localStorage.getItem('sidebar-section-colours')||'{}');return Object.fromEntries(Object.entries(value).filter(([k,v])=>sectionIdentities.includes(k as Identity)&&typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)));}catch{return {};}}
export const useSectionColours=()=>useHistoryState<Colours>('sidebar-section-colours',read,'Sidebar section colour');
export function sectionColourStyle(identity:Identity,colours:Colours,style:number):CSSProperties|undefined {
 // Preserve the existing Projects and App Components palettes until explicitly changed.
 const colour=colours[identity]??(['projects','components'].includes(identity)?undefined:defaults[identity]);
 if(!colour)return;
 const dark=[2,4,8,12,15,17,20].includes(style);
 return {'--section-accent':`color-mix(in srgb, ${colour} 45%, #101318)`,'--section-tint':dark?`color-mix(in srgb, ${colour} 35%, #101318)`:`color-mix(in srgb, ${colour} 12%, white)`,'--section-ink':dark?'#ffffff':`color-mix(in srgb, ${colour} 50%, #101318)`} as CSSProperties;
}
export function SectionColourControl({identity}:{identity:Identity}){
 const [colours,setColours]=useSectionColours();
 return <div className="section-colour-control"><label><input type="color" aria-label={`${labels[identity]} colour`} value={colours[identity]??defaults[identity]} onBlur={()=>appHistory.endGesture()} onChange={e=>{appHistory.beginGesture(`section-colour:${identity}:${crypto.randomUUID()}`);setColours(current=>({...current,[identity]:e.target.value}));}}/><span>{labels[identity]}</span></label><button disabled={!colours[identity]} onClick={()=>setColours(current=>{const next={...current};delete next[identity];return next;})}>Reset</button></div>;
}
