import {useEffect,useState,useSyncExternalStore} from 'react';
import {invoke,record} from './diagnostics';
import {openUrl} from './api';
import {selectedMeetings,type CalendarStatus} from './calendarImport';
type Snapshot={status:CalendarStatus|null;busy:boolean;error:string};
let snapshot:Snapshot={status:null,busy:false,error:''};const listeners=new Set<()=>void>();let inFlight:Promise<void>|null=null;
const publish=(next:Partial<Snapshot>)=>{snapshot={...snapshot,...next};listeners.forEach(fn=>fn());};
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export function syncCalendar(){
 if(inFlight)return inFlight;
 publish({busy:true,error:''});
 inFlight=(async()=>{try{const feed=await invoke<{text:string;rules:CalendarStatus['meetings'];generation:string}>('calendar_feed');const meetings=selectedMeetings(feed.text,feed.rules);publish({status:await invoke<CalendarStatus>('calendar_apply',{meetings,generation:feed.generation})});}catch(error){record('calendar.sync','error',0,{error_code:'calendar_sync'});publish({error:String(error).replace(/^Error: /,'')});}finally{publish({busy:false});inFlight=null;}})();return inFlight;
}
export function useCalendarSync(ready:boolean,refresh:()=>Promise<unknown>){
 useEffect(()=>{if(!ready)return;let disposed=false;let timer:ReturnType<typeof setInterval>|undefined;
 void invoke<CalendarStatus>('calendar_initialise').then(async status=>{if(disposed||!status)return;publish({status});if(status.meetings.length)await refresh();if(status.connected)await syncCalendar();if(!disposed)timer=setInterval(()=>{if(snapshot.status?.connected)void syncCalendar();},15*60*1000);}).catch(()=>{if(!disposed)publish({error:'Calendar setup could not be loaded.'});});
 const online=()=>{if(snapshot.status?.connected)void syncCalendar();};window.addEventListener('online',online);
 return()=>{disposed=true;clearInterval(timer);window.removeEventListener('online',online);};
 },[ready,refresh]);
}
export default function CalendarConnection(){
 const {status,busy,error}=useSyncExternalStore(subscribe,()=>snapshot);const [url,setUrl]=useState('');
 const connect=async()=>{publish({busy:true,error:''});try{const status=await invoke<CalendarStatus>('calendar_connect',{url});setUrl('');publish({status,busy:false});await syncCalendar();}catch{setUrl('');publish({busy:false,error:'Could not connect. Use the Secret address in iCal format from your Google Calendar settings.'});}};
 return <section className="calendar-connection"><h2>Google Calendar</h2><p>Read-only sync for the selected project meetings. Updates every 15 minutes while Studio is open.</p>
 {status?.meetings.map(m=><div key={m.source_id}>{m.project_name} · {m.name}</div>)}
 <p>{status?.connected?'Connected': 'Not connected'}{status?.last_sync?` · Last synced ${new Date(status.last_sync*1000).toLocaleString()}`:''}</p>
 {!status?.connected?<><label>Secret address in iCal format<input aria-label="Private calendar feed" type="password" autoComplete="off" value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste the private feed address here"/></label><button disabled={busy||!url.trim()} onClick={()=>void connect()}>Connect calendar</button><button onClick={()=>void openUrl('https://calendar.google.com/calendar/u/0/r/settings')}>Open Google Calendar settings</button><small>Choose your calendar → Integrate calendar → Secret address in iCal format. The address is protected by Windows and excluded from backups. It can read the source calendar; Studio stores only the selected meetings.</small></>:<><button disabled={busy} onClick={()=>void syncCalendar()}>{busy?'Syncing…':'Sync now'}</button><button disabled={busy} onClick={()=>{void invoke<CalendarStatus>('calendar_disconnect').then(status=>publish({status,error:''})).catch(()=>publish({error:'Could not disconnect. Try again.'}));}}>Disconnect</button></>}
 {error&&<p role="alert">{error}</p>}</section>;
}

export function CalendarSyncStatus(){const {status,busy,error}=useSyncExternalStore(subscribe,()=>snapshot);return <p className="calendar-sync-status" role={error?'alert':'status'}>{error|| (busy?'Syncing calendar...':status?.connected?`Google Calendar connected${status.last_sync?' - Last synced '+new Date(status.last_sync*1000).toLocaleTimeString():''}`:'Connect Google Calendar below to keep these meetings updated.')}</p>;}
