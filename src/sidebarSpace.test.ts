import test from "node:test";
import assert from "node:assert/strict";
import { shareSidebarSpace, sidebarBodySpace } from "./useSidebarSpace";
test("long folder lists reclaim all space left by short sections",()=>{
 assert.deepEqual(shareSidebarSpace([50,100,2000],1000),[50,100,850]);
 assert.deepEqual(shareSidebarSpace([2000],1200),[1200]);
});
test("simultaneous long lists share space without crowding out section headings",()=>{
 assert.deepEqual(shareSidebarSpace([1000,1000,60],500),[220,220,60]);
 assert.deepEqual(shareSidebarSpace([200,300],-50),[0,0]);
 assert.deepEqual(shareSidebarSpace([],500),[]);
});
test("short lists retain their natural height",()=>assert.deepEqual(shareSidebarSpace([50,80],1000),[50,80]));

test('expanded sections keep usable rows when sidebar headers exceed the viewport',()=>{
 assert.deepEqual(sidebarBodySpace([300,240,20],-80),[96,96,20]);
 assert.deepEqual(sidebarBodySpace([300],0),[96]);
});
