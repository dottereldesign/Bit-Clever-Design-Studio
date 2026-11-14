import { describe, it } from "node:test";
import { deepStrictEqual as equal } from "node:assert";
import { filterItems, createMembershipIndex, designFoldersOf, orderedProjects, categoryOf, libraryCategories, type Filters, type Item } from "./model";
const items: Item[] = [
  {
    id: 1,
    name: "Calm",
    path: "C:/Design/mobile/calm.webp",
    kind: "image",
    source: "mobile",
    tags: [1],
    projects: [7],
    added: 10,
    modified: 10,
    missing: false,
  },
  {
    id: 2,
    name: "School",
    path: "C:/Design/web_design/school.mp4",
    kind: "video",
    source: "web_design/school",
    tags: [2],
    projects: [7],
    added: 20,
    modified: 20,
    missing: false,
  },
  {
    id: 3,
    name: "Sports",
    path: "https://sport.example",
    kind: "link",
    source: "",
    tags: [3],
    projects: [],
    added: 30,
    modified: 0,
    missing: false,
  },
];
const defaults: Filters = {
  search: "",
  type: "all",
  tags: [],
  source: "",
  project: null,
  linksOnly: false,
  sort: "recent",
  seed: 123,
};

it("Captures is a storage folder; unassigned captures belong to Uncategorised",()=>{
  const capture={...items[0],source:"Design/Captures"};
  equal(categoryOf(capture),"");
  equal(categoryOf({...capture,category:"Captures"}),"");
  equal(categoryOf({...capture,category:"branding"}),"branding");
  equal(libraryCategories({items:[capture],sources:["Design/Captures"],categories:["Captures","Packaging"],projects:[],tags:[],root:"",scanning:false}),["Packaging"]);
  equal(filterItems([capture],{...defaults,category:""}).length,1);
});
describe("combined library views", () => {
  it("matches all selected tags across collections in the recent views", () => {
    const board = {...items[2], source:"Fonts", tags:[1,2]};
    const library = [items[0],board];
    equal(filterItems(library,{...defaults,tags:[1,2],includeCollections:true}).length,2);
    equal(filterItems(library,{...defaults,tags:[1,2],includeCollections:true,tagMode:"all"}),[board]);
  });
  it("uses category overrides instead of disk folders, including explicit uncategorised",()=>{
    const original={...items[0],source:"Design/3d/components"};
    const moved={...original,category:"branding"};
    equal(categoryOf(original),"3d");equal(categoryOf(moved),"branding");equal(categoryOf({...moved,category:""}),"");
    equal(filterItems([moved],{...defaults,category:"3d"}).length,0);
    equal(filterItems([moved],{...defaults,category:"branding"}).map(i=>i.id),[1]);
    equal(filterItems([{...moved,source:"Photography"}],{...defaults,category:"branding",source:"Photography"}).length,1);
    equal(libraryCategories({items:[moved],sources:["Design/3d/components","Photography","Videos"],categories:["Empty"],projects:[],tags:[],root:"",scanning:false}),["3d","branding","Empty"]);
  });
  it("puts recently used projects first, ignores removed project ids and preserves source order", () => {
    const projects = [{ id: 1, name: "Alpha", count: 0 }, { id: 2, name: "Beta", count: 0 }, { id: 3, name: "Gamma", count: 0 }];
    equal(orderedProjects(projects, [3, 99, 2]).map((project) => project.id), [3, 2, 1]);
    equal(projects.map((project) => project.id), [1, 2, 3]);
  });
  it("keeps Resources separate from Links and All while allowing project membership", () => {
    const resource: Item = { ...items[2], id: 99, source: "Resources/SaaS", projects: [7] };
    const combined = [...items, resource];
    equal(filterItems(combined, { ...defaults, linksOnly: true }).map(i => i.id), [3]);
    equal(filterItems(combined, defaults).some(i => i.id === 99), false);
    equal(filterItems(combined, { ...defaults, project: 7 }).some(i => i.id === 99), true);
  });
  it("keeps thumbnail collections separate and searchable through projects and tags", () => {
    for (const source of ["Fonts", "CodePen", "Brand Guidelines"]) {
      const board: Item = { ...items[2], id: 99, source, thumbnail: "thumb.png", projects: [7], tags: [2] };
      equal(filterItems([board], defaults).length, 0);
      equal(filterItems([board], { ...defaults, collection: source }).map(i=>i.id), [99]);
      equal(filterItems([board], { ...defaults, collection: source, tags: [3] }).length, 0);
      equal(filterItems([board], { ...defaults, linksOnly: true }).length, 0);
      equal(filterItems([board], { ...defaults, project: 7, tags: [2] }).map(i=>i.id), [99]);
      equal(filterItems([board], { ...defaults, project: 7, tags: [3] }).length, 0);
    }
  });
  it("pins references ahead of the current sort only in their own project", () => {
    const library = items.map((i) => ({
      ...i,
      favourites: i.id === 1 ? [7] : [],
    }));
    equal(
      filterItems(library, { ...defaults, project: 7 }).map((i) => i.id),
      [1, 2],
    );
    equal(
      filterItems(library, defaults).map((i) => i.id),
      [3, 2, 1],
    );
    equal(
      filterItems(library, { ...defaults, project: 7, sort: "name" }).map(
        (i) => i.id,
      ),
      [1, 2],
    );
  });
  it("includes links and every media type in All", () =>
    equal(
      filterItems(items, defaults).map((i) => i.id),
      [3, 2, 1],
    ));
  it("combines project, descendant source and type filters", () =>
    equal(
      filterItems(items, {
        ...defaults,
        project: 7,
        source: "web_design",
        type: "video",
      }).map((i) => i.id),
      [2],
    ));
  it("matches any selected tag within the active project", () =>
    equal(
      filterItems(items, { ...defaults, project: 7, tags: [2, 3] }).map(
        (i) => i.id,
      ),
      [2],
    ));
  it("searches URLs without casing or surrounding-space surprises", () =>
    equal(
      filterItems(items, {
        ...defaults,
        linksOnly: true,
        search: "  SPORT.EXAMPLE  ",
      }).map((i) => i.id),
      [3],
    ));
  it("keeps shuffle stable without changing the original library order", () => {
    const before = items.map((i) => i.id);
    equal(
      filterItems(items, { ...defaults, sort: "shuffle" }),
      filterItems(items, { ...defaults, sort: "shuffle" }),
    );
    equal(
      items.map((i) => i.id),
      before,
    );
  });
});

it("Photography is a category, with explicit moves taking precedence",()=>{
  const photo={...items[0],source:"Photography"};
  equal(categoryOf(photo),"Photography");
  equal(categoryOf({...photo,source:"Photography/Captures"}),"Photography");
  equal(categoryOf({...photo,category:""}),"");
  equal(categoryOf({...photo,category:"branding"}),"branding");
  equal(filterItems([photo],{...defaults,category:"Photography"}).map(i=>i.id),[1]);
});


describe("component folder memberships",()=>{
  it("shows one component in both folders, once in All Components, and not in the inbox",()=>{
    const item={...items[0],category:"Components / Uncategorised",component_folders:["Components / Navbars","Components / Headers"]};
    for(const category of ["Components / Navbars","Components / Headers","All Components"])
      equal(filterItems([item],{...defaults,category}).map(i=>i.id),[item.id]);
    equal(filterItems([item],{...defaults,category:"Components / Uncategorised"}),[]);
    equal(filterItems([{...item,component_folders:[]}],{...defaults,category:"Components / Uncategorised"}).length,1);
  });
  it("keeps legacy and cross-section folder memberships visible",()=>{
    equal(filterItems([{...items[0],category:"Components / Navbars"}],{...defaults,category:"Components / Navbars"}).length,1);
    const regular={...items[0],category:"branding",component_folders:["Components / Navbars"]};
    equal(filterItems([regular],{...defaults,category:"Components / Navbars"}).length,1);
    equal(filterItems([regular],{...defaults,category:"branding"}).length,1);
  });
});

it("component links appear in their folder and aggregate, separately from ordinary Links",()=>{
 const link={...items[0],kind:'link' as const,path:'https://webflow.com/blog/404',source:'',category:'Components / Uncategorised',component_folders:['Components / 404 pages']};
 for(const category of ['Components / 404 pages','All Components'])equal(filterItems([link],{...defaults,category}).length,1);
 equal(filterItems([link],{...defaults,category:'Components / Headers'}).length,0);
 equal(filterItems([link],{...defaults,linksOnly:true}).length,0);
});

it("recent sorting uses destination arrival without changing import order or other component folders",()=>{
 const older={...items[0],id:10,added:10,category:"Components / Uncategorised",component_folders:["Components / Headers","Components / Navbars"],category_added:{"Components / Headers":300}};
 const newer={...older,id:20,added:200,category_added:{}};
 equal(filterItems([older,newer],{...defaults,category:"Components / Headers"}).map(i=>i.id),[10,20]);
 equal(filterItems([older,newer],{...defaults,category:"Components / Navbars"}).map(i=>i.id),[20,10]);
 equal(filterItems([older,newer],defaults).map(i=>i.id),[20,10]);
 const design={...older,category:"Branding",component_folders:[],category_added:{Branding:300}};
 equal(filterItems([design,{...newer,category:"Branding",component_folders:[]}],{...defaults,category:"Branding"}).map(i=>i.id),[10,20]);
});

it("design folders filter independently and Uncategorised excludes filed designs",()=>{
 const design={...items[0],category:"Social Media",design_folders:["Branding","Social Media"]};
 equal(filterItems([design],{...defaults,category:"Branding"}).length,1);
 equal(filterItems([design],{...defaults,category:"Social Media"}).length,1);
 equal(filterItems([design],{...defaults,category:""}).length,0);
 equal(filterItems([{...design,category:"",design_folders:[]}],{...defaults,category:""}).length,1);
 equal(filterItems([{...design,category:"Components / Uncategorised",design_folders:[]}],{...defaults,category:""}).length,0);
});

it("shared references appear in both sections with independent inboxes",()=>{
 const shared={...items[0],category:"Illustration",design_folders:["Illustration"],component_folders:["Components / Heroes"]};
 for(const category of ["Illustration","Components / Heroes","All Components"])equal(filterItems([shared],{...defaults,category}).length,1);
 for(const category of ["","Components / Uncategorised"])equal(filterItems([shared],{...defaults,category}).length,0);
 const designInbox={...shared,category:"Components / Uncategorised",design_folders:[""]};
 equal(filterItems([designInbox],{...defaults,category:""}).length,0);
 equal(filterItems([designInbox],{...defaults,category:"Components / Heroes"}).length,1);
 const componentInbox={...shared,component_folders:["Components / Uncategorised"]};
 equal(filterItems([componentInbox],{...defaults,category:"Components / Uncategorised"}).length,0);
 equal(filterItems([componentInbox],{...defaults,category:"Illustration"}).length,1);
});

it("Hero and Headers share one Header folder without duplicate references",()=>{
 const hero={...items[0],id:21,category:"Components / Heroes",component_folders:["Components / Heroes","Components / Headers"],category_added:{"Components / Heroes":400}};
 const header={...items[0],id:22,category:"Components / Headers",added:300};
 for(const category of ["Components / Headers","Components / Heroes","Components / Header"]){equal(filterItems([header,hero],{...defaults,category}).map(i=>i.id),[21,22]);}
 equal(filterItems([hero],{...defaults,category:"Components / Uncategorised"}),[]);
});

it("stale inbox markers cannot keep a moved reference in the previous section",()=>{
 const templates={...items[0],category:"Components / Uncategorised",component_folders:["Components / Templates"],design_folders:[""]};
 equal(filterItems([templates],{...defaults,category:""}).length,0);
 equal(filterItems([templates],{...defaults,category:"Components / Templates"}).length,1);
 const design={...templates,category:"Illustration",design_folders:["Illustration"],component_folders:["Components / Uncategorised"]};
 equal(filterItems([design],{...defaults,category:"Components / Uncategorised"}).length,0);
 equal(filterItems([design],{...defaults,category:"Illustration"}).length,1);
});

it("Websites stays separate from Links and filters by existing tags",()=>{
 const website={...items[0],kind:'link' as const,path:'https://inspiring.example/',source:'Websites',thumbnail:'thumb.png',tags:[4]};
 equal(filterItems([website],{...defaults,collection:'Websites',tags:[4]}).length,1);
 equal(filterItems([website],{...defaults,collection:'Websites',tags:[5]}).length,0);
 equal(filterItems([website],{...defaults,linksOnly:true}).length,0);
});

it("project-first media is absent from Design Inspo but remains in its project",()=>{
 const privateItem:Item={...items[0],source:'Design/Captures',category:null,project_only:true};
 equal(designFoldersOf(privateItem),[]);
 equal(filterItems([privateItem],{...defaults,category:''}),[]);
 equal(filterItems([privateItem],{...defaults,project:7}).map(i=>i.id),[privateItem.id]);
 equal(designFoldersOf({...privateItem,project_only:false}),['']);
 equal(designFoldersOf({...privateItem,project_only:false,category:'Illustration'}),['Illustration']);
});

describe('membership index', () => {
  const library: Item[] = [
    {...items[0], id:101, source:'Design/Captures', category:null, project_only:true, project_folders:[11]},
    {...items[0], id:102, category:'Illustration', design_folders:['Illustration','Logo'], component_folders:['Components / Hero','Components / Headers'], project_folders:[11,12], favourites:[7]},
    {...items[1], id:103, category:'Web Design', projects:[8], project_folders:[13]},
    {...items[1], id:104, category:'', source:'Design/Captures'},
    {...items[0], id:105, category:'Components / Pricing', design_folders:['Logo'], projects:[7,8]},
    {...items[2], id:106, source:'Fonts', projects:[7], project_folders:[11], rating:5},
    {...items[2], id:107, source:'', category:'Components / Pricing', design_folders:['Logo'], rating:4},
    {...items[2], id:108, source:'Resources/Tools', projects:[7]},
    {...items[0], id:109, category:'Components / Headers', category_added:{'Components / Hero':1000}},
    {...items[2], id:110, source:'', category:'Logo'},
  ];
  it('matches the scan for combined filters, legacy aliases, shared memberships and every sort', () => {
    const index = createMembershipIndex(library);
    const folders = [undefined, '', 'Logo', 'Illustration', 'Components / Pricing', 'Components / Hero', 'Components / Headers', 'Components / Uncategorised', 'All Components', 'Absent'];
    const extra: Partial<Filters>[] = [{}, {designsOnly:true}, {project:7}, {project:8}, {project:999},
      {project:7,projectFolder:'unfiled',projectFolderIds:[11,12]}, {project:7,projectFolder:11},
      {project:7,projectFolder:13}, {projectFolder:999}, {collection:'Fonts'}, {includeCollections:true},
      {tags:[1,2],tagMode:'all'}, {tags:[1,3]}, {linksOnly:true}, {type:'video'}, {search:'calm'},
      {source:'Resources'}, {rating:'4+'}, {rating:'unrated'}];
    for (const category of folders) for (const filters of extra) for (const sort of ['recent','name','shuffle','rating-high','rating-low']) {
      const f = {...defaults,category,sort,...filters};
      equal(filterItems(library,f,index), filterItems(library,f));
    }
    equal(index.categories.get('Components / Headers')?.map(i=>i.id),[102,109]);
    equal(index.categories.get('Logo')?.map(i=>i.id),[102,105,107]);
    equal(index.categories.get('')?.some(i=>i.id===101),false);
  });

  it('rebuilds from import, move, removal, undo/redo and restored snapshots without retaining stale memberships', () => {
    const moved = library.map(i=>i.id===104?{...i,category:'Components / Pricing'}:i);
    const imported = [...moved,{...library[0],id:200,project_only:false,category:'Logo'}];
    const removed = imported.filter(i=>i.id!==102);
    const snapshots = [library,moved,imported,removed,imported,removed,structuredClone(library)];
    let previous = createMembershipIndex([]);
    for (const snapshot of snapshots) {
      const index = createMembershipIndex(snapshot);
      for (const category of ['', 'Logo', 'Components / Pricing', 'All Components']) {
        const f = {...defaults,category};
        equal(filterItems(snapshot,f,index),filterItems(snapshot,f));
        equal(filterItems(snapshot,f,previous),filterItems(snapshot,f));
      }
      previous = index;
    }
  });
});
