import {test} from 'node:test';
import assert from 'node:assert/strict';
import {commandFields,setDiagnosticContext,setDiagnosticRecords,opaqueId} from './diagnosticContext';

test('studio diagnostics identify operations without storing record contents',()=>{
 setDiagnosticContext({section:'designs'});
 setDiagnosticRecords([{id:'private-id',kind:'lead'}]);
 const result=commandFields('update',{change:{action:'update_studio',value:JSON.stringify({id:'private-id',patch:{email:'private@example.com',body:'Private notes',name:'Private client',unexpected:'secret'}})}});
 assert.equal(result.section,'leads');assert.equal(result.mode,'edit');assert.equal(result.record_id,opaqueId('private-id'));
 assert.equal(result.field,'body.email.name');assert.equal(result.count,3);
 for(const secret of ['private-id','private@example.com','Private notes','Private client','secret'])assert.ok(!JSON.stringify(result).includes(secret));
 const capture=commandFields('capture_items',{input:{studio:'private-id',files:[{path:'C:/private.png'}]}});
 assert.equal(capture.section,'leads');assert.equal(capture.mode,'studio_only');assert.equal(capture.count,1);
 assert.ok(!JSON.stringify(capture).includes('private.png'));
});
test('project diagnostics describe overview fields and client record types',()=>{
 const result=commandFields('update',{change:{action:'update_project_overview',target:42,value:JSON.stringify({brief:'Confidential',deadline:'2026-12-12'})}});
 assert.equal(result.section,'projects');assert.equal(result.project,42);assert.equal(result.field,'brief.deadline');
 const actual=commandFields('update',{change:{action:'update_project_overview',target:42,value:JSON.stringify({field:'brief',value:'Confidential'})}});assert.equal(actual.field,'brief');
 const handover=commandFields('update',{change:{action:'convert_studio_lead',target:42,value:'lead-private'}});assert.equal(handover.mode,'existing_project');assert.equal(handover.project,42);
 const contact=commandFields('update',{change:{action:'update_client_records',target:42,value:JSON.stringify({type:'contact',id:'contact-private',patch:{phone:'123456'}})}});
 assert.equal(contact.record_kind,'contact');assert.equal(contact.field,'phone');assert.ok(!JSON.stringify(contact).includes('123456'));
});
test('metadata snapshots remain stable and malformed updates are safe',()=>{
 setDiagnosticContext({section:'marketing',page:'campaigns'});
 const before=commandFields('get_library',{});setDiagnosticContext({section:'general'});
 assert.equal(before.section,'marketing');
 const invalid=commandFields('update',{change:{action:'update_studio',value:'private invalid json'}});
 assert.equal(invalid.error_code,'invalid_payload');assert.ok(!JSON.stringify(invalid).includes('private invalid'));
});
