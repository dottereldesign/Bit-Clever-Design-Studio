import { useCallback, useEffect, useSyncExternalStore, type SetStateAction } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { appHistory } from "./appHistory";
export function useHistoryState<T>(key:string,initial:()=>T,label:string){
 const value=useSyncExternalStore(appHistory.subscribe,()=>appHistory.read(key,initial));
 useEffect(()=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(value));},[key,value]);
 const set=useCallback((next:SetStateAction<T>)=>{const before=appHistory.read(key,initial),after=typeof next==='function'?(next as (v:T)=>T)(before):next;appHistory.commit(label,{[key]:before},{[key]:after});},[key,label]);
 const raw=useCallback((next:SetStateAction<T>)=>{const before=appHistory.read(key,initial);appHistory.write({[key]:typeof next==='function'?(next as (v:T)=>T)(before):next});},[key]);
 return [value,set,raw] as const;
}
export function useHistory(){useSyncExternalStore(appHistory.subscribe,appHistory.snapshot);return appHistory;}
export function HistoryButtons({home=false}:{home?:boolean}){
 const history=useHistory();return <><button className="icon-button" aria-label={home?'Undo Home layout change':'Undo change'} disabled={!history.undoLabel||history.busy} title={history.undoLabel?`Undo: ${history.undoLabel} (Ctrl+Z)`:'Nothing to undo'} onClick={()=>void history.undo()}><Undo2 size={16}/></button><button className="icon-button" aria-label={home?'Redo Home layout change':'Redo change'} disabled={!history.redoLabel||history.busy} title={history.redoLabel?`Redo: ${history.redoLabel} (Ctrl+Shift+Z / Ctrl+Y)`:'Nothing to redo'} onClick={()=>void history.redo()}><Redo2 size={16}/></button></>;
}
