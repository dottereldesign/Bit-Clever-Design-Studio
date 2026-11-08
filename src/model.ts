import { allComponents, filingCategory, isComponent, isWebDesign, componentInbox } from "./componentsLibrary";
export type Item = {
  id: number;
  path: string;
  name: string;
  kind: "image" | "video" | "animation" | "link";
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
};
export type Label = { id: number; name: string; count: number };
export const isResource = (item: Item) => item.kind === "link" && (item.source === "Resources" || item.source.startsWith("Resources/"));
export const boardNames = { fonts: "Fonts", codepen: "CodePen", "brand-guidelines": "Brand Guidelines" };
export type BoardKey = keyof typeof boardNames;
export type LinkDestination = "links" | "resources" | BoardKey;
export const isBoardDestination = (destination: string): destination is BoardKey => Object.hasOwn(boardNames, destination);
export const isBoardLink = (item: Item) => item.kind === "link" && Object.values(boardNames).includes(item.source);
export const isTableCollection = (destination: string | null) => destination === "fonts" || destination === "brand-guidelines";
export const isTableLink = (item: Item) => item.kind === "link" && (item.source === "Fonts" || item.source === "Brand Guidelines");
export const isCollectionLink = (item: Item) => isResource(item) || isBoardLink(item) || (item.kind === "link" && isComponent(categoryOf(item)));
export const canCopyImage = (item: Item) => item.kind === "image" || item.kind === "animation";
export type Library = {
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
export function filterItems(items: Item[], f: Filters): Item[] {
  const query = f.search.toLocaleLowerCase().trim();
  const result = items.filter(
    (i) =>
      (f.collection ? i.kind === "link" && i.source === f.collection : (f.includeCollections || (f.category && (isComponent(f.category) || f.category === allComponents)) || !isCollectionLink(i) || (!!f.project && !f.linksOnly))) &&
      (!f.project || i.projects.includes(f.project)) &&
      (!f.linksOnly || i.kind === "link") &&
      (f.type === "all" || i.kind === f.type) &&
      (f.category == null || ((i.kind !== "link" || isComponent(categoryOf(i))) && (f.category === allComponents ? isComponent(categoryOf(i)) : (isComponent(f.category) ? componentFoldersOf(i).includes(f.category) : categoryOf(i) === f.category)))) &&
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
      (f.sort === "name"
        ? a.name.localeCompare(b.name, undefined, { numeric: true })
        : f.sort === "shuffle"
          ? hash(a.id) - hash(b.id)
          : (f.category!=null?(b.category_added?.[f.category]??b.added)-(a.category_added?.[f.category]??a.added):b.added-a.added) || b.id - a.id),
  );
}
export const categoryOf = (item: Item): string => {
  const name=item.category ?? (item.source === "Photography" || item.source.startsWith("Photography/") ? "Photography" : item.source.startsWith("Design/") ? item.source.slice(7).split('/')[0] : "");
  return name.toLowerCase()==="captures"?"":filingCategory(name);
};
export const readFolderLabels=():Record<string,string>=>{try{const value=JSON.parse(localStorage.getItem('folder-labels')??'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}};
export const categoryLabel = (name: string): string => {
 const label=readFolderLabels()[name];if(typeof label==='string'&&label.trim())return isComponent(name)?`Components / ${label}`:label;
 if(name==="Components / Heroes")return "Components / Hero";
 if(name==="Components / FAQs")return "Components / FAQ";
 return name.replace(/_/g," ").trim().replace(/[\p{L}\p{N}]+/gu,word=>
  /^(2d|3d|ui|ux|ai|ar|vr|css|html)$/i.test(word)?word.toUpperCase():word===word.toLocaleLowerCase()?word.charAt(0).toLocaleUpperCase()+word.slice(1):word
) || "Uncategorised";
};
export const libraryCategories = (lib: Library): string[] => [...new Set([...(lib.categories ?? []), ...lib.sources.filter(s=>s.startsWith("Design/")).map(s=>s.slice(7).split('/')[0]), ...lib.items.filter(i=>i.kind!=="link").map(categoryOf)].filter(name=>!!name&&!isWebDesign(name)&&!isComponent(name)&&name!==allComponents&&name.toLowerCase()!=="captures"))].sort((a,b)=>a.localeCompare(b));


// Legacy single-folder components remain visible until their first membership edit.
export const componentFoldersOf = (item: Item): string[] => {
  const category=categoryOf(item);
  if (!isComponent(category)) return [];
  const folders=[...new Set([...(item.component_folders ?? []), ...(category!==componentInbox?[category]:[])])].filter(n=>isComponent(n)&&n!==componentInbox);
  return folders.length?folders:[componentInbox];
};
