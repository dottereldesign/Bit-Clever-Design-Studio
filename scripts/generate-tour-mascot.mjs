// Original vector redraw of the supplied mascot reference. No raster embeds.
// Each cell and cutout shares a 240 × 300 canvas, keeping animation registration stable.
import {mkdirSync,writeFileSync} from 'node:fs';
const directory=new URL('../public/mascot/',import.meta.url);
mkdirSync(directory,{recursive:true});
const wrap=(body,w=240,h=300)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
function character(frame,talking){
 const wave=Math.sin(frame*Math.PI*2/9), bob=(wave*1.5).toFixed(2),tail=(wave*3).toFixed(2);
 const blink=!talking&&frame===6;
 const mouths=[`<path d="M73 122q5 3 10 0" fill="none" stroke="#080808" stroke-width="3"/>`,`<ellipse cx="78" cy="123" rx="5" ry="4"/>`,`<ellipse cx="78" cy="125" rx="6" ry="8"/>`,`<path d="M69 119q9-3 18 0q-1 18-10 16q-7-2-8-16Z"/>`,`<ellipse cx="78" cy="124" rx="5" ry="7"/>`,`<path d="M68 120q10 2 20 0q-3 13-11 11q-7-2-9-11Z"/>`,`<ellipse cx="78" cy="123" rx="6" ry="3"/>`,`<ellipse cx="78" cy="124" rx="4" ry="6"/>`,`<path d="M73 122q5 3 10 0" fill="none" stroke="#080808" stroke-width="3"/>`];
 return `<g fill="#080808" stroke-linecap="round" stroke-linejoin="round">
 <path d="M74 206C77 226 86 242 80 258C72 277 81 286 91 280C105 270 109 245 118 226C123 246 131 257 128 271C126 287 139 288 147 278C163 252 172 218 169 204Z"/>
 <g transform="translate(0 ${bob})"><path transform="rotate(${tail} 163 203)" d="M155 197C179 205 184 184 201 178C217 172 227 183 221 196C212 220 188 233 161 226Z"/>
 <path d="M120 76C152 82 173 112 177 152C183 185 176 219 154 231L93 222C72 199 72 109 120 76Z"/>
 <path d="M43 69L48 44Q49 35 62 40L95 17Q102 12 102 22L103 47Q124 26 131 35Q138 40 136 70Z"/>
 <path d="M69 42L96 25L96 47Z" fill="white"/>
 <path d="M38 68Q78 72 145 66L143 211Q105 207 91 210L49 217Q40 194 38 68Z" fill="white" stroke="#080808" stroke-width="7"/>
 ${blink?`<path d="M51 103q10 5 19 0m9 0q10 5 19 0" fill="none" stroke="#080808" stroke-width="4"/>`:`<ellipse cx="62" cy="102" rx="11" ry="15" fill="white" stroke="#080808" stroke-width="4"/><ellipse cx="90" cy="101" rx="11" ry="15" fill="white" stroke="#080808" stroke-width="4"/><ellipse cx="63" cy="102" rx="4.5" ry="8"/><ellipse cx="90" cy="101" rx="4.5" ry="8"/>`}
 ${talking?mouths[frame]:`<ellipse cx="78" cy="123" rx="4" ry="2"/>`}
 <path d="M153 120C139 116 125 107 114 112C99 119 119 132 132 139L157 153Z"/>
 </g></g>`;
}
for(const mode of ['idle','talking']){
 const cells=[];
 for(let i=0;i<9;i++){
  const body=character(i,mode==='talking');
  writeFileSync(new URL(`${mode}-${i+1}.svg`,directory),wrap(body));
  cells.push(`<g transform="translate(${i%3*240} ${Math.floor(i/3)*300})">${body}</g>`);
 }
 writeFileSync(new URL(`${mode}-sheet.svg`,directory),wrap(cells.join(''),720,900));
}
