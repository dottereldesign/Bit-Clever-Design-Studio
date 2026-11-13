import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {X,ArrowRight,ArrowLeft,RotateCcw} from 'lucide-react';
import {useHistoryState} from './useAppHistory';
import {useSectionColours} from './SectionColours';
import {record} from './diagnostics';
import type {StudioEntry,StudioRoute} from './studio';
import './leadsTour.css';
const defaults={enabled:true,leadsSeen:false};
function read(){try{return {...defaults,...JSON.parse(localStorage.getItem('onboarding')||'{}')};}catch{return defaults;}}
export const useOnboarding=()=>useHistoryState('onboarding',read,'Guided walkthroughs');
export function OnboardingSettings(){
 const [prefs,set]=useOnboarding();
 return <section className="onboarding-settings"><h2>Guided walkthroughs</h2><label><input type="checkbox" checked={prefs.enabled} onChange={e=>set({...prefs,enabled:e.target.checked})}/>Show onboarding when I first open a section</label><button onClick={()=>{set({...prefs,enabled:true,leadsSeen:false});window.dispatchEvent(new Event('replay-leads-tour'));}}><RotateCcw size={14}/>Replay Leads walkthrough</button><p>Replay explains the workflow without changing your records.</p></section>;
}
const steps=[
 {title:'From first hello to project',text:'Keep the opportunity here until the work is agreed. Capture the lead, follow up, then hand the work over to Projects.',target:'.studio-tabs',tab:''},
 {title:'1. Capture the opportunity',text:'Start with a name. Open a lead to add the brief, service, source and people involved. You can fill in the details as you learn more.',target:'.studio-quick-add',tab:''},
 {title:'2. Keep the conversation together',text:'Use Activity for dated emails, calls and decisions. Keep source links with email notes so you can return to the original conversation.',target:'.studio-content .studio-quick-add,.studio-tabs',tab:'activity'},
 {title:'3. Know what happens next',text:'Give each open lead a next action and a due date. Follow-ups brings overdue and upcoming actions together so nobody slips through.',target:'.studio-actions,.studio-tabs',tab:'overview'},
 {title:'4. Close the lead',text:'Choose Won when the work is agreed. This creates a project, or reuses the linked or same-name project. Lost closes the opportunity without creating work.',target:'.studio-field:has([aria-label="Stage"]),.studio-close-hint,.studio-tabs',tab:'overview'},
 {title:'5. Continue in Projects',text:'The brief, contacts and files carry through. Unfinished actions move to the project. The lead history stays here, and Undo can reverse a handover.',target:'.studio-handover,.studio-actions,.studio-tabs',tab:'overview'},
 {title:'Ready when you are',text:'After handover, a lead stays linked to its project. Use Open project to continue the work. You can replay this guide or switch walkthroughs off in Settings.',target:'.studio-actions,.studio-tabs',tab:'overview'}
];
function Mascot({talking}:{talking:boolean}){return <svg className={`tour-mascot ${talking?'is-talking':''}`} viewBox="0 0 140 160" aria-hidden="true"><ellipse cx="70" cy="151" rx="47" ry="5" fill="currentColor" opacity=".12"/><g className="tour-breathe"><path d="M48 61C11 71 7 113 19 135C29 154 54 143 71 146C104 153 132 140 126 115C122 94 101 67 93 64Z" fill="currentColor"/><rect x="36" y="12" width="69" height="64" rx="9" fill="var(--tour-light)"/><circle cx="56" cy="39" r="5" fill="#111"/><circle cx="85" cy="39" r="5" fill="#111"/><ellipse className="tour-mouth" cx="70" cy="58" rx="8" ry="3" fill="#111"/><path d="M21 104Q10 96 15 87M113 103Q129 97 125 87" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round"/></g></svg>;}
export default function LeadsTour({route,navigate,entries}:{route:StudioRoute;navigate:(r:StudioRoute)=>void;entries:StudioEntry[]}){
 const [prefs,setPrefs]=useOnboarding();const [colours]=useSectionColours();
 const [step,setStep]=useState(0),[typed,setTyped]=useState(0),[geometry,setGeometry]=useState<{x:number;y:number;w:number;h:number;colour:string}|null>(null);
 const [reduced]=useHistoryState('reduce-motion',()=>localStorage.getItem('reduce-motion')==='true','Reduce motion');
 const [osReduced,setOsReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const card=useRef<HTMLDivElement>(null),startFocus=useRef<HTMLElement|null>(null);
 const visible=prefs.enabled&&!prefs.leadsSeen&&route.section==='leads',still=reduced||osReduced;
 const lead=entries.find(e=>e.id===route.id&&e.kind==='lead')??entries.find(e=>e.kind==='lead'&&!e.archived);
 const current=steps[step];
 useEffect(()=>{const mq=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setOsReduced(mq.matches);mq.addEventListener('change',change);return()=>mq.removeEventListener('change',change);},[]);
 useEffect(()=>{if(!visible)return;startFocus.current=document.activeElement as HTMLElement;card.current?.focus();record('onboarding.open','success',0,{section:'leads'});return()=>{if(startFocus.current?.isConnected)startFocus.current.focus();};},[visible]);
 useEffect(()=>{if(!visible)return;setTyped(still?current.text.length:0);if(still)return;const timer=setInterval(()=>setTyped(n=>{const next=Math.min(current.text.length,n+3);if(next===current.text.length)clearInterval(timer);return next;}),24);return()=>clearInterval(timer);},[step,visible,still,current.text]);
 useLayoutEffect(()=>{
  if(!visible)return;
  const findTarget=()=>current.target.split(',').flatMap(selector=>[...document.querySelectorAll<HTMLElement>(selector)]).find(e=>e.getBoundingClientRect().height>0&&!e.closest('[inert]'));
  const measure=()=>{const rect=findTarget()?.getBoundingClientRect();const heading=document.querySelector('.sidebar .section-leads>.sidebar-heading');if(!rect||rect.bottom<8||rect.top>=window.innerHeight-8){setGeometry(null);return;}const x=Math.max(8,rect.left),y=Math.max(8,rect.top);setGeometry({x,y,w:Math.max(0,Math.min(rect.right,window.innerWidth-8)-x),h:Math.max(0,Math.min(rect.bottom,window.innerHeight-8)-y),colour:heading?getComputedStyle(heading).getPropertyValue('--section-accent').trim():'#007b83'});};
  findTarget()?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});measure();
  const observer=new ResizeObserver(measure);observer.observe(document.body);const timer=setTimeout(measure,300);window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);
  return()=>{observer.disconnect();clearTimeout(timer);window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);};
 },[visible,step,route.id,route.tab,current.target,colours]);
 if(!visible)return null;
 const finish=(mode:string)=>{setPrefs({...prefs,leadsSeen:true});record('onboarding.close','success',0,{section:'leads',mode,count:step+1});};
 const go=(next:number)=>{setStep(next);const tab=steps[next].tab;navigate(tab&&lead?{section:'leads',page:'pipeline',id:lead.id,tab}:{section:'leads',page:'pipeline'});record('onboarding.step','success',0,{section:'leads',count:next+1});};
 const left=Math.max(16,window.innerWidth-Math.min(390,window.innerWidth-32)-24),top=Math.max(16,Math.min(window.innerHeight-305,geometry?geometry.y+geometry.h+48:window.innerHeight-305));
 const arrowX=geometry?Math.min(window.innerWidth-24,geometry.x+Math.max(20,geometry.w-100)):left;
 const arrowY=geometry?Math.min(window.innerHeight-20,Math.max(20,geometry.y+geometry.h+8)):top;
 return createPortal(<div className="leads-tour" data-still={still} style={{'--tour-colour':geometry?.colour||'#007b83'} as CSSProperties}>
 {geometry&&<svg className="tour-pointer" width="100%" height="100%" aria-hidden="true"><defs><marker id="leads-tour-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M1 1L7 4L1 7" fill="none" stroke="currentColor" strokeWidth="1.5"/></marker></defs><rect x={geometry.x-4} y={geometry.y-4} width={geometry.w+8} height={geometry.h+8} rx="9" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 6"/><path d={`M${left+60} ${top+20} Q${left+20} ${top-45} ${arrowX} ${arrowY}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#leads-tour-arrow)"/></svg>}
 <div ref={card} className="tour-card" role="dialog" aria-label="Leads walkthrough" aria-describedby="tour-description" tabIndex={-1} style={{left,top}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();finish('skip');}}}>
 <button className="tour-close" aria-label="Skip walkthrough" onClick={()=>finish('skip')}><X size={17}/></button><Mascot talking={!still&&typed<current.text.length}/><div className="tour-copy"><small>{step+1} / {steps.length}</small><h2>{current.title}</h2><p aria-hidden="true" onClick={()=>setTyped(current.text.length)}>{current.text.slice(0,typed)}<span className="tour-cursor" hidden={typed>=current.text.length}>▏</span></p><span className="tour-sr" id="tour-description" aria-live="polite">{current.text}</span></div>
 <footer><button disabled={step===0} onClick={()=>go(step-1)}><ArrowLeft size={14}/>Back</button><button className="tour-next" onClick={()=>step===steps.length-1?finish('complete'):go(step+1)}>{step===steps.length-1?'Got it':'Next'}<ArrowRight size={14}/></button></footer></div></div>,document.body);
}
