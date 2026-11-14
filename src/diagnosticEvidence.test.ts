import {test} from 'node:test';
import assert from 'node:assert/strict';
import {codeFrames,errorEvidence,incidentTimeline,type EvidenceEvent} from './diagnosticEvidence';
test('error evidence preserves app locations without messages, paths or credentials',()=>{
 const error=new TypeError('Private client private@example.com token=secret');
 error.stack='TypeError: Private client\n at save (http://localhost:1420/src/StudioWorkspace.tsx?t=123:45:9)\n at work (C:\\Users\\Private\\src\\App.tsx:99:2)\n at remote (https://secret.example/private.js:8:1)';
 const evidence=errorEvidence(error);
 assert.equal(evidence.code_frames,'StudioWorkspace.tsx:45:9,App.tsx:99:2');assert.equal(evidence.error_type,'TypeError');
 for(const secret of ['Private','@','secret','localhost','Users','http'])assert.ok(!JSON.stringify(evidence).includes(secret));
 assert.deepEqual(errorEvidence(error),evidence);assert.notEqual(errorEvidence(new Error('another')).error_fingerprint,evidence.error_fingerprint);
 assert.equal(codeFrames('http://tauri.localhost/assets/index-abc.js:22:3'),'index-abc.js:22:3');
 assert.equal(codeFrames(null),'');assert.equal(errorEvidence('native failed','http://localhost/src/api.ts:3:4').code_frames,'api.ts:3:4');
});
test('incident timeline relates commands and interactions without treating empty IDs as related',()=>{
 const event=(time:number,operation:string,interaction=''):EvidenceEvent=>({time,name:'test',operation,status:'success',duration:0,fields:{interaction}});
 const selected=event(20000,'op','gesture');const rows=[event(0,''),event(0,'op'),event(1000,'other','gesture'),event(19000,'near'),event(40000,'unrelated')];
 assert.deepEqual(incidentTimeline(rows,selected).map(e=>e.operation),['op','other','near','op']);
 assert.equal(incidentTimeline([event(0,'')],event(20000,'')).length,1);
 assert.equal(incidentTimeline(Array.from({length:200},(_,i)=>event(20001+i,'op')),selected).length,120);
});
