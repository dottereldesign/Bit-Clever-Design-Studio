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
function Mascot({talking}:{talking:boolean}){return <div className={`tour-mascot ${talking?'is-talking':''}`} aria-hidden="true"><div key={talking?'talking':'idle'} className="tour-mascot-frames"/></div>;}
export default function LeadsTour({route,navigate,entries}:{route:StudioRoute;navigate:(r:StudioRoute)=>void;entries:StudioEntry[]}){
 const [prefs,setPrefs]=useOnboarding();const [colours]=useSectionColours();
 const [step,setStep]=useState(0),[typed,setTyped]=useState(0),[geometry,setGeometry]=useState<{x:number;y:number;w:number;h:number;cw:number;ch:number;colour:string}|null>(null);
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
  const measure=()=>{const rect=findTarget()?.getBoundingClientRect();const heading=document.querySelector('.sidebar .section-leads>.sidebar-heading');if(!rect||rect.bottom<8||rect.top>=window.innerHeight-8){setGeometry(null);return;}const x=Math.max(8,rect.left),y=Math.max(8,rect.top);setGeometry({x,y,cw:card.current?.offsetWidth??390,ch:card.current?.offsetHeight??280,w:Math.max(0,Math.min(rect.right,window.innerWidth-8)-x),h:Math.max(0,Math.min(rect.bottom,window.innerHeight-8)-y),colour:heading?getComputedStyle(heading).getPropertyValue('--section-accent').trim():'#007b83'});};
  findTarget()?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});measure();
  const observer=new ResizeObserver(measure);observer.observe(document.body);if(card.current)observer.observe(card.current);const target=findTarget();if(target)observer.observe(target);const timer=setTimeout(measure,300);window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);
  return()=>{observer.disconnect();clearTimeout(timer);window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);};
 },[visible,step,route.id,route.tab,current.target,colours]);
 if(!visible)return null;
 const finish=(mode:string)=>{setPrefs({...prefs,leadsSeen:true});record('onboarding.close','success',0,{section:'leads',mode,count:step+1});};
 const go=(next:number)=>{setStep(next);const tab=steps[next].tab;navigate(tab&&lead?{section:'leads',page:'pipeline',id:lead.id,tab}:{section:'leads',page:'pipeline'});record('onboarding.step','success',0,{section:'leads',count:next+1});};
 const width=geometry?.cw??Math.min(390,window.innerWidth-32),height=geometry?.ch??280,gap=18;
 const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(v,Math.max(min,max)));
 const contentLeft=document.querySelector('.sidebar')?.getBoundingClientRect().right??0;
 const minLeft=Math.min(contentLeft+12,window.innerWidth-width-16);
 let left=clamp(geometry?geometry.x+12:minLeft,minLeft,window.innerWidth-width-16);
 let top=16,side='below';
 if(geometry){
  if(geometry.y+geometry.h+gap+height<=window.innerHeight-12)top=geometry.y+geometry.h+gap;
  else if(geometry.y-gap-height>=12){top=geometry.y-gap-height;side='above';}
  else if(geometry.x+geometry.w+gap+width<=window.innerWidth-12){left=geometry.x+geometry.w+gap;top=geometry.y;side='right';}
  else if(geometry.x-gap-width>=minLeft){left=geometry.x-gap-width;top=geometry.y;side='left';}
  else{top=geometry.y+geometry.h+gap;}
 }
 top=clamp(top,12,window.innerHeight-height-12);
 const horizontal=side==='left'||side==='right';
 const arrowX=geometry?(horizontal?(side==='right'?geometry.x+geometry.w+4:geometry.x-4):clamp(left+38,geometry.x+8,geometry.x+geometry.w-8)):left;
 const arrowY=geometry?(horizontal?clamp(top+42,geometry.y+8,geometry.y+geometry.h-8):(side==='above'?geometry.y-4:geometry.y+geometry.h+4)):top;
 const startX=horizontal?(side==='right'?left:left+width):clamp(arrowX,left+20,left+width-20);
 const startY=horizontal?clamp(arrowY,top+20,top+height-20):(side==='above'?top+height:top);
 return createPortal(<div className="leads-tour" data-still={still} style={{'--tour-colour':geometry?.colour||'#007b83'} as CSSProperties}>
 {geometry&&<svg className="tour-pointer" width="100%" height="100%" aria-hidden="true"><defs><marker id="leads-tour-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M1 1L7 4L1 7" fill="none" stroke="currentColor" strokeWidth="1.5"/></marker></defs><rect x={geometry.x-4} y={geometry.y-4} width={geometry.w+8} height={geometry.h+8} rx="9" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 6"/><path d={`M${startX} ${startY} L${arrowX} ${arrowY}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#leads-tour-arrow)"/></svg>}
 <div ref={card} className="tour-card" role="dialog" aria-label="Leads walkthrough" aria-describedby="tour-description" tabIndex={-1} style={{left,top}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();finish('skip');}}}>
 <button className="tour-close" aria-label="Skip walkthrough" onClick={()=>finish('skip')}><X size={17}/></button><Mascot talking={!still&&typed<current.text.length}/><div className="tour-copy"><small>{step+1} / {steps.length}</small><h2>{current.title}</h2><p aria-hidden="true" onClick={()=>setTyped(current.text.length)}>{current.text.slice(0,typed)}<span className="tour-cursor" hidden={typed>=current.text.length}>▏</span></p><span className="tour-sr" id="tour-description" aria-live="polite">{current.text}</span></div>
 <footer><button disabled={step===0} onClick={()=>go(step-1)}><ArrowLeft size={14}/>Back</button><button className="tour-next" onClick={()=>step===steps.length-1?finish('complete'):go(step+1)}>{step===steps.length-1?'Got it':'Next'}<ArrowRight size={14}/></button></footer></div></div>,document.body);
}
