import { useState } from 'react';
import { Star } from 'lucide-react';
export default function LinkRating({value,onChange,label='Link rating'}:{value?:number|null;onChange:(value:number|null)=>void;label?:string}) {
  const [hover,setHover]=useState<number|null>(null);
  return <span className="link-rating" role="group" aria-label={`${label}: ${value??'unrated'}`} onMouseLeave={()=>setHover(null)}>{[1,2,3,4,5].map(n=><button key={n} type="button" aria-label={`${n} star${n===1?'':'s'}`} aria-pressed={value===n} title={value===n?'Clear rating':`${n} of 5`} onMouseEnter={()=>setHover(n)} onFocus={()=>setHover(n)} onBlur={()=>setHover(null)} onClick={()=>onChange(value===n?null:n)}><Star size={15} fill={n<=(hover??value??0)?'currentColor':'none'}/></button>)}</span>;
}
