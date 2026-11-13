import ICAL from 'ical.js';
export type Meeting={source_id:string;uid:string;name:string;project_name:string;start:string;end:string;location:string;join_url:string;source_url:string;cancelled:boolean};
export type CalendarStatus={connected:boolean;last_sync:number;meetings:Meeting[]};
export function nzTime(date:Date):string{
 const parts=new Intl.DateTimeFormat('en-NZ',{timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const get=(key:string)=>parts.find(p=>p.type===key)!.value;
 const wall=`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
 const offset=Math.round((Date.parse(wall+'Z')-date.getTime())/60000);
 return `${wall}${offset>=0?'+':'-'}${String(Math.floor(Math.abs(offset)/60)).padStart(2,'0')}:${String(Math.abs(offset)%60).padStart(2,'0')}`;
}
export function selectedMeetings(text:string,rules:Meeting[]):Meeting[]{
 let root:ICAL.Component;
 try{root=new ICAL.Component(ICAL.parse(text));}catch{throw Error('Calendar could not be read. Saved meetings are unchanged.');}
 if(root.name!=='vcalendar')throw Error('The feed is not a calendar.');
 ICAL.TimezoneService.reset();for(const zone of root.getAllSubcomponents('vtimezone'))ICAL.TimezoneService.register(zone);
 const components=root.getAllSubcomponents('vevent');
 if(rules.length&&rules.every(r=>r.uid)&&!components.some(c=>rules.some(r=>r.uid===String(c.getFirstPropertyValue('uid')))))throw Error('None of the selected meetings were found. Check the source calendar; saved meetings are unchanged.');
 return rules.map(rule=>{
  const aliases=[rule.uid,rule.source_id,rule.source_id+'@google.com'].filter(Boolean);
  const named=components.filter(c=>aliases.includes(String(c.getFirstPropertyValue('uid'))));
  const candidates=named.length?named:rule.uid?[]:components.filter(c=>String(c.getFirstPropertyValue('summary'))===rule.name);
  if(candidates.length===0){if(rule.uid)return {...rule,cancelled:true};throw Error('A selected meeting could not be identified in this feed. Saved meetings are unchanged.');}
  if(candidates.length!==1)throw Error('A selected meeting has multiple occurrences. Saved meetings are unchanged; select a single dated meeting.');
  const c=candidates[0];const uid=String(c.getFirstPropertyValue('uid')??'');
  if(c.getFirstPropertyValue('status')==='CANCELLED')return {...rule,uid,cancelled:true};
  if(c.hasProperty('rrule')||c.hasProperty('recurrence-id'))throw Error('A selected meeting is recurring. This connection currently requires individual dated meetings.');
  for(const key of ['dtstart','dtend']){const tz=c.getFirstProperty(key)?.getParameter('tzid');if(tz&&!ICAL.TimezoneService.has(String(tz)))throw Error('The meeting timezone is missing from the feed. Saved meetings are unchanged.');}
  const e=new ICAL.Event(c);if(!e.startDate||!e.endDate)throw Error('A selected meeting is missing its date.');
  const start=nzTime(e.startDate.toJSDate()),end=nzTime(e.endDate.toJSDate());
  if(!named.length&&Date.parse(start)!==Date.parse(rule.start))throw Error('The initial meeting date differs. Re-select the meeting before syncing.');
  if(Date.parse(end)<Date.parse(start))throw Error('A meeting end time is invalid.');
  const description=String(c.getFirstPropertyValue('description')??'');
  const join=description.match(/https:\/\/meet\.google\.com\/[a-z-]+/i)?.[0]??rule.join_url;
  return {...rule,uid,name:e.summary||rule.name,start,end,location:String(c.getFirstPropertyValue('location')??rule.location),join_url:join,cancelled:false};
 });
}
