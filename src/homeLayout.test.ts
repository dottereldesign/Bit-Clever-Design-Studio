import test from "node:test";
import assert from "node:assert/strict";
import { homeLayout, moveDivider } from "./homeLayout";
const tiles=Array.from({length:4},(_,i)=>({id:String(i),height:224,radius:18}));
test("dragged divider follows pixels while preserving the partition and other branches",()=>{
 const initial=homeLayout(tiles,1400,850),divider=initial.dividers.find(d=>d.path==='roota')!;
 const plan=moveDivider(initial.plan,divider,23,true),next=homeLayout(tiles,1400,850,plan);
 const moved=next.dividers.find(d=>d.path===divider.path)!;
 assert.ok(Math.abs((divider.axis==='x'?moved.left-divider.left:moved.top-divider.top)-23)<.001);
 for(const [path,split] of Object.entries(initial.plan.splits)){assert.equal(next.plan.splits[path].axis,split.axis);assert.equal(next.plan.splits[path].split,split.split);}
 for(const i of [2,3])assert.deepEqual(next.positions[i],initial.positions[i]);
 assert.notDeepEqual(next.positions[0],initial.positions[0]);
});
test("snap is gentle and optional; constraints cannot collapse a neighbouring tile",()=>{
 const layout=homeLayout(tiles,1400,850),d=layout.dividers[0];
 const nearHalf=(.5-d.ratio)*d.length+3;
 assert.equal(moveDivider(layout.plan,d,nearHalf).splits.root.ratio,.5);
 assert.notEqual(moveDivider(layout.plan,d,nearHalf,true).splits.root.ratio,.5);
 assert.equal(moveDivider(layout.plan,d,-100000).splits.root.ratio,d.min);
 assert.equal(moveDivider(layout.plan,d,100000).splits.root.ratio,d.max);
});
test("swapping contents and resizing the viewport preserve the saved layout topology",()=>{
 const initial=homeLayout(tiles,1400,850),plan=moveDivider(initial.plan,initial.dividers[0],93,true);
 const swapped=[tiles[3],tiles[1],tiles[2],tiles[0]];
 assert.deepEqual(homeLayout(swapped,1400,850,plan).positions,homeLayout(tiles,1400,850,plan).positions);
 const narrow=homeLayout(swapped,600,650,plan);
 for(const [path,split] of Object.entries(plan.splits)){assert.equal(narrow.plan.splits[path].axis,split.axis);assert.equal(narrow.plan.splits[path].split,split.split);}
 for(const r of narrow.positions)assert.ok(r.left>=0&&r.top>=0&&r.left+r.width<=600.001&&r.top+r.height<=650.001);
});
test("old or malformed saved splits recover safely",()=>{
 const layout=homeLayout(tiles,1400,850,{count:4,splits:{root:{split:900,axis:'x',ratio:NaN}}});
 assert.equal(layout.positions.length,4);assert.ok(layout.positions.every(p=>p.width>0&&p.height>0));
 const single=homeLayout(tiles.slice(0,1),800,600,layout.plan);
 assert.deepEqual(single.positions,[{left:0,top:0,width:800,height:600}]);assert.equal(single.dividers.length,0);
});
