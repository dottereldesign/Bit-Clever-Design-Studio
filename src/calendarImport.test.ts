import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectedMeetings,calendarCandidates,nzTime,type Meeting} from './calendarImport';
const rule:Meeting={source_id:'chosen',uid:'chosen@google.com',name:'Project meeting',project_name:'Example',start:'2026-11-27T11:00:00+13:00',end:'2026-11-27T12:00:00+13:00',location:'Room',join_url:'',source_url:'https://calendar.google.com/',cancelled:false};
const feed=(body:string)=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR`;
const event=(id:string,extra='')=>`BEGIN:VEVENT\r\nUID:${id}\r\nSUMMARY:Project meeting\r\nDTSTART:20261126T220000Z\r\nDTEND:20261126T230000Z\r\n${extra}\r\nEND:VEVENT`;
test('selected meeting sync excludes unrelated events and retains NZ day and time',()=>{
 const result=selectedMeetings(feed(event('chosen@google.com')+'\r\n'+event('private')), [rule]);
 assert.equal(result.length,1);assert.equal(result[0].start,'2026-11-27T11:00:00+13:00');assert.equal(result[0].end,'2026-11-27T12:00:00+13:00');
 assert.equal(nzTime(new Date('2026-07-01T00:00:00Z')),'2026-07-01T12:00:00+12:00');
});
test('cancellation is retained and rescheduled events keep their identity',()=>{
 assert.equal(selectedMeetings(feed(event(rule.uid,'STATUS:CANCELLED')),[rule])[0].cancelled,true);
 const changed=selectedMeetings(feed(event(rule.uid).replace('20261126T220000Z','20261126T223000Z')),[rule])[0];
 assert.equal(changed.source_id,rule.source_id);assert.equal(changed.start,'2026-11-27T11:30:00+13:00');
});
test('an unrelated feed cannot silently remove every selected meeting',()=>{assert.throws(()=>selectedMeetings(feed(event('unrelated')),[rule]),/None of the selected/);});
test('ambiguous, recurring and unknown-zone meetings fail without a partial result',()=>{
 assert.throws(()=>selectedMeetings(feed(event(rule.uid)+'\r\n'+event(rule.uid)),[rule]),/multiple/);
 assert.throws(()=>selectedMeetings(feed(event(rule.uid,'RRULE:FREQ=WEEKLY')),[rule]),/recurring/);
 assert.throws(()=>selectedMeetings(feed(event(rule.uid).replace('DTSTART:20261126T220000Z','DTSTART;TZID=Unknown/Zone:20261127T110000')),[rule]),/timezone/);
 assert.throws(()=>selectedMeetings(feed(event('other')),[{...rule,uid:'',name:'Different'}]),/identified/);
});

test('meeting picker lists candidates without importing them and identifies unsupported recurrence',()=>{
 const candidates=calendarCandidates(feed(event('first')+'\r\n'+event('second','RRULE:FREQ=WEEKLY')+'\r\n'+event('cancelled','STATUS:CANCELLED')));
 assert.equal(candidates.length,2);assert.equal(candidates[0].project_name,'');assert.equal(candidates[0].start,'2026-11-27T11:00:00+13:00');
 assert.match(candidates.find(m=>m.uid==='second')!.unavailable!,/Recurring/);
 assert.equal(candidates.find(m=>m.uid==='first')!.unavailable,undefined);
});
