import {overrideColours} from './AppTheme';
import {useEffect} from 'react';
import {Plus} from 'lucide-react';
import {useHistoryState} from './useAppHistory';
import {appHistory} from './appHistory';
import './ctaAppearance.css';
import {moreCtaStyles} from './ctaMoreStyles';
import './ctaMoreStyles.css';

export const ctaStyles = [
 ['soft','Soft tint','A quiet wash of colour; gently lifts.'],
 ['solid','Velvet solid','Rich matte colour; softly deepens.'],
 ['outline','Fine outline','Airy keyline; fills with a light tint.'],
 ['pill','Pebble','Rounded and soft; a small upward float.'],
 ['gradient','Colour blend','Two colours; the blend slides on hover.'],
 ['glass','Frosted glass','Translucent colour; a clearer edge on hover.'],
 ['duotone','Duotone','Two tinted halves; the balance shifts.'],
 ['raised','Tactile key','A firm lower edge; presses into place.'],
 ['inset','Debossed','An inset surface; rises toward you.'],
 ['brutalist','Offset block','Square corners; an offset colour shadow.'],
 ['ribbon','Ribbon','An asymmetric silhouette; gently slides.'],
 ['double','Double frame','Two fine outlines; opens into a halo.'],
 ['dashed','Stitched','A stitched edge; becomes solid on hover.'],
 ['underline','Underline','A quiet surface; the accent line thickens.'],
 ['rail','Accent rail','A coloured side rail; widens on hover.'],
 ['halo','Soft halo','A subtle glow that blooms on hover.'],
 ['sweep','Colour sweep','A coloured wash moves across the surface.'],
 ['spotlight','Spotlight','A soft radial highlight travels across.'],
 ['sheen','Satin sheen','A narrow light reflection glides across.'],
 ['capsule','Split capsule','A two-colour rim; the corners soften.'],
 ...moreCtaStyles,
] as const;
type Preferences={style:string;primary:string;secondary:string;strength:number;motion:boolean};
export const defaultCta:Preferences={style:'soft',primary:'#26c35d',secondary:'#167a70',strength:24,motion:true};
export function readCta():Preferences {
 try {const v=JSON.parse(localStorage.getItem('cta-appearance')??'{}');return {
  style:ctaStyles.some(([id])=>id===v?.style)?v.style:defaultCta.style,
  primary:/^#[0-9a-f]{6}$/i.test(v?.primary)?v.primary:defaultCta.primary,
  secondary:/^#[0-9a-f]{6}$/i.test(v?.secondary)?v.secondary:defaultCta.secondary,
  strength:typeof v?.strength==='number'&&Number.isFinite(v.strength)?Math.max(0,Math.min(60,v.strength)):defaultCta.strength,
  motion:typeof v?.motion==='boolean'?v.motion:true,
 };}catch{return {...defaultCta};}
}
const usePreferences=()=>useHistoryState('cta-appearance',readCta,'Button appearance');
export function useCtaAppearance(){
 const [p]=usePreferences();
 useEffect(()=>{
  const root=document.documentElement;
  root.dataset.ctaStyle=p.style;root.dataset.ctaMotion=p.motion?'on':'off';
  root.style.setProperty('--cta-primary',p.primary);root.style.setProperty('--cta-secondary',p.secondary);root.style.setProperty('--cta-strength',`${p.strength}%`);
 },[p]);
}
export default function CtaControls(){
 const [p,set]=usePreferences();
 return <div className="cta-customizer"><div className="cta-controls"><h3>Action buttons</h3><p>One look for Add contact, Add lead, Add organisation, campaigns, ideas, research and records. Changes save automatically.</p>
 <div className="cta-live"><button type="button" className="app-cta"><Plus size={15}/>Add contact</button><small>Hover to try your selected style</small></div>
 {(['primary','secondary'] as const).map((key,i)=><label className="cta-colour" key={key}><span>{i?'Second colour':'Main colour'}</span><input type="color" aria-label={i?'Button second colour':'Button main colour'} value={p[key]} onBlur={()=>appHistory.endGesture()} onChange={e=>{appHistory.beginGesture(`cta-${key}`);overrideColours('buttons');set({...p,[key]:e.target.value});}}/><code>{p[key]}</code></label>)}
 <label className="custom-setting"><span>Tint intensity <output>{p.strength}%</output></span><input aria-label="Button tint intensity" type="range" min="0" max="60" value={p.strength} onPointerDown={()=>appHistory.beginGesture('cta-intensity')} onPointerUp={()=>appHistory.endGesture()} onBlur={()=>appHistory.endGesture()} onChange={e=>set({...p,strength:Number(e.target.value)})}/><small>0% removes the surface tint. Solid styles stay rich.</small></label>
 <label className="custom-toggle custom-setting"><span>Hover motion<small>Also respects Reduce motion and your system preference.</small></span><input aria-label="Button hover motion" type="checkbox" checked={p.motion} onChange={e=>set({...p,motion:e.target.checked})}/></label>
 <button className="custom-action" onClick={()=>set({...defaultCta})}>Reset button appearance</button></div>
 <div className="cta-style-grid" aria-label="Button styles">{ctaStyles.map(([id,name,description],index)=><button type="button" key={id} className="cta-style-card" aria-pressed={p.style===id} onClick={()=>set({...p,style:id})}><span className="cta-sample app-cta" data-cta-preview={id} aria-hidden="true"><Plus size={14}/>Add contact</span><strong>{String(index+1).padStart(2,'0')} · {name}</strong><small>{description}</small></button>)}</div></div>;
}
