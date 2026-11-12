import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankEntry,followUpGroup,calendarEntries} from './studio';

test('follow-ups separate closed work and undated actions from due dates',()=>{
 const lead=blankEntry('lead','Example');
 lead.actions=[{id:'a',text:'Follow up',done:false,deadline:'2026-11-12'}];
 assert.equal(followUpGroup(lead,'2026-11-13'),'Overdue');
 lead.actions[0].deadline='2026-11-13';assert.equal(followUpGroup(lead,'2026-11-13'),'Today');
 lead.actions[0].deadline='2026-11-14';assert.equal(followUpGroup(lead,'2026-11-13'),'Upcoming');
 lead.actions[0].deadline='';assert.equal(followUpGroup(lead,'2026-11-13'),'No date');
 lead.status='won';assert.equal(followUpGroup(lead,'2026-11-13'),'Closed leads');
});
test('archiving a campaign hides its content from calendars without archiving the content',()=>{
 const campaign=blankEntry('campaign','Launch'),content=blankEntry('content','Post'),idea=blankEntry('content','Independent idea');content.parent=campaign.id;
 assert.equal(calendarEntries([campaign,content,idea]).length,3);
 assert.deepEqual(calendarEntries([campaign,content,idea],campaign.id).map(e=>e.id),[campaign.id,content.id]);
 campaign.archived=true;assert.deepEqual(calendarEntries([campaign,content,idea]).map(e=>e.id),[idea.id]);assert.equal(content.archived,false);
 campaign.archived=false;assert.equal(calendarEntries([campaign,content,idea]).length,3);
});
