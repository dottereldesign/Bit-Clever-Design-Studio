import { useEffect,useState,type MouseEvent } from 'react';
import { FileImage,Link,Video,MoreHorizontal } from 'lucide-react';
import { media } from './api';
import type { Item } from './model';
import type { CollectionLayout } from './appearance';
function Reference({item,selected,dragIds,open,select,menu}:{item:Item;selected:boolean;dragIds:number[];open:(e:MouseEvent)=>void;select:()=>void;menu:(e:MouseEvent<HTMLButtonElement>)=>void}){
 const [thumbnail,setThumbnail]=useState('');
 useEffect(()=>{const abort=new AbortController();setThumbnail('');if(!item.missing&&(item.kind!=='link'||item.thumbnail))void media(item,'thumbnail',abort.signal).then(url=>{if(!abort.signal.aborted)setThumbnail(url);}).catch(()=>{});return()=>abort.abort();},[item.id,item.path,item.modified,item.thumbnail,item.missing]);
 const Icon=item.kind==='link'?Link:item.kind==='video'?Video:FileImage;
 return <article className={`collection-reference ${selected?'is-selected':''}`} data-item-id={item.id} draggable onDragStart={e=>{e.dataTransfer.setData('application/design-items',JSON.stringify(dragIds));e.dataTransfer.effectAllowed='copyMove';}}>
 <button className="collection-reference-open" title="Open reference · Ctrl + scroll to enlarge" onClick={open} aria-label={`Open ${item.name}`}><span className="collection-reference-image">{thumbnail?<img src={thumbnail} alt="" loading="lazy" onError={()=>setThumbnail('')}/>:<Icon size={26}/>}</span><span className="collection-reference-name">{item.name}<small>{item.source||'Links'}</small></span><span className="collection-reference-kind">{item.kind}</span></button>
 <div className="collection-reference-actions"><input type="checkbox" checked={selected} onChange={select} aria-label={`Select ${item.name}`}/><button className="icon-button" aria-label={`Actions for ${item.name}`} onClick={menu}><MoreHorizontal size={16}/></button></div></article>;
}
export default function CollectionView({items,layout,size,selected,select,open,menu,add}:{items:Item[];layout:CollectionLayout;size:number;selected:Set<number>;select:(id:number)=>void;open:(item:Item,e:MouseEvent)=>void;menu:(id:number,e:MouseEvent<HTMLButtonElement>)=>void;add:()=>void}){
 const [limit,setLimit]=useState(100);useEffect(()=>setLimit(100),[items]);
 return <div className={`custom-collection collection-${layout}`} data-collection-layout={layout} style={{'--collection-width':`${size}px`} as React.CSSProperties}>
 {layout==='table'&&<div className="collection-column-head"><span>Reference</span><span>Type</span><span>Actions</span></div>}
 <div className="collection-references">{items.slice(0,limit).map(item=><Reference key={item.id} item={item} selected={selected.has(item.id)} dragIds={selected.has(item.id)?[...selected]:[item.id]} select={()=>select(item.id)} open={e=>open(item,e)} menu={e=>menu(item.id,e)}/>)}</div>
 {!items.length&&<div className="empty-state"><span>No references yet</span><button className="subtle-button" onClick={add}>Add references</button></div>}
 {items.length>limit&&<button className="custom-action collection-more" onClick={()=>setLimit(n=>n+100)}>Show more · {items.length-limit} remaining</button>}</div>;
}
