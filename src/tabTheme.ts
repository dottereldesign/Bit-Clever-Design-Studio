export const tabStyles=[
 ['underline','Ink underline','A fine line grows beneath the selected tab.'],
 ['soft','Soft tiles','Quiet tinted tiles with a gentle hover lift.'],
 ['pill','Pill parade','Rounded capsules with a soft press.'],
 ['solid','Solid statement','A strong filled tab with contrasting text.'],
 ['outline','Fine frame','An outlined selection and subtle hover tint.'],
 ['segment','Segmented','Inset keys on a continuous tinted track.'],
 ['folder','File folders','Rounded shoulders like a paper folder.'],
 ['raised','Raised cards','Floating cards with a small hover lift.'],
 ['inset','Inset keys','Pressed surfaces with an inner shadow.'],
 ['double','Double rule','Parallel rules frame the selected label.'],
 ['rail','Side rail','A strong vertical accent beside the label.'],
 ['brackets','Brackets','Open-ended frames around the selection.'],
 ['ribbon','Ribbon','Opposing rounded corners gently reshape.'],
 ['ticket','Ticket','A stitched outline becomes a solid frame.'],
 ['block','Offset blocks','Crisp geometry and a tactile offset shadow.'],
 ['glass','Frosted tiles','Opaque, readable frost with a bright inset edge.'],
 ['sweep','Colour sweep','A tinted wash travels across on hover.'],
 ['satin','Satin','A quiet highlight glides across the surface.'],
 ['halo','Halo','A soft outer halo appears on hover.'],
 ['bookmark','Bookmarks','A top rule and a tab-shaped lower edge.'],
] as const;
export const tabThemes=[
 {id:'sage',name:'Sage',accent:'#315c3e'},
 {id:'ocean',name:'Ocean',accent:'#145d79'},
 {id:'teal',name:'Teal',accent:'#006b65'},
 {id:'violet',name:'Violet',accent:'#6941a5'},
 {id:'rose',name:'Rose',accent:'#9b3558'},
 {id:'amber',name:'Amber',accent:'#805500'},
 {id:'clay',name:'Clay',accent:'#944329'},
 {id:'mono',name:'Monochrome · Ink',accent:'#333333'},
 {id:'graphite',name:'Monochrome · Graphite',accent:'#555555'},
 {id:'night',name:'Monochrome · Night',accent:'#dedede',dark:true},
] as const;
export type TabPreferences={style:string;theme:string;colour:string;motion:boolean};
export const defaultTabs:TabPreferences={style:'soft',theme:'sage',colour:'#315c3e',motion:true};
export function normalizeTabs(value:unknown):TabPreferences{
 const v=value as Partial<TabPreferences>|null;
 return {style:tabStyles.some(([id])=>id===v?.style)?v!.style!:defaultTabs.style,
 theme:tabThemes.some(t=>t.id===v?.theme)||v?.theme==='custom'?v!.theme!:defaultTabs.theme,
 colour:typeof v?.colour==='string'&&/^#[0-9a-f]{6}$/i.test(v.colour)?v.colour:defaultTabs.colour,
 motion:typeof v?.motion==='boolean'?v.motion:true};
}
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export function mixColour(a:string,b:string,weight:number){return '#'+rgb(a).map((c,i)=>Math.round(c*weight+rgb(b)[i]*(1-weight)).toString(16).padStart(2,'0')).join('');}
export function contrast(a:string,b:string){
 const luminance=(s:string)=>rgb(s).map(c=>{const n=c/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
 const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export function tabPalette(p:TabPreferences){
 const theme=tabThemes.find(t=>t.id===p.theme),dark=theme&&'dark' in theme&&theme.dark;
 const surface=dark?'#202020':'#ffffff',ink=dark?'#f5f5f5':'#202820',onAccent=dark?'#151515':'#ffffff';
 let accent=p.theme==='custom'?p.colour:theme?.accent??defaultTabs.colour;
 const tint=mixColour(accent,surface,dark?.12:.10),hover=mixColour(accent,surface,dark?.20:.17);
 // Preserve the chosen hue while keeping text, selection and focus legible.
 for(let i=0;i<100&&(contrast(accent,surface)<4.5||contrast(accent,tint)<4.5||contrast(accent,hover)<4.5||contrast(accent,onAccent)<4.5);i++)accent=mixColour(accent,dark?'#ffffff':'#000000',.93);
 return {surface,ink,accent,onAccent,tint,hover};
}
