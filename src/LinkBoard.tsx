import {useEffect,useState} from "react";
import { convertFileSrc,invoke } from "@tauri-apps/api/core";
import { ExternalLink, Eye, MoreHorizontal, Plus } from "lucide-react";
import { openUrl } from "./api";
import type { Item } from "./model";

export default function LinkBoard({ items, size, report, menu, add, selected, openItem }: {
  items: Item[]; size: number; report: (error: unknown) => void;
  menu: (id: number, event: React.MouseEvent<HTMLButtonElement>) => void;
  add?: () => void;
  selected?: Set<number>;
  openItem?: (item: Item, event: React.MouseEvent) => void;
}) {
  return <div className="link-board" style={{ columnWidth: size }}>
    {items.map(item => <article className={`link-card ${selected?.has(item.id) ? "selected" : ""}`} key={item.id} data-item-id={item.id}>
      <button className="link-card-open" title={item.source==="Websites"?"Preview full-page screenshot":"Open reference · Ctrl + scroll to enlarge"} onClick={event => openItem ? openItem(item, event) : void openUrl(item.path).catch(report)} aria-label={`${item.source==="Websites"?"Preview":"Open"} ${item.name}`}>
        {item.thumbnail ? <LinkThumbnail item={item}/> : <div className="link-card-placeholder" />}
        <strong>{item.name}</strong><small>{new URL(item.path).hostname}</small>
      </button>
      {item.source==="Websites"&&<div className="website-card-actions">
        <button className="subtle-button" onClick={event=>openItem?.(item,event)} aria-label={`Preview full-page screenshot of ${item.name}`}><Eye size={14}/> Preview</button>
        <button className="icon-button website-card-external" title="Open website in browser" aria-label={`Open ${item.name} in browser`} onClick={()=>void openUrl(item.path).catch(report)}><ExternalLink size={15}/></button>
      </div>}
      <button className="icon-button link-card-menu" aria-label={`Actions for ${item.name}`} onClick={event => menu(item.id,event)}><MoreHorizontal size={16}/></button>
    </article>)}
    {!items.length && add && <div className="empty-state"><button className="subtle-button" onClick={add}><Plus size={14}/> Add link</button><small>Ctrl+V</small></div>}
  </div>;
}

function LinkThumbnail({item}:{item:Item}){
 const [preview,setPreview]=useState('');
 useEffect(()=>{let alive=true;setPreview('');if(item.source==='Websites')void invoke<string>('website_thumbnail',{id:item.id}).then(path=>{if(alive)setPreview(path);}).catch(()=>{if(alive)setPreview(item.thumbnail??'');});return()=>{alive=false;};},[item.id,item.thumbnail,item.source]);
 if(item.source==='Websites'&&!preview)return <div className="link-card-placeholder"/>;
 return <img loading="lazy" src={convertFileSrc(preview||item.thumbnail!)} alt=""/>;
}
