import type { HomeTile } from "./HomeDashboard";
export type Split = { split:number; axis:"x"|"y"; ratio:number };
export type HomePlan = { count:number; splits:Record<string,Split> };
export type Divider = { path:string; axis:"x"|"y"; ratio:number; min:number; max:number; left:number; top:number; width:number; height:number; origin:number; length:number; primary:number };
export function homeLayout(tiles:HomeTile[],width:number,height:number,saved?:HomePlan|null){
  const columns=12,gap=Math.min(10,width/40,height/40),unit=Math.max(1,(width-gap*(columns-1))/columns);
  const positions=tiles.map(()=>({left:0,top:0,width:0,height:0})),dividers:Divider[]=[];
  const plan:HomePlan={count:tiles.length,splits:{}};
  const preferences=tiles.map(tile=>{const w=(tile.span??6)*60,h=tile.cover&&tile.autoImageSize?w*tile.cover.height/tile.cover.width:tile.height;return {weight:w*Math.max(64,Math.min(900,h)),ratio:Math.max(.25,Math.min(4,w/h))};});
  const fill=(start:number,end:number,left:number,top:number,w:number,h:number,path:string)=>{
    if(end-start===1){positions[start]={left,top,width:w,height:h};return;}
    const total=preferences.slice(start,end).reduce((sum,p)=>sum+p.weight,0);
    let split=start+1,best=Infinity,weight=0;
    for(let i=start+1;i<end;i++){weight+=preferences[i-1].weight;const score=Math.abs(weight/total-.5);if(score<best){best=score;split=i;}}
    const preferred=preferences.slice(start,end).reduce((sum,p)=>sum+p.ratio*p.weight,0)/total;
    let ratio=preferences.slice(start,split).reduce((sum,p)=>sum+p.weight,0)/total,axis:Split['axis']=w/h>preferred?'x':'y';
    const stored=saved?.count===tiles.length?saved.splits?.[path]:undefined;
    if(stored&&Number.isInteger(stored.split)&&stored.split>start&&stored.split<end&&(stored.axis==='x'||stored.axis==='y')&&Number.isFinite(stored.ratio)){
      split=stored.split;axis=stored.axis;ratio=stored.ratio;
    }
    const length=(axis==='x'?w:h)-gap;
    // Keep both sides usable; dense dashboards degrade proportionally rather than scrolling.
    const min=Math.min(.3,(axis==='x'?100:72)/Math.max(1,length)),max=1-min;
    ratio=Math.max(min,Math.min(max,ratio));plan.splits[path]={split,axis,ratio};
    const cut=Math.max(0,length)*ratio;
    dividers.push({path,axis,ratio,min,max,left:axis==='x'?left+cut:left,top:axis==='y'?top+cut:top,width:axis==='x'?gap:w,height:axis==='y'?gap:h,origin:axis==='x'?left:top,length,primary:start});
    if(axis==='x'){fill(start,split,left,top,cut,h,path+'a');fill(split,end,left+cut+gap,top,w-cut-gap,h,path+'b');}
    else{fill(start,split,left,top,w,cut,path+'a');fill(split,end,left,top+cut+gap,w,h-cut-gap,path+'b');}
  };
  if(tiles.length&&width>0&&height>0)fill(0,tiles.length,0,0,width,height,'root');
  return {positions,height,columns,unit,gap,plan,dividers};
}
export function moveDivider(plan:HomePlan,divider:Divider,pixels:number,precise=false){
  let ratio=Math.max(divider.min,Math.min(divider.max,divider.ratio+pixels/Math.max(1,divider.length)));
  if(!precise){const stop=[1/3,.5,2/3].find(value=>Math.abs(value-ratio)*divider.length<6);if(stop!==undefined)ratio=Math.max(divider.min,Math.min(divider.max,stop));}
  return {...plan,splits:{...plan.splits,[divider.path]:{...plan.splits[divider.path],ratio}}};
}
