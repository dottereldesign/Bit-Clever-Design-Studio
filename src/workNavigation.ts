import type {Library} from './model';
import {isOrganisation} from './studio';
export type WorkTarget={kind:'studio'|'project'|'item';id:string};
export type WorkResult=WorkTarget&{label:string;type:string;search:string};
export const workKey=(t:WorkTarget)=>`${t.kind}:${t.id}`;
export function workIndex(lib:Library):WorkResult[]{return [...(lib.studio??[]).filter(e=>!e.archived&&(isOrganisation(e)||['lead','contact','campaign','research'].includes(e.kind))).map(e=>({kind:'studio' as const,id:e.id,label:e.name,type:isOrganisation(e)?'Organisation':e.kind[0].toUpperCase()+e.kind.slice(1),search:[e.name,e.email,e.phone,e.source].join(' ').toLocaleLowerCase()})),...lib.projects.map(p=>({kind:'project' as const,id:String(p.id),label:p.name,type:'Project',search:p.name.toLocaleLowerCase()})),...lib.items.filter(i=>!i.missing).map(i=>({kind:'item' as const,id:String(i.id),label:i.name,type:i.kind==='link'?'Link':'File',search:i.name.toLocaleLowerCase()}))];}
export function searchWork(index:WorkResult[],query:string){const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);if(!terms.length)return [];return index.filter(r=>terms.every(t=>r.search.includes(t))).sort((a,b)=>Number(!a.label.toLocaleLowerCase().startsWith(terms[0]))-Number(!b.label.toLocaleLowerCase().startsWith(terms[0]))||a.label.localeCompare(b.label));}
