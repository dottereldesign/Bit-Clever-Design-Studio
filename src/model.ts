import { allComponents, filingCategory, isComponent, isWebDesign, componentInbox, isHeaderFolder } from "./componentsLibrary";
export type ProjectOverviewData={project_id:number;brief:string;status:string;deadline:string;actions:{id:string;text:string;deadline:string;done:boolean}[]};
export type ProjectFolder = {id:number;project_id:number;parent_id:number|null;name:string;position:number|null};
export type Item = {
  project_only?:boolean;
  rating?: number|null;
  project_folders?: number[];
  id: number;
  path: string;
  name: string;
  kind: "image" | "video" | "animation" | "link" | "file";
  source: string;
  modified: number;
  added: number;
  category_added?: Record<string,number>;
  missing: boolean;
  tags: number[];
  projects: number[];
  favourites?: number[];
  source_url?: string;
  thumbnail?: string;
  category?: string | null;
  component_folders?: string[];
  design_folders?: string[];
};
export type Label = { id: number; name: string; count: number };
export const isResource = (item: Item) => item.kind === "link" && (item.source === "Resources" || item.source.startsWith("Resources/"));
export const boardNames = { websites: "Websites", fonts: "Fonts", codepen: "CodePen", "brand-guidelines": "Brand Guidelines" };
export type BoardKey = keyof typeof boardNames;
export type LinkDestination = "links" | "resources" | BoardKey;
export const isBoardDestination = (destination: string): destination is BoardKey => Object.hasOwn(boardNames, destination);
export const isBoardLink = (item: Item) => item.kind === "link" && Object.values(boardNames).includes(item.source);
export const isTableCollection = (destination: string | null) => destination === "fonts" || destination === "brand-guidelines";
export const isTableLink = (item: Item) => item.kind === "link" && (item.source === "Fonts" || item.source === "Brand Guidelines");
export const isCollectionLink = (item: Item) => isResource(item) || isBoardLink(item) || (item.kind === "link" && componentFoldersOf(item).length>0);
export const canCopyImage = (item: Item) => item.kind === "image" || item.kind === "animation";
export type Library = {
  project_overviews?: ProjectOverviewData[];
  project_folders?: ProjectFolder[];
  undo_entries?: {id:number;label:string}[];
  undo_label?: string | null;
  undo_count?: number;
  redo_label?: string | null;
  redo_count?: number;
  categories?: string[];
  items: Item[];
  projects: Label[];
  tags: Label[];
  sources: string[];
  root: string;
  scanning: boolean;
  recent_projects?: number[];
  source_paths?: [string, string][];
};
export function orderedProjects(projects: Label[], recent: number[] = []) {
  const rank = new Map(recent.map((id, index) => [id, index]));
  return [...projects].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || a.name.localeCompare(b.name));
}
export type Filters = {
  designsOnly?: boolean;
  projectFolder?: number|"unfiled"|null;
  projectFolderIds?:number[];
  rating?:string;
  includeCollections?: boolean;
  tagMode?: "any" | "all";
  category?: string | null;
  collection?: string;
  search: string;
  type: string;
  tags: number[];
  source: string;
  project: number | null;
  linksOnly: boolean;
  sort: string;
  seed: number;
};
// Derived from one immutable library snapshot. Never persisted or incrementally
// patched: imports, edits, undo/redo and restores all replace the item array.
export type MembershipIndex = {
  items: Item[];
  categories: ReadonlyMap<string, Item[]>;
  projects: ReadonlyMap<number, Item[]>;
  projectFolders: ReadonlyMap<number, Item[]>;
  designs: Item[];
};
export function createMembershipIndex(items: Item[]): MembershipIndex {
  const categories = new Map<string, Item[]>();
  const projects = new Map<number, Item[]>();
  const projectFolders = new Map<number, Item[]>();
  const designs: Item[] = [];
  const add = <K,>(map: Map<K, Item[]>, key: K, item: Item) => {
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  };
  for (const item of items) {
    const components = componentFoldersOf(item), folders = designFoldersOf(item);
    if (folders.length) designs.push(item);
    // Match the existing folder visibility rule for ordinary links.
    if (item.kind !== 'link' || components.length) {
      for (const folder of [...components, ...folders]) add(categories, folder, item);
      if (components.length) add(categories, allComponents, item);
    }
    for (const project of new Set(item.projects)) add(projects, project, item);
    for (const folder of new Set(item.project_folders)) add(projectFolders, folder, item);
  }
  return { items, categories, projects, projectFolders, designs };
}

export function filterItems(items: Item[], f: Filters, index?: MembershipIndex): Item[] {
  if(f.category!=null&&isHeaderFolder(f.category))f={...f,category:filingCategory(f.category)};
  // A stale index must never hide a newly imported or restored item.
  if (index?.items !== items) index = undefined;
  let candidates = items;
  const categoryItems = index && f.category != null ? index.categories.get(f.category) ?? [] : undefined;
  const designItems = index && f.designsOnly ? index.designs : undefined;
  const options = [categoryItems, designItems,
    index && f.project ? index.projects.get(f.project) ?? [] : undefined,
    index && typeof f.projectFolder === 'number' ? index.projectFolders.get(f.projectFolder) ?? [] : undefined];
  for (const bucket of options) if (bucket && bucket.length <= candidates.length) candidates = bucket;
  const query = f.search.toLocaleLowerCase().trim();
  const result = candidates.filter(
    (i) =>
      (f.collection ? i.kind === "link" && i.source === f.collection : (f.includeCollections || (f.category && (isComponent(f.category) || f.category === allComponents)) || !isCollectionLink(i) || (!!f.project && !f.linksOnly))) &&
      (!f.project || i.projects.includes(f.project)) &&
      (f.projectFolder==null || (f.projectFolder==='unfiled' ? !i.project_folders?.some(id=>f.projectFolderIds?.includes(id)) : i.project_folders?.includes(f.projectFolder))) &&
      (!f.rating || (i.kind==='link' && (f.rating==='unrated' ? !i.rating : f.rating==='4+' ? (i.rating??0)>=4 : i.rating===Number(f.rating)))) &&
      (!f.linksOnly || i.kind === "link") &&
      (f.type === "all" || i.kind === f.type) &&
      (f.category == null || candidates === categoryItems || ((i.kind !== "link" || componentFoldersOf(i).length>0) && (f.category === allComponents ? componentFoldersOf(i).length>0 : (isComponent(f.category) ? componentFoldersOf(i).includes(f.category) : designFoldersOf(i).includes(f.category))))) &&
      (!f.designsOnly || candidates === designItems || designFoldersOf(i).length > 0) &&
      (!f.source ||
        i.source === f.source ||
        i.source.startsWith(f.source + "/")) &&
      (!f.tags.length || (f.tagMode === "all" ? f.tags.every(t => i.tags.includes(t)) : f.tags.some(t => i.tags.includes(t)))) &&
      (!query ||
        `${i.name} ${i.path} ${i.source_url || ""}`
          .toLocaleLowerCase()
          .includes(query)),
  );
  const hash = (id: number) => {
    let n = (id ^ f.seed) | 0;
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    return (n ^ (n >>> 16)) >>> 0;
  };
  return result.sort(
    (a, b) =>
      (f.project
        ? Number(b.favourites?.includes(f.project) || false) -
          Number(a.favourites?.includes(f.project) || false)
        : 0) ||
      (f.sort.startsWith("rating-") ? (a.rating==null?1:0)-(b.rating==null?1:0) || (f.sort==="rating-high"?(b.rating??0)-(a.rating??0):(a.rating??0)-(b.rating??0)) || a.name.localeCompare(b.name) : f.sort === "name"
        ? a.name.localeCompare(b.name, undefined, { numeric: true })
        : f.sort === "shuffle"
          ? hash(a.id) - hash(b.id)
          : (f.category!=null?folderArrival(b,f.category)-folderArrival(a,f.category):b.added-a.added) || b.id - a.id),
  );
}
export const categoryOf = (item: Item): string => {
  const name=item.category ?? (item.source === "Photography" || item.source.startsWith("Photography/") ? "Photography" : item.source.startsWith("Design/") ? item.source.slice(7).split('/')[0] : "");
  return name.toLowerCase()==="captures"?"":filingCategory(name);
};
let labelText:string|null=null,labelCache:Record<string,string>={};
export const readFolderLabels=():Record<string,string>=>{try{const text=localStorage.getItem('folder-labels')??'{}';if(text!==labelText){const value=JSON.parse(text);labelCache=value&&typeof value==='object'&&!Array.isArray(value)?value:{};labelText=text;}return labelCache;}catch{return {};}};
export const categoryLabel = (name: string): string => {
 const label=readFolderLabels()[name];if(typeof label==='string'&&label.trim())return isComponent(name)?`Components / ${label}`:label;
 if(/^business[ _-]+cards$/i.test(name.trim()))return "Cards";
 if(/^patterns[ _-]*(?:&|and)?[ _-]*textures$/i.test(name.trim()))return "Backgrounds";
 if(isHeaderFolder(name))return "Components / Header";
 if(name==="Components / FAQs")return "Components / FAQ";
 return name.replace(/_/g," ").trim().replace(/[\p{L}\p{N}]+/gu,word=>
  /^(2d|3d|ui|ux|ai|ar|vr|css|html)$/i.test(word)?word.toUpperCase():word===word.toLocaleLowerCase()?word.charAt(0).toLocaleUpperCase()+word.slice(1):word
) || "Uncategorised";
};
export const libraryCategories = (lib: Library): string[] => [...new Set([...(lib.categories ?? []), ...lib.sources.filter(s=>s.startsWith("Design/")).map(s=>s.slice(7).split('/')[0]), ...lib.items.filter(i=>i.kind!=="link").flatMap(i=>designFoldersOf(i))].filter(name=>!!name&&!isWebDesign(name)&&!isComponent(name)&&name!==allComponents&&name.toLowerCase()!=="captures"))].sort((a,b)=>a.localeCompare(b));


export const designFoldersOf=(item:Item):string[]=>{
 if(item.project_only)return [];
 const category=categoryOf(item);
 const folders=[...new Set([...(item.design_folders??[]),...(category?[category]:[])])].filter(n=>n&&!isComponent(n)&&!isWebDesign(n));
 return folders.length?folders:(!isComponent(category)?['']:[]);
};

// Legacy single-folder components remain visible until their first membership edit.
export const componentFoldersOf = (item: Item): string[] => {
  const category=categoryOf(item);
  const folders=[...new Set([...(item.component_folders ?? []), ...(category!==componentInbox?[category]:[])].map(filingCategory))].filter(n=>isComponent(n)&&n!==componentInbox);
  return folders.length?folders:(isComponent(category)?[componentInbox]:[]);
};

function folderArrival(item:Item,folder:string):number{
 if(!isHeaderFolder(folder))return item.category_added?.[folder]??item.added;
 const arrivals=Object.entries(item.category_added??{}).filter(([name])=>filingCategory(name)===folder).map(([,added])=>added);
 return arrivals.length?Math.max(...arrivals):item.added;
}
