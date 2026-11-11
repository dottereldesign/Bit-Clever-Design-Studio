import {useEffect} from 'react';
import {useHistoryState} from './useAppHistory';
import './selectionStyles.css';
const treatments=['Outline','Double line','Dashed','Inset','White keyline','Soft glow','Corners','Side brackets','Top and bottom','Tinted frame'];
const colours=['Sage','Blue','Violet','Rose','Amber'];
export const selectionStyles=treatments.flatMap(t=>colours.map(c=>`${t} · ${c}`));
const initial=()=>{const n=Number(localStorage.getItem('selection-style'));return Number.isInteger(n)&&n>=1&&n<=50?n:1;};
export function useSelectionAppearance(){
 const [style]=useHistoryState('selection-style',initial,'Selection style');
 useEffect(()=>{document.documentElement.dataset.selectionStyle=String(style);},[style]);
}
export default function SelectionStyles(){
 const [style,setStyle]=useHistoryState('selection-style',initial,'Selection style');
 return <><h3>Selected thumbnails</h3><div className="selection-style-options">{selectionStyles.map((name,i)=><button key={name} className={`selection-style-option selection-style-${i+1}`} aria-pressed={style===i+1} onClick={()=>setStyle(i+1)}><span className="selection-sample" aria-hidden="true"><span/></span><strong>{name}</strong></button>)}</div></>;
}
