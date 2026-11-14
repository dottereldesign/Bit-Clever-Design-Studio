import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contrast,defaultTabs,normalizeTabs,tabPalette,tabThemes} from './tabTheme';

function checkPalette(theme:string,colour='#315c3e'){
 const p=tabPalette({...defaultTabs,theme,colour});
 for(const bg of [p.surface,p.tint,p.hover]){
  assert.ok(contrast(p.ink,bg)>=4.5,`${theme} body text on ${bg}`);
  assert.ok(contrast(p.accent,bg)>=4.5,`${theme} selected text on ${bg}`);
 }
 assert.ok(contrast(p.onAccent,p.accent)>=4.5,`${theme} solid text`);
 assert.ok(contrast(p.accent,p.surface)>=3,`${theme} focus and selection`);
}
test('Every theme passes text, hover, solid and indicator contrast',()=>{
 for(const theme of tabThemes)checkPalette(theme.id);
});
test('Custom colours remain readable across the RGB cube including black and white',()=>{
 for(const r of [0,51,102,153,204,255])for(const g of [0,51,102,153,204,255])for(const b of [0,51,102,153,204,255])checkPalette('custom','#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join(''));
});
test('Malformed preferences fall back safely and motion off survives',()=>{
 assert.deepEqual(normalizeTabs(null),defaultTabs);
 assert.deepEqual(normalizeTabs({style:'nope',theme:'bad',colour:'url(secret)',motion:42}),defaultTabs);
 assert.equal(normalizeTabs({motion:false}).motion,false);
});
