export type SidebarLayout = {name:string;description:string;order:string[];row:number;inset:number;radius:number;brand?:'center'|'small'|'quiet';indent?:number;counts?:boolean};
const standard=['General','Projects','Categories','Components'];
const layout=(name:string,description:string,changes:Partial<SidebarLayout>={}):SidebarLayout=>({name,description,order:standard,row:33,inset:14,radius:5,...changes});
export const sidebarLayouts:SidebarLayout[]=[
 layout('Classic','Familiar spacing and order'),layout('Compact','More rows in less space',{row:27,inset:10,brand:'small'}),
 layout('Airy','Room to breathe',{row:40,inset:18}),layout('Edge to edge','Full-width navigation',{inset:0,radius:0}),
 layout('Inset','A narrow, padded column',{inset:22,row:35,radius:9}),layout('Centered','A centered brand above your library',{brand:'center'}),
 layout('Quiet','A small wordmark and less chrome',{brand:'quiet',row:30}),layout('Projects first','Keep current work at the top',{order:['Projects','General','Categories','Components']}),
 layout('Inspiration first','Lead with your design library',{order:['Categories','General','Projects','Components']}),layout('Components first','Build with components close at hand',{order:['Components','General','Projects','Categories']}),
 layout('Work shelf','Projects and libraries before shortcuts',{order:['Projects','Categories','Components','General'],row:30}),layout('Library first','Both libraries together at the top',{order:['Categories','Components','General','Projects']}),
 layout('Large targets','Generous rows for easy navigation',{row:44,inset:10,radius:10}),layout('Soft rows','Rounded navigation with open spacing',{row:37,radius:18}),
 layout('Squared','Tight, rectangular rows',{row:30,radius:0,inset:12}),layout('Indented','A clearer hierarchy for folders',{indent:12,row:32}),
 layout('Flat tree','Folders align with their parent sections',{indent:0,inset:10}),layout('Focus','Keep names; hide item counts',{counts:false,row:36}),
 layout('Editorial','Compact branding and generous library sections',{brand:'quiet',row:35,inset:18}),layout('Build desk','Components, projects, then inspiration',{order:['Components','Projects','Categories','General'],row:28,brand:'small'}),
];
export const readSidebarLayout=()=>{const n=Number(localStorage.getItem('sidebar-layout'));return Number.isInteger(n)&&n>=1&&n<=sidebarLayouts.length?n:1;};
export type CollectionLayout='auto'|'masonry'|'cards'|'list'|'table';
export const collectionLayouts=[['auto','Original'],['masonry','Masonry'],['cards','Cards'],['list','List'],['table','Table']] as const;
