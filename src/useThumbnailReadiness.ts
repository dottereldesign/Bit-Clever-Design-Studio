import {useEffect,type RefObject} from 'react';
import {record} from './diagnostics';
import type {Item} from './model';

// Measure the first viewport of this item set, not its offscreen prefetch work.
export function useThumbnailReadiness(items:Item[],grid:RefObject<HTMLDivElement|null>,parent:RefObject<HTMLDivElement|null>){
 useEffect(()=>{const element=grid.current,scroller=parent.current;if(!element||!scroller||!items.length)return;
 const start=performance.now(),operation=crypto.randomUUID();let frame=0,done=false,first=false;
 record('thumbnails.viewport','started',0,{items:items.length},operation);
 const check=()=>{frame=0;if(done)return;const bounds=scroller.getBoundingClientRect();const cards=[...element.querySelectorAll<HTMLElement>('.card')].filter(card=>{const r=card.getBoundingClientRect();return r.bottom>bounds.top&&r.top<bounds.bottom;});if(!cards.length)return;
 let ready=0,failed=0;for(const card of cards){const image=card.querySelector<HTMLImageElement>('.card-open>img');if(image?.complete&&image.naturalWidth>0)ready++;else if(card.querySelector('.file-fallback'))failed++;}
 if(ready&&!first){first=true;record('thumbnails.first_visible','success',performance.now()-start,{count:cards.length,completed:ready},operation);}
 if(ready+failed===cards.length){done=true;record('thumbnails.viewport',failed?'warning':'success',performance.now()-start,{count:cards.length,completed:ready,failed},operation);}
 };
 const schedule=()=>{if(!frame&&!done)frame=requestAnimationFrame(check);};
 const cancel=()=>{if(!done){done=true;record('thumbnails.viewport','cancelled',performance.now()-start,{},operation);}};
 const observer=new MutationObserver(schedule);observer.observe(element,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});element.addEventListener('load',schedule,true);element.addEventListener('error',schedule,true);scroller.addEventListener('scroll',cancel,{passive:true});scroller.addEventListener('wheel',cancel,{passive:true});scroller.addEventListener('touchstart',cancel,{passive:true});
 frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(check);});const timeout=setTimeout(()=>{if(!done){done=true;record('thumbnails.viewport','warning',performance.now()-start,{error_code:'timeout'},operation);}},15000);
 return()=>{cancel();observer.disconnect();cancelAnimationFrame(frame);clearTimeout(timeout);element.removeEventListener('load',schedule,true);element.removeEventListener('error',schedule,true);scroller.removeEventListener('scroll',cancel);scroller.removeEventListener('wheel',cancel);scroller.removeEventListener('touchstart',cancel);};
 },[items,grid,parent]);
}
