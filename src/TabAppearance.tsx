import {useEffect,useState,type CSSProperties} from 'react';
import {useHistoryState} from './useAppHistory';
import {appHistory} from './appHistory';
import {defaultTabs,normalizeTabs,tabStyles,tabThemes,tabPalette} from './tabTheme';
import './tabAppearance.css';
export function readTabs(){try{return normalizeTabs(JSON.parse(localStorage.getItem('tab-appearance')??'{}'));}catch{return {...defaultTabs};}}
const usePreferences=()=>useHistoryState('tab-appearance',readTabs,'Tab appearance');
export function useTabAppearance(){
 const [prefs]=usePreferences();
 useEffect(()=>{const root=document.documentElement;root.dataset.tabStyle=prefs.style;root.dataset.tabMotion=prefs.motion?'on':'off';for(const [key,value] of Object.entries(tabPalette(prefs)))root.style.setProperty(`--tabs-${key}`,value);},[prefs]);
}
export default function TabControls(){
 const [prefs,set]=usePreferences(),[preview,setPreview]=useState('Pipeline');
 return <div className="tab-customizer"><div className="tab-controls"><h3>Tabs, your way</h3><p>Shared across Leads, Marketing, Organisations, Projects, Research and Diagnostics. Saved automatically.</p>
 <label className="tab-theme-label">Colour theme<select aria-label="Tab colour theme" value={prefs.theme} onChange={e=>set({...prefs,theme:e.target.value})}>{tabThemes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}<option value="custom">Custom colour · contrast protected</option></select></label>
 {prefs.theme==='custom'&&<label className="tab-colour">Accent colour<input type="color" aria-label="Tab accent colour" value={prefs.colour} onBlur={()=>appHistory.endGesture()} onChange={e=>{appHistory.beginGesture('tab-colour');set({...prefs,colour:e.target.value});}}/></label>}
 <p className="tab-contrast-note">Contrast protected: 4.5:1 text and 3:1 selection cues. Custom colours adjust automatically for readability. An underline marks selection in every style.</p>
 <label className="custom-toggle custom-setting"><span>Tab animations<small>Hover and selection effects. Respects Reduce motion.</small></span><input type="checkbox" aria-label="Tab animations" checked={prefs.motion} onChange={e=>set({...prefs,motion:e.target.checked})}/></label>
 <button className="custom-action" onClick={()=>set({...defaultTabs})}>Reset tab appearance</button></div>
 <div className="tab-options"><div className="tab-live"><strong>Try your tabs</strong><nav className="app-tabs" aria-label="Tab appearance preview">{['Pipeline','Follow-ups','Contacts'].map(name=><button type="button" key={name} aria-current={preview===name?'page':undefined} onClick={()=>setPreview(name)}>{name}</button>)}</nav><small>{preview} selected · click or hover to preview</small></div>
 <div className="tab-style-grid">{tabStyles.map(([id,name,description],i)=><button type="button" key={id} className="tab-style-card" aria-pressed={prefs.style===id} onClick={()=>set({...prefs,style:id})}><span className="app-tabs tab-mini" data-tab-preview={id} aria-hidden="true"><span aria-current="page">Overview</span><span>Files</span></span><strong>{String(i+1).padStart(2,'0')} · {name}</strong><small>{description}</small></button>)}</div>
 <div className="tab-theme-samples" aria-label="Tab theme choices">{tabThemes.map(theme=>{const palette=tabPalette({...prefs,theme:theme.id});return <button key={theme.id} aria-pressed={prefs.theme===theme.id} onClick={()=>set({...prefs,theme:theme.id})} style={{background:palette.surface,color:palette.ink,'--theme-swatch':palette.accent} as CSSProperties}><i aria-hidden="true"/>{theme.name}</button>;})}</div></div></div>;
}
