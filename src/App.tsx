import FolderRename from './FolderRename';
import { readFolderLabels } from './model';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { openUrl } from "./api";
import appLogo from "./assets/app-logo.png";
import { arrangeMasonry } from "./masonry";
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Folder,
  FolderPlus,
  FolderMinus,
  House,
  Grid2X2,
  ImageOff,
  Link2,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Tag,
  Trash2,
  X,
  Pin,
  Copy,
  ClipboardPaste,
  ClipboardCopy,
  Files,
  Download,
  Undo2,
  Redo2,
} from "lucide-react";
import { changeLibrary, loadLibrary, media, forgetMedia, type Change } from "./api";
import ThumbnailProgress from "./ThumbnailProgress";
import { canCopyImage, isResource, isBoardLink, isCollectionLink, boardNames, isBoardDestination, type BoardKey, type LinkDestination, filterItems, type Item, type Label, type Library } from "./model";
import ContactSheet from "./ContactSheet";
import RecentReferences from "./RecentReferences";
import { collections, sites, ordered, useLocalList, type Shortcut, type GeneralTarget } from "./Shortcuts";
import LibraryExport from "./LibraryExport";
import AppInfo from "./AppInfo";
import QuickPreview from "./QuickPreview";
import useItemDragFeedback from "./useItemDragFeedback";
import ZoomImage from "./ZoomImage";
import VideoDownloadDialog from "./VideoDownloadDialog";
import VideoDownloadQueue from "./VideoDownloadQueue";
import useVideoQueue from "./useVideoQueue";
import Resources from "./Resources";
import LinkBoard from "./LinkBoard";
import ThumbnailEditor from "./ThumbnailEditor";
import CaptureDialog, {
  stageFiles,
  type CaptureDraft,
  type CaptureResult,
} from "./CaptureDialog";
import DuplicatesDialog from "./DuplicatesDialog";
import ItemMenu, { type ItemMenuTarget } from "./ItemMenu";
import RemovedDialog from "./RemovedDialog";
import SidebarSection from "./SidebarSection";
import useHomeShortcutDrag from "./useHomeShortcutDrag";
import HomeDashboard, { homeMime, type HomeDestination } from "./HomeDashboard";
import { readSectionStyle } from "./SectionStylePicker";
import Customization, { readHomeAppearance, type CustomTab } from "./Customization";
import useSidebarSpace from "./useSidebarSpace";
import SidebarNavigation from "./SidebarNavigation";
import { sidebarLayouts, readSidebarLayout } from './appearance';
import { AppIcon, FolderIcon, GeneralEntryIcon, readIcons } from './AppIcon';
import type { GeneralDraft,GeneralOption } from './GeneralEditor';
import CollectionView from './CollectionView';
import { appHistory } from "./appHistory";
import { useHistoryState, useHistory, HistoryButtons } from "./useAppHistory";
import { allComponents, componentFolders, componentInbox, filingCategory, isComponent } from "./componentsLibrary";
import CategoryPicker from "./CategoryPicker";
import {componentFoldersOf, categoryOf, categoryLabel, libraryCategories, isTableCollection, isTableLink} from "./model";

const empty: Library = {
  items: [],
  projects: [],
  tags: [],
  sources: [],
  root: "",
  scanning: false,
};
type Modal = {
  kind:
    | "project"
    | "renameProject"
    | "tag"
    | "renameTag"
    | "link"
    | "editLink"
    | "thumbnail"
    | "category"
    | "projects"
    | "tags"
    | "settings"
    | "manageTags"
    | "deleteProject"
    | "deleteTag"
    | "deleteLinks";
  id?: number;
  ids?: number[];
};
function storedNumber(key: string, fallback: number) {
  const n = Number(localStorage.getItem(key));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
function tidyError(e: unknown) {
  const message = String(e);
  return message.includes("UNIQUE constraint")
    ? "That name or link is already in your library."
    : message;
}
function IconButton({
  title,
  children,
  onClick,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      className={`icon-button ${className}`}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Popover({
  label,
  icon,
  children,
  active = false,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  active?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node))
        ref.current?.removeAttribute("open");
    };
    const closeOnScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node))
        ref.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("scroll", closeOnScroll, true);
    };
  }, []);
  return (
    <details
      className={`popover ${active ? "is-active" : ""}`}
      ref={ref}
      onToggle={() => {
        if (!ref.current?.open || !panel.current) return;
        const rect = ref.current.getBoundingClientRect();
        setPosition({
          left: Math.max(
            8,
            Math.min(
              rect.left,
              window.innerWidth - panel.current.offsetWidth - 12,
            ),
          ),
          top: Math.max(
            8,
            Math.min(
              rect.bottom + 5,
              window.innerHeight - panel.current.offsetHeight - 12,
            ),
          ),
        });
      }}
    >
      <summary aria-label={label || "More options"}>
        {icon}
        <span>{label}</span>
        <ChevronDown size={12} />
      </summary>
      <div
        ref={panel}
        className="popover-panel"
        style={{
          position: "fixed",
          left: position.left,
          top: position.top,
          right: "auto",
          bottom: "auto",
        }}
      >
        {children}
      </div>
    </details>
  );
}

export default function App({startOnHome=true}:{startOnHome?:boolean}={}) {
  const [homeView,setHomeView]=useState(startOnHome);
  const [homeDrop,setHomeDrop]=useState<string|null>(null);
  const [lib, setLib] = useState<Library>(empty),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNoticeText] = useState("");
  const [receipt,setReceipt]=useState<{ids:number[];existing:boolean;undo?:string} | null>(null);
  const setNotice=useCallback((text:string)=>{setReceipt(null);setNoticeText(text);},[]);
  const [tagMode,setTagMode]=useState<"any"|"all">("any");
  const [recent,setRecent]=useState<"added"|"viewed"|null>(null);
  const [history,setHistory]=useLocalList<{id:number;path:string}>("reference-history",[]);
  const [collectionPrefs,setCollectionPrefs]=useHistoryState<Shortcut[]>("collection-shortcuts",()=>{try{const value=JSON.parse(localStorage.getItem("collection-shortcuts")??"null");return Array.isArray(value)?value:collections;}catch{return collections;}},"Sidebar shortcuts");
  const [sitePrefs,setSitePrefs]=useHistoryState<Shortcut[]>("site-shortcuts",()=>{try{const value=JSON.parse(localStorage.getItem("site-shortcuts")??"null");return Array.isArray(value)?value:sites;}catch{return sites;}},"Favourite websites");
  const [extraDialog,setExtraDialog]=useState<"sheet"|null>(null);
  const [viewedOrder,setViewedOrder]=useState<number[]>([]);
  const [receiptBrowse,setReceiptBrowse]=useState<number[]>([]);
  const track=useCallback((item:Item)=>setHistory(old=>old[0]?.id===item.id&&old[0].path===item.path?old:
    [{id:item.id,path:item.path},...old.filter(entry=>entry.id!==item.id)].slice(0,60)),[setHistory]);
  const [project, setProject] = useState<number | null>(null),
    [linksOnly, setLinksOnly] = useState(false);
  const [search, setSearch] = useState(""),
    [type, setType] = useState("all"),
    [tags, setTags] = useState<number[]>([]),
    [source, setSource] = useState(""),
    [sort, setSort] = useState("recent");
  const [seed, setSeed] = useState(Date.now()),
    [size, setSize] = useHistoryState("tile-size",() => storedNumber("tile-size", 260),"Thumbnail size"),
    [sidebarWidth, setSidebarWidth] = useHistoryState("sidebar-width",() => storedNumber("sidebar-width",208),"Sidebar width");
  const [sectionStyle,setSectionStyle]=useHistoryState("sidebar-section-style",readSectionStyle,"Sidebar style");
  const [customTab,setCustomTab]=useState<CustomTab|null>(null);
  const [homeStyle,setHomeStyle]=useHistoryState('home-style',()=>Math.max(1,Math.min(20,storedNumber('home-style',1))),'Home style');
  const [homeAppearance,setHomeAppearance]=useHistoryState("home-appearance",readHomeAppearance,"Home appearance");
  const [reducedMotion,setReducedMotion]=useHistoryState('reduce-motion',()=>localStorage.getItem('reduce-motion')==='true','Motion preference');
  const [sidebarLayout,setSidebarLayout]=useHistoryState('sidebar-layout',readSidebarLayout,'Sidebar layout');
  const [icons,setIcons]=useHistoryState('app-icons',readIcons,'App icons');
  const [folderLabels,setFolderLabels]=useHistoryState<Record<string,string>>('folder-labels',readFolderLabels,'Rename folder');
  const [folderMenu,setFolderMenu]=useState<{name:string;x:number;y:number}|null>(null);
  const [folderOrder,setFolderOrder]=useHistoryState<Record<string,string[]>>('sidebar-folder-order',()=>{try{return JSON.parse(localStorage.getItem('sidebar-folder-order')??'{}');}catch{return {}; }},'Folder order');
  const sortedFolders=(folders:string[],group:string)=>{const saved=folderOrder[group]??[];return [...folders].sort((a,b)=>{const ai=saved.indexOf(a),bi=saved.indexOf(b);return (ai<0?Infinity:ai)-(bi<0?Infinity:bi)||categoryLabel(a).localeCompare(categoryLabel(b),undefined,{numeric:true,sensitivity:'base'});});};
  const navLayout=sidebarLayouts[sidebarLayout-1]??sidebarLayouts[0];
  const [generalKey,setGeneralKey]=useState<string|null>(null);
  const generalRoute=useRef('');
  const generalEntry=collectionPrefs.find(s=>s.key===generalKey);
  const generalMissing=generalEntry?.target?.kind==='project'&&!lib.projects.some(p=>String(p.id)===generalEntry.target!.value);
  useSidebarSpace(sidebarLayout);
  useEffect(()=>{localStorage.setItem('home-style',String(homeStyle));},[homeStyle]);
  useEffect(()=>{localStorage.setItem('home-appearance',JSON.stringify(homeAppearance));},[homeAppearance]);
  useEffect(()=>{localStorage.setItem('reduce-motion',String(reducedMotion));document.documentElement.dataset.motion=reducedMotion?'reduce':'';if(reducedMotion)document.getAnimations().forEach(a=>a.cancel());},[reducedMotion]);
  const [selected, setSelected] = useState<Set<number>>(new Set()),
    [viewer, setViewer] = useState<number | null>(null),
    [modal, setModal] = useState<Modal | null>(null),
    [busy, setBusy] = useState(false);
  const [widePreview, setWidePreview] = useState(() => window.matchMedia("(min-width: 1600px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1600px)");
    const update = () => setWidePreview(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const [libraryExportOpen,setLibraryExportOpen]=useState(false);
  const [quickPreview,setQuickPreview]=useState<number|null>(null);
  const previewCandidate=useRef<number|null>(null);
  const historyActions=useHistory();
  const undoing=historyActions.busy;
  const libRef=useRef(lib);libRef.current=lib;
  const historyReady=useRef(false);
  const pasteBusy=useRef(false);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [category,setCategory] = useState<string|null>(null);
  const [categoryUndo,setCategoryUndo] = useState<[number,string][]|null>(null);
  const categoryUndoNotice = useRef("");
  const [categoryDrop,setCategoryDrop] = useState<string|null>(null);
  const [videoView, setVideoView] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [videoDialog, setVideoDialog] = useState<{url:string}|null>(null);
  const [boardView, setBoardView] = useState<BoardKey | null>(null);
  const [resourcesView, setResourcesView] = useState(false),
    [capture, setCapture] = useState<CaptureDraft | null>(null),
    [duplicatesOpen, setDuplicatesOpen] = useState(false),
    [dropActive, setDropActive] = useState(false),
    [readingCapture, setReadingCapture] = useState(false);
  const [itemMenu, setItemMenu] = useState<ItemMenuTarget | null>(null),
    [removedOpen, setRemovedOpen] = useState(false),
    [undoIds, setUndoIds] = useState<number[]>([]);
  const [gridReturn, setGridReturn] = useState<{ id: number } | null>(null);
  const [copying, setCopying] = useState<number | null>(null);
  const [resourceVersion, setResourceVersion] = useState(0);
  const copyBusy = useRef(false);
  const finishGridReturn = useCallback(() => setGridReturn(null), []);
  const closeViewer = useCallback(() => {
    if (viewer !== null && !widePreview) setGridReturn({ id: viewer });
    setViewer(null);
  }, [viewer, widePreview]);
  const closeItemMenu = useCallback(() => setItemMenu(null), []);
  useEffect(() => {
    if (quickPreview !== null || modal || viewer !== null || capture || duplicatesOpen) setHoverId(null);
  }, [quickPreview,modal, viewer, capture, duplicatesOpen]);
  useEffect(()=>{if(quickPreview!==null&&!lib.items.some(i=>i.id===quickPreview))setQuickPreview(null);},[lib.items,quickPreview]);
  const searchRef = useRef<HTMLInputElement>(null),
    anchor = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async function refresh() {
    const next = await loadLibrary();
    // Observe native history itself, including imports/downloads completed by
    // other dialogs, rather than trying to enumerate every possible save path.
    if(historyReady.current&&next.undo_entries){
      const known=new Set(libRef.current.undo_entries?.map(e=>e.id));
      for(const entry of next.undo_entries){if(!known.has(entry.id))appHistory.record({
        label:entry.label,kind:'library',
        undo:async()=>{await changeLibrary({action:'undo_organisation',value:entry.label});await refresh();},
        redo:async()=>{await changeLibrary({action:'redo_organisation'});await refresh();},
      });}
    }
    historyReady.current=true;
    libRef.current=next;setLib(next);
    setReady(true);
    return next;
  }, []);
  const report = useCallback((e: unknown) => setError(tidyError(e)), []);
  const videoQueue = useVideoQueue(ready && isTauri(), refresh, report);
  useEffect(() => {
    if (!isTauri()) {
      setError("Open the desktop app to browse your local library.");
      return;
    }
    let disposed = false;
    const unlisteners: (() => void)[] = [];
    (async () => {
      for (const [event, handler] of [
        [
          "library-changed",
          () => {
            void refresh().catch(report);
          },
        ],
        ["scan-started", () => setLib((l) => ({ ...l, scanning: true }))],
        [
          "scan-error",
          (e: { payload: unknown }) => {
            setLib((l) => ({ ...l, scanning: false }));
            report(e.payload);
          },
        ],
      ] as const) {
        const unlisten = await listen(event, handler);
        if (disposed) unlisten();
        else unlisteners.push(unlisten);
      }
      if (!disposed) await refresh();
    })().catch(report);
    return () => {
      disposed = true;
      unlisteners.forEach((fn) => fn());
    };
  }, [refresh, report]);
  useEffect(() => {
    if (!notice) return;
    if(categoryUndo && notice!==categoryUndoNotice.current) setCategoryUndo(null);
    const timer = setTimeout(() => { setNotice(""); setUndoIds([]); setCategoryUndo(null); }, undoIds.length || categoryUndo || receipt ? 9000 : 3000);
    return () => clearTimeout(timer);
  }, [notice, undoIds, categoryUndo,receipt]);
  useEffect(() => {
    localStorage.setItem("tile-size", String(size));
  }, [size]);
  useEffect(() => {
    localStorage.setItem("sidebar-width", String(sidebarWidth));
  }, [sidebarWidth]);
  useEffect(()=>{const id=quickPreview??viewer;
    const item=id===null?null:lib.items.find(i=>i.id===id);if(item)track(item);
  },[lib.items,quickPreview,viewer,track]);
  const sheetItems=useMemo(()=>lib.items.filter(i=>project!==null&&i.projects.includes(project)),[lib.items,project]);
  const linkDestination: LinkDestination = boardView ?? (resourcesView ? "resources" : "links");
  const allCategoriesView = category === null && !project && !recent && !boardView && !videoView && !linksOnly && !resourcesView && !source;
  const filtered = useMemo(
    () => {
      const matches=filterItems(lib.items, {
        tagMode, includeCollections:!!recent||resourcesView||generalEntry?.target?.kind==='project',
        category,
        collection: boardView ? boardNames[boardView] : undefined,
        search,
        type: videoView ? "video" : type==='all'?(generalEntry?.content??'all'):type,
        tags,
        source: videoView ? "Videos" : generalEntry&&resourcesView?"Resources":source,
        project,
        linksOnly,
        sort:recent?"recent":sort, seed,
      });
      if(generalMissing)return [];
      if(allCategoriesView)return matches.filter(i=>!isComponent(categoryOf(i)));
      if(recent!=="viewed")return matches;
      const byId=new Map(matches.map(i=>[i.id,i]));
      return viewedOrder.flatMap(id=>byId.get(id)??[]);
    },
    [lib.items, search, type, tags, source, project, linksOnly, sort, seed, boardView, videoView,category,tagMode,recent,viewedOrder,allCategoriesView,generalEntry,generalMissing,resourcesView],
  );
  useEffect(()=>{if(quickPreview===null)setReceiptBrowse([]);},[quickPreview]);
  const boardItems = boardView ? filtered : [];
  const customCollection = !!generalEntry?.layout && generalEntry.layout !== 'auto';
  const originalResources = resourcesView && !customCollection;
  const tableBoard = isTableCollection(boardView);
  const images = useMemo(
    () => filtered.filter((i) => i.kind !== "link"),
    [filtered],
  );
  const links = useMemo(
    () => filtered.filter((i) => i.kind === "link" && (isComponent(categoryOf(i)) || !isBoardLink(i) || isTableLink(i))),
    [filtered],
  );
  const activeItem = lib.items.find((i) => i.id === viewer);
  const dockedPreview = widePreview && !!activeItem;
  useEffect(() => {
    if (viewer !== null && !filtered.some(item => item.id === viewer)) setViewer(null);
  }, [filtered, viewer]);
  const title = generalEntry?.name??(recent==="added"?"Recently added":recent==="viewed"?"Recently viewed":videoView ? "Facebook Videos" : boardView ? boardNames[boardView] : resourcesView
    ? "Resources"
    : project
      ? lib.projects.find((p) => p.id === project)?.name || "Project"
      : linksOnly
        ? "Links"
        : category !== null ? categoryLabel(category) : source ? source.split("/").pop()! : "All Categories");
  const activeFilters = !!(search || type !== "all" || tags.length);
  const clearFilters = () => {
    setSearch("");
    setType("all");
    setTags([]);
    setSource("");
  };
  const navigate = (id: number | null, onlyLinks = false) => {
    setHomeView(false);
    setGeneralKey(null);
    setQuickPreview(null);
    setGridReturn(null);
    setRecent(null);
    setResourcesView(false);
    setBoardView(null);
    setVideoView(false);
    setCategory(null);
    setProject(id);
    setLinksOnly(onlyLinks);
    setSelected(new Set());
    setViewer(null);
    clearFilters();
    scrollRef.current?.scrollTo(0, 0);
  };
  const runLibraryHistory=useCallback(async(redo:boolean,expected?:string)=>{
    await changeLibrary({action:redo?'redo_organisation':'undo_organisation',value:expected});await refresh();setUndoIds([]);setCategoryUndo(null);
  },[refresh]);
  appHistory.onError=report;
  appHistory.fallback={undoLabel:lib.undo_label,redoLabel:lib.redo_label,undo:()=>runLibraryHistory(false),redo:()=>runLibraryHistory(true)};
  const recordCapture=useCallback((result:CaptureResult)=>{if(libRef.current.undo_entries)return;for(const label of result.history_labels??(result.move_label?[result.move_label]:[])){appHistory.record({label,kind:'library',undo:()=>runLibraryHistory(false,label),redo:()=>runLibraryHistory(true)});}},[runLibraryHistory]);
  const mutate = useCallback((c:Change)=>appHistory.perform(async()=>{
    const before=libRef.current;await changeLibrary(c);const next=await refresh();
    const tracked=new Set(['set_category','remove_component_folder','add_project','remove_project','add_tag','remove_tag','pin_project','unpin_project','remove_items','restore_items','create_link','edit_link','set_link_destination','set_source_url','rename_project','rename_tag','delete_project','delete_tag','create_project','create_tag','create_category']);
    const recorded=typeof next.undo_count==='number'&&typeof before.undo_count==='number'?next.undo_count>before.undo_count||(next.undo_count===100&&JSON.stringify(next)!==JSON.stringify(before)):JSON.stringify(next)!==JSON.stringify(before);
    if(!next.undo_entries&&tracked.has(c.action)&&next.undo_label&&recorded){const label=next.undo_label;appHistory.record({label,kind:'library',undo:()=>runLibraryHistory(false,label),redo:()=>runLibraryHistory(true)});}
    return next;
  }),[refresh,runLibraryHistory]);
  const undoLast=useCallback(async(expected?:string)=>{if(expected&&appHistory.undoLabel!==expected){setNotice("A newer change took place. Use the header Undo action.");return;}await appHistory.undo();},[]);
  const redoLast=useCallback(async()=>{await appHistory.redo();},[]);
  useEffect(()=>{
    const gesture=()=>crypto.randomUUID();
    const typing=(target:EventTarget|null)=>target instanceof HTMLElement&&!!target.closest('textarea,[contenteditable=true],input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button])');
    const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&!e.altKey&&!typing(e.target)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();void ((e.key.toLowerCase()==='y'||e.shiftKey)?appHistory.redo():appHistory.undo());return;}if(e.target instanceof HTMLElement&&e.target.matches('input[type=range]')&&e.key.startsWith('Arrow'))appHistory.beginGesture(`key-${gesture()}`);};
    const down=(e:PointerEvent)=>{if(e.target instanceof HTMLElement&&e.target.closest('input[type=range],.sidebar-resize'))appHistory.beginGesture(`pointer-${gesture()}`);};
    const end=()=>appHistory.endGesture();
    document.addEventListener('keydown',key,true);document.addEventListener('keyup',end,true);document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);window.addEventListener('blur',end);
    return ()=>{document.removeEventListener('keydown',key,true);document.removeEventListener('keyup',end,true);document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',end);window.removeEventListener('blur',end);};
  },[]);
  const categories = useMemo(()=>libraryCategories(lib),[lib]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of lib.items) {
      if (item.kind === "link" && !isComponent(categoryOf(item))) continue;
      const name = categoryOf(item);
      for (const folder of isComponent(name)?componentFoldersOf(item):[name]) counts.set(folder, (counts.get(folder) ?? 0) + 1);
      if (isComponent(name)) counts.set(allComponents, (counts.get(allComponents) ?? 0) + 1);
    }
    return counts;
  }, [lib.items]);
  const homeDestinations:HomeDestination[]=[
    {id:"design",label:"Design Inspo",kind:"category",value:"__all__",group:"design",count:lib.items.filter(i=>i.kind!=="link"&&!isComponent(categoryOf(i))).length},
    {id:"group:general",label:"General",kind:"group",value:"general",group:"general"},
    {id:"group:projects",label:"Projects",kind:"group",value:"projects",group:"projects",count:lib.projects.length},
    ...collectionPrefs.map(s=>({id:`collection:${s.key}`,label:s.name,kind:"collection" as const,value:s.key,group:"general"})),
    ...lib.projects.map(p=>({id:`project:${p.id}`,label:p.name,kind:"project" as const,value:String(p.id),group:"projects",count:p.count})),
    ...[...categories,"",allComponents,...componentFolders].map(name=>({id:`category:${name}`,label:name===allComponents?"App Components":isComponent(name)?categoryLabel(name).slice("Components / ".length):categoryLabel(name),kind:"category" as const,value:name,group:isComponent(name)||name===allComponents?"components":"design",count:categoryCounts.get(name)??0})),
  ];
  const generalOptions:GeneralOption[]=[
    ...collections.map(entry=>({label:entry.name,target:{kind:'view' as const,value:entry.key}})),
    {label:'Design Inspo / All',target:{kind:'category',value:'__all__'}},{label:'App Components / All',target:{kind:'category',value:allComponents}},
    ...lib.projects.map(p=>({label:`Project / ${p.name}`,target:{kind:'project' as const,value:String(p.id)}})),
    ...[...categories,'',...componentFolders].map(name=>({label:`${isComponent(name)?'App Components':'Design Inspo'} / ${categoryLabel(name)}`,target:{kind:'category' as const,value:name}})),
  ];
  const iconTargets=[{id:'home',label:'Home'},{id:'folders',label:'All folder icons'},{id:'section:General',label:'General section'},{id:'section:Projects',label:'Projects section'},{id:'design',label:'Design Inspo section'},{id:'components',label:'App Components section'},{id:'design:all',label:'All Design Inspo'},
    ...collectionPrefs.map(s=>({id:`collection:${s.key}`,label:`General / ${s.name}`})),...sitePrefs.map(s=>({id:`website:${s.key}`,label:`Website / ${s.name}`})),...lib.projects.map(p=>({id:`project:${p.id}`,label:`Project / ${p.name}`})),...[...categories,'',allComponents,...componentFolders].map(name=>({id:`category:${name}`,label:categoryLabel(name)}))];
  const saveGeneral=async(draft:GeneralDraft,key?:string)=>{
    if(!draft.name)throw Error('Enter a name for the entry.');
    let target:GeneralTarget;
    if(draft.target.kind==='new'){const next=await mutate({action:'create_project',name:draft.name});const created=next.projects.find(p=>p.name===draft.name);if(!created)throw Error('Could not find the new collection.');target={kind:'project',value:String(created.id)};}else target=draft.target;
    const entry:Shortcut={...collectionPrefs.find(s=>s.key===key),key:key??crypto.randomUUID(),name:draft.name,target,layout:draft.layout,content:draft.content};
    setCollectionPrefs(previous=>key?previous.map(s=>s.key===key?entry:s):[...previous,entry]);
  };
  const openGeneral=(entry:Shortcut)=>{
    const target=entry.target??{kind:'view',value:entry.key};
    if(target.kind==='website'){setGeneralKey(null);void openUrl(target.value).catch(report);return;}
    generalRoute.current=JSON.stringify([entry.key,target]);
    navigate(target.kind==='project'?Number(target.value):null,target.kind==='view'&&target.value==='links');setGeneralKey(entry.key);
    if(target.kind==='category'){if(target.value!=='__all__')setCategory(target.value);return;}
    if(target.kind==='project')return;
    const key=target.value;if(isBoardDestination(key))setBoardView(key);if(key==='resources')setResourcesView(true);
    if(key==='facebook'){setVideoView(true);setSource('Videos');}
    if(key==='added'||key==='viewed'){setRecent(key);if(key==='viewed'){const byId=new Map(lib.items.map(i=>[i.id,i.path]));setViewedOrder(history.filter(h=>byId.get(h.id)===h.path).map(h=>h.id));}}
  };
  useEffect(()=>{if(!generalEntry)return;const target=generalEntry.target??{kind:'view',value:generalEntry.key};if(generalRoute.current!==JSON.stringify([generalEntry.key,target])){if(target.kind==='website')setGeneralKey(null);else openGeneral(generalEntry);}},[generalKey,generalEntry?.target?.kind,generalEntry?.target?.value]);
  const openHomeDestination=(destination:HomeDestination)=>{
    if(destination.kind==='collection'){const entry=collectionPrefs.find(s=>s.key===destination.value);if(entry)openGeneral(entry);return;}
    if(destination.kind==="project"){navigate(Number(destination.value));return;}
    navigate(null,destination.value==="links");
    if(destination.kind==="category"){if(destination.value!=="__all__")setCategory(destination.value);return;}
    const key=destination.value;
    if(isBoardDestination(key))setBoardView(key);
    if(key==="resources")setResourcesView(true);
    if(key==="facebook"){setVideoView(true);setSource("Videos");}
    if(key==="added"||key==="viewed"){setRecent(key);if(key==="viewed"){const byId=new Map(lib.items.map(i=>[i.id,i.path]));setViewedOrder(history.filter(h=>byId.get(h.id)===h.path).map(h=>h.id));}}
  };
  const homeShortcutDrag=useHomeShortcutDrag(()=>{setHomeView(true);setViewer(null);setSelected(new Set());},setHomeDrop,(id,target,after)=>{const from=id.slice(9),to=target.slice(9),group=isComponent(from)?'components':'design';if(isComponent(from)!==isComponent(to)||from===to)return;const rows=sortedFolders(group==='components'?componentFolders:[...categories,''],group).filter(name=>name!==from),index=rows.indexOf(to);if(index<0)return;rows.splice(index+(after?1:0),0,from);setFolderOrder(previous=>({...previous,[group]:rows}));});
  const homeDrag=(id:string)=>homeShortcutDrag.props(id,homeDestinations.find(d=>d.id===id)?.label??"Destination");
  const changeCategory = async (ids:number[],name:string) => {
    const items=lib.items.filter(i=>ids.includes(i.id)&&(i.kind!=="link"||isComponent(name)||isComponent(categoryOf(i))));
    if(!items.length)throw Error("Select images or videos to change category.");
    name = filingCategory(name);
    const previous: [number,string][] = items.map(i=>[i.id,categoryOf(i)]);
    await mutate({action:"set_category",ids:items.map(i=>i.id),value:name});
    setUndoIds([]);setCategoryUndo(previous);setSelected(new Set());
    categoryUndoNotice.current=`${items.length} ${items.length===1?"reference":"references"} ${isComponent(name) && name!==componentInbox ? "added to" : "moved to"} ${name===componentInbox?"App Components / Uncategorised":name===""?"Design Inspo / Uncategorised":categoryLabel(name)}`;
    setNotice(categoryUndoNotice.current);
  };
  const removeFromComponentFolder = async (item:Item) => {
    if(!category||!isComponent(category)||category===componentInbox)return;
    const folder=category;
    try {
      await mutate({action:"remove_component_folder",ids:[item.id],value:folder});
      setSelected(previous=>{const next=new Set(previous);next.delete(item.id);return next;});
      setUndoIds([]);setCategoryUndo([[item.id,folder]]);
      categoryUndoNotice.current=`Removed from ${categoryLabel(folder)}`;
      setNotice(categoryUndoNotice.current);
    } catch(error){report(error);}
  };
  const categoryDropProps = (name:string) => ({
    onDragOver:(e:React.DragEvent)=>{if(e.dataTransfer.types.includes("application/design-items")){e.preventDefault();e.dataTransfer.dropEffect="move";setCategoryDrop(name);}},
    onDragLeave:(e:React.DragEvent)=>{if(!(e.relatedTarget instanceof Node)||!e.currentTarget.contains(e.relatedTarget))setCategoryDrop(null);},
    onDrop:(e:React.DragEvent)=>{e.preventDefault();e.stopPropagation();setCategoryDrop(null);try{const ids=JSON.parse(e.dataTransfer.getData("application/design-items"));if(Array.isArray(ids)&&ids.every(Number.isInteger))void changeCategory(ids,name).catch(report);}catch{/* Unrelated drag. */}}
  });
  const folderRow = (s: string) => (
    <button
      className={`nav-item source-item ${!homeView && !generalKey && category === s ? "source-active" : ""} ${categoryDrop===s?"drop-target":""}`}
      {...homeDrag(`category:${s}`)}
      onContextMenu={e=>{if(s===allComponents||s===componentInbox||!s)return;e.preventDefault();e.stopPropagation();setFolderMenu({name:s,x:e.clientX,y:e.clientY});}}
      data-folder-order={s===allComponents?undefined:isComponent(s)?'components':'design'}
      data-category={s}
      {...categoryDropProps(s)}
      key={s}
      title={`Open ${categoryLabel(s)}; drop references here to ${isComponent(s)&&s!==componentInbox?"add to this folder":"change category"}`}
      onClick={() => { navigate(null); setCategory(s); }}
    >
      <FolderIcon preferences={icons} id={`category:${s}`} size={14}/>
      <span>{isComponent(s) ? categoryLabel(s).slice("Components / ".length) : categoryLabel(s)}</span>
      <small>{categoryCounts.get(s)||""}</small>
    </button>
  );
  const perform = useCallback(
    async (c: Change) => {
      try {
        await mutate(c);
      } catch (e) {
        report(e);
      }
    },
    [mutate, report],
  );
  const select = (id: number, range = false) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (range && anchor.current !== null) {
        const a = filtered.findIndex((i) => i.id === anchor.current),
          b = filtered.findIndex((i) => i.id === id);
        if (a >= 0 && b >= 0)
          filtered
            .slice(Math.min(a, b), Math.max(a, b) + 1)
            .forEach((i) => next.add(i.id));
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    anchor.current = id;
  };
  const openItem = (item: Item, e?: React.MouseEvent) => {
    if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      select(item.id, e.shiftKey);
      return;
    }
    if (item.kind === "link") {
      void openUrl(item.path).then(()=>track(item)).catch(report);
    } else {
      setGridReturn(null);
      setViewer(item.id);
    }
  };
  const copyImage = useCallback(async (id: number) => {
    if (copyBusy.current) return;
    copyBusy.current = true;
    setCopying(id);
    try {
      await invoke("copy_image", { id });
      setUndoIds([]);
      setNotice("Image copied");
    } catch (e) { report(e); }
    finally { copyBusy.current = false; setCopying(null); }
  }, [report]);
  const removeItems = useCallback(async (ids: number[]) => {
    try {
      await mutate({ action: "remove_items", ids });
      setSelected(new Set());
      setViewer((id) => id !== null && ids.includes(id) ? null : id);
      setUndoIds(ids);
      setNotice(`${ids.length} ${ids.length === 1 ? "item" : "items"} removed from library`);
    } catch (e) { report(e); }
  }, [mutate, report]);
  const moveViewer = useCallback(
    (delta: number) => {
      setViewer((id) => {
        const n = images.findIndex((i) => i.id === id);
        return images[(n + delta + images.length) % images.length]?.id ?? null;
      });
    },
    [images],
  );
  useLayoutEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.matches(
        "input,textarea,select,[contenteditable=true]",
      );
      if(libraryExportOpen||extraDialog||customTab||(homeView&&!modal&&!capture&&!videoDialog&&!duplicatesOpen&&!removedOpen))return;
      if(quickPreview!==null){
        if(e.key==="Escape"||(e.key===" "&&!typing&&!(e.target as HTMLElement).closest("button,video"))){e.preventDefault();if(!e.repeat)setQuickPreview(null);}
        if(!typing&&(e.key==="ArrowRight"||e.key==="ArrowLeft")){e.preventDefault();const ids=receiptBrowse.length?receiptBrowse:filtered.map(i=>i.id);const n=ids.indexOf(quickPreview);setQuickPreview(ids[(n+(e.key==="ArrowRight"?1:-1)+ids.length)%ids.length]??null);}
        return;
      }
      if (e.key === "Escape") {
        if (videoDialog) return;
        if (itemMenu) { setItemMenu(null); return; }
        if (removedOpen) { setRemovedOpen(false); return; }
        if (capture) {
          void invoke("discard_capture", {
            paths: capture.files.map((f) => f.path),
          }).catch(report);
          setCapture(null);
        } else if (duplicatesOpen) setDuplicatesOpen(false);
        else if (modal) setModal(null);
        else if (viewer !== null) closeViewer();
        else setSelected(new Set());
        return;
      }
      if (videoDialog || modal || typing || capture || duplicatesOpen || removedOpen || itemMenu) return;
      if((e.ctrlKey||e.metaKey)&&!e.altKey){
        if(e.key.toLowerCase()==="z"){e.preventDefault();void (e.shiftKey?redoLast():undoLast());return;}
        if(!e.shiftKey&&e.key.toLowerCase()==="y"){e.preventDefault();void redoLast();return;}
      }
      const inViewer = viewer !== null && (!widePreview || !!(e.target as HTMLElement).closest(".viewer"));
      if(!inViewer&&e.key===" "&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
        const focused=(document.activeElement as HTMLElement)?.closest<HTMLElement>("[data-item-id]");
        const id=focused?Number(focused.dataset.itemId):previewCandidate.current??(selected.size===1?[...selected][0]:null);
        if(id!==null&&filtered.some(i=>i.id===id)){e.preventDefault();setHoverId(null);setQuickPreview(id);return;}
      }
      if(!inViewer && !e.ctrlKey && !e.metaKey && e.key.toLowerCase()==="c" && filtered.some(i=>selected.has(i.id)&&i.kind!=="link")) {e.preventDefault();setModal({kind:"category",ids:[...selected]});return;}
      if (e.key === "Delete" && (inViewer || selected.size)) {
        e.preventDefault();
        void removeItems(inViewer ? [viewer!] : [...selected]);
        return;
      }
      if (viewer !== null) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && inViewer && activeItem && canCopyImage(activeItem) && !window.getSelection()?.toString()) {
          e.preventDefault();
          void copyImage(viewer);
        }
        if (e.key === "ArrowRight") moveViewer(1);
        if (e.key === "ArrowLeft") moveViewer(-1);
        if (!widePreview || e.key === "ArrowRight" || e.key === "ArrowLeft") return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        setSelected(new Set(filtered.map((i) => i.id)));
      }
      if (e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key === "f")) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [modal, viewer, filtered, moveViewer, capture, duplicatesOpen, removedOpen, itemMenu, selected, removeItems, closeViewer, activeItem, copyImage, videoDialog, quickPreview, undoLast, redoLast, widePreview, libraryExportOpen,extraDialog,receiptBrowse,homeView,customTab]);
  const showCaptureReceipt=useCallback((result:CaptureResult, next:Library, targetCategory:string|null)=>{
    const saved=next.items.filter(i=>result.ids.includes(i.id));
    if(!saved.length)return;
    const item=saved[0];
    const destination=targetCategory!==null?categoryLabel(targetCategory):result.destination==="links"?"Links":result.destination==="resources"?"Resources":
      result.destination&&isBoardDestination(result.destination)?boardNames[result.destination]:
      item.source;
    const prior=new Map(lib.items.map(i=>[i.id,i]));
    const already=result.reused>0&&!result.added&&saved.every(i=>{
      const previous=prior.get(i.id);
      return targetCategory===null||!!previous&&(isComponent(filingCategory(targetCategory))?componentFoldersOf(previous).includes(filingCategory(targetCategory)):categoryOf(previous)===filingCategory(targetCategory));
    });
    const message=result.moved_from?`Moved from ${result.moved_from} to ${destination}`:
      result.added&&result.reused?`${result.added} added · ${result.reused} reused in ${destination}`:
      already?`Already in ${destination}`:`${saved.length===1?"Added":saved.length+" added"} to ${destination}`;
    setUndoIds([]);setCategoryUndo(null);setNoticeText(message);
    setReceipt({ids:saved.map(i=>i.id),existing:already&&!result.moved_from,undo:result.move_label});
  },[lib.items]);
  const pasteCapture = useCallback(async () => {
    if(pasteBusy.current)return;
    pasteBusy.current=true;
    try {
      setReadingCapture(true);
      const draft = await invoke<CaptureDraft>("read_clipboard");
      if(category!==null && (isComponent(category)||category===allComponents) && draft.url && !draft.files.length){
        const result=await appHistory.perform(()=>invoke<CaptureResult>('capture_items',{input:{files:[],url:draft.url,name:'',source:'Design',projects:[],tags:[],source_url:'',resource:false}}));
        recordCapture(result);
        if(result.ids.length)await mutate({action:'set_category',ids:result.ids,value:filingCategory(category)});
        showCaptureReceipt(result,await refresh(),filingCategory(category));return;
      }
      if(videoView && draft.url){setVideoDialog({url:draft.url});return;}
      if(category!==null && draft.files.length && !resourcesView && !boardView && !videoView && !linksOnly){
        try {
          const result=await appHistory.perform(()=>invoke<CaptureResult>("capture_items",{input:{
            files:draft.files,url:"",name:draft.files.length===1?draft.files[0].name.replace(/\.[^.]+$/, ""):"",
            source:category==="Photography"?"Photography":"Design",projects:[],tags:[],source_url:"",resource:false,
          }}));
          recordCapture(result);
          if(result.ids.length)await mutate({action:"set_category",ids:result.ids,value:filingCategory(category)});
          showCaptureReceipt(result,await refresh(),category);
        } finally {await invoke("discard_capture",{paths:draft.files.map(file=>file.path)}).catch(report);}
        return;
      }
      setCapture(boardView ? { ...draft, files: [], thumbnail: draft.files[0], destination: linkDestination } : { ...draft, destination: linkDestination });
    } catch (e) {
      report(e);
    } finally {
      pasteBusy.current=false;
      setReadingCapture(false);
    }
  }, [report, resourcesView, boardView, linkDestination, videoView, category, linksOnly, refresh,showCaptureReceipt,mutate,recordCapture]);
  const chooseCaptureFiles = async () => {
    try {
      const paths = await open({
        multiple: true,
        title: "Add references",
        filters: [
          {
            name: "Images & videos",
            extensions: [
              "jpg",
              "jpeg",
              "png",
              "webp",
              "gif",
              "bmp",
              "tif",
              "tiff",
              "ico",
              "avif",
              "mp4",
              "mov",
              "webm",
              "m4v",
              "mkv",
              "avi",
            ],
          },
        ],
      });
      if (paths) {
        const files = (Array.isArray(paths) ? paths : [paths]).map((path) => ({
          path,
          name: path.replace(/\\/g, "/").split("/").pop()!,
        }));
        setCapture({ files, url: "" });
      }
    } catch (e) {
      report(e);
    }
  };
  useEffect(() => {
    const paste = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "v" &&
        !(e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true]",
        ) &&
        quickPreview === null && !libraryExportOpen && !extraDialog && !capture &&
        !videoDialog &&
        !duplicatesOpen &&
        !removedOpen &&
        !modal
      ) {
        e.preventDefault();
        void pasteCapture();
      }
    };
    const over = (e: DragEvent) => {
      if((e.target as HTMLElement)?.closest(".home-dashboard,.customise-backdrop")){setDropActive(false);return;}
      if (!extraDialog && e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        setDropActive(true);
      }
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDropActive(false);
    };
    const drop = (e: DragEvent) => {
      setDropActive(false);
      if((e.target as HTMLElement)?.closest(".home-dashboard,.customise-backdrop"))return;
      if(extraDialog)return;
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) {
        e.preventDefault();
        setReadingCapture(true);
        stageFiles(files)
          .then(setCapture)
          .catch(report)
          .finally(() => setReadingCapture(false));
        return;
      }
      const url = e.dataTransfer?.getData("text/uri-list") || "";
      if (/^https?:\/\//i.test(url)) {
        e.preventDefault();
        if(videoView)setVideoDialog({url});
        else setCapture({ files: [], url, destination: linkDestination });
      }
    };
    window.addEventListener("keydown", paste);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("keydown", paste);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [pasteCapture, report, capture, duplicatesOpen, removedOpen, modal, resourcesView, linkDestination, videoView, videoDialog,quickPreview,libraryExportOpen,extraDialog]);
  const captured = async (result: CaptureResult) => {
    recordCapture(result);
    if(category!==null && (capture?.files.length || isComponent(category) || category===allComponents) && result.ids.length) await mutate({action:"set_category",ids:result.ids,value:filingCategory(category)});
    const next=await refresh();
    if (capture)
      await invoke("discard_capture", {
        paths: capture.files.map((f) => f.path),
      }).catch(report);
    setCapture(null);
    if (result.destination) {
      navigate(null, result.destination === "links");
      setResourcesView(result.destination === "resources");
      if (result.destination && isBoardDestination(result.destination)) setBoardView(result.destination);
      if (result.destination === "resources") setResourceVersion(version => version + 1);
    }
    showCaptureReceipt(result,next,result.destination?null:category);
  };
  useEffect(() => {
    setSelected((prev) => {
      const available = new Set(filtered.map((i) => i.id));
      return new Set([...prev].filter((id) => available.has(id)));
    });
    scrollRef.current?.scrollTo(0, 0);
    setHoverId(null);
  }, [search, type, tags, tagMode, source, project, linksOnly, sort, seed]);
  const chooseRoot = async () => {
    try {
      const path = await open({
        directory: true,
        multiple: false,
        title: "Choose your Design folder",
        defaultPath: lib.root || undefined,
      });
      if (typeof path === "string") {
        const previous=lib.root;
        await invoke("set_root", { path });
        await refresh();
        if(previous&&previous!==path){const restore=async(path:string)=>{await invoke("set_root",{path});await refresh();};appHistory.record({label:"Library folder",undo:()=>restore(previous),redo:()=>restore(path)});}
      }
    } catch (e) {
      report(e);
    }
  };
  const backup = async (restore: boolean) => {
    try {
      const path = restore
        ? await open({
            multiple: false,
            filters: [{ name: "Design backup", extensions: ["json"] }],
          })
        : await save({
            defaultPath: "design-backup.json",
            filters: [{ name: "Design backup", extensions: ["json"] }],
          });
      if (typeof path === "string") {
        await invoke("backup", { path, restore });
        if (restore) {appHistory.clearLibrary();await refresh();}
        setUndoIds([]);
        setNotice(restore ? "Backup imported" : "Backup exported");
      }
    } catch (e) {
      report(e);
    }
  };
  const drop = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drop-target");
    try {
      const ids = JSON.parse(
        e.dataTransfer.getData("application/design-items"),
      );
      if (Array.isArray(ids) && ids.every((n) => Number.isInteger(n))) {
        void mutate({ action: "add_project", target: id, ids })
          .then(() => { setUndoIds([]); setNotice("Added to project"); })
          .catch(report);
      }
    } catch {
      /* Ignore unrelated drops. */
    }
  };
  const resizeSidebar = (e: React.PointerEvent) => {
    e.preventDefault();
    const start = e.clientX,
      width = sidebarWidth;
    const move = (ev: PointerEvent) =>
      setSidebarWidth(Math.min(320, Math.max(168, width + ev.clientX - start)));
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };
  const linkTable = (items: Item[]) => <LinksTable items={items} selected={selected} select={select} openItem={openItem}
    onEdit={id=>setModal({kind:"editLink",id})} onProjects={id=>setModal({kind:"projects",ids:[id]})}
    onTags={id=>setModal({kind:"tags",ids:[id]})} onDelete={id=>void removeItems([id])} project={project}
    onPin={item=>project&&void perform({action:item.favourites?.includes(project)?"unpin_project":"pin_project",target:project,ids:[item.id]})}/>;
  const itemDrag=useItemDragFeedback({
    enabled:(viewer===null||widePreview)&&quickPreview===null&&!modal&&!capture&&!videoDialog&&!duplicatesOpen&&!removedOpen&&!itemMenu&&!libraryExportOpen,
    ids:id=>selected.has(id)?[...selected]:[id],
    category:(ids,name)=>void changeCategory(ids,name).catch(report),
    project:(ids,target)=>void mutate({action:"add_project",ids,target}).then(()=>{setUndoIds([]);setNotice("Added to project");}).catch(report),
    started:()=>setHoverId(null),
  });
  return (
    <div
      className="app" data-sidebar-layout={sidebarLayout} data-sidebar-brand={navLayout.brand} data-sidebar-counts={navLayout.counts!==false} data-sidebar-compact={sidebarWidth<200}
      onClickCapture={homeShortcutDrag.captureClick}
      onDragStart={itemDrag.start}
      onPointerDown={itemDrag.pointerDown}
      onPointerOver={e=>{const target=(e.target as HTMLElement).closest<HTMLElement>("[data-item-id]");previewCandidate.current=target?Number(target.dataset.itemId):null;}}
      onDragEnd={()=>setCategoryDrop(null)}
      onContextMenu={(e) => {
        if (modal || capture || duplicatesOpen || removedOpen || folderMenu) return;
        const target = (e.target as HTMLElement).closest<HTMLElement>("[data-item-id]");
        if (!target) return;
        const id = Number(target.dataset.itemId);
        e.preventDefault(); e.stopPropagation();
        setHoverId(null);
        setItemMenu({ x: e.clientX, y: e.clientY, ids: (viewer === null || widePreview) && selected.has(id) ? [...selected] : [id] });
      }}
      style={{ "--sidebar-width": `${sidebarWidth}px`,"--nav-row":`${navLayout.row}px`,"--nav-inset":`${navLayout.inset}px`,"--nav-radius":`${navLayout.radius}px`,"--nav-indent":navLayout.indent===undefined?undefined:`${navLayout.indent}px` } as React.CSSProperties}
    >
      <aside
        className="sidebar"
        inert={!!customTab || quickPreview !== null || (viewer !== null && !widePreview) || !!modal || !!capture || !!videoDialog || duplicatesOpen || removedOpen || libraryExportOpen}
      >
        <button className="brand" aria-label="Go to Home" onClick={()=>{navigate(null);setHomeView(true);}}>
          <img src={appLogo} alt="" className="brand-logo" />
          <span className="brand-name"><span>BitClever</span><span>Design</span></span>
        </button>
        <SidebarNavigation order={navLayout.order}>
        <button className={`nav-item home-nav ${homeView?"active":""}`} aria-current={homeView?"page":undefined} onClick={()=>{navigate(null);setHomeView(true);}} onDragEnter={e=>{if(e.dataTransfer.types.includes(homeMime))setHomeView(true);}}><AppIcon value={icons.overrides.home} fallback={<House size={16}/>}/><span>Home</span></button>
        <SidebarSection name="General" icon={icons.overrides["section:General"]&&<AppIcon value={icons.overrides["section:General"]}/>} dropProps={homeDrag("group:general")} action={<IconButton title="Add General entry" onClick={()=>setCustomTab("general")}><Plus size={14}/></IconButton>}>
        <nav aria-label="Library">
          {ordered(collectionPrefs).filter(s=>!s.hidden).map(entry=>{
            const {key,name,pinned}=entry,target=entry.target??{kind:'view',value:key},view=target.kind==='view'?target.value:'',board=isBoardDestination(view);
            const count=target.kind==='project'?lib.projects.find(p=>String(p.id)===target.value)?.count:target.kind==='category'?categoryCounts.get(target.value):view==='links'?lib.items.filter(i=>i.kind==='link'&&!isCollectionLink(i)).length:board?lib.items.filter(i=>i.source===boardNames[view]).length:view==='facebook'?lib.items.filter(i=>i.kind==='video'&&(i.source==='Videos'||i.source.startsWith('Videos/'))).length:0;
            const folder=target.kind==='category'?(target.value==='__all__'?'':target.value===allComponents?componentInbox:target.value):undefined;
            const projectProps=target.kind==='project'?{'data-project-id':Number(target.value),'data-project-name':name,onDragOver:(e:React.DragEvent)=>{if(e.dataTransfer.types.includes('application/design-items')){e.preventDefault();e.currentTarget.classList.add('drop-target');}},onDragLeave:(e:React.DragEvent)=>e.currentTarget.classList.remove('drop-target'),onDrop:(e:React.DragEvent)=>drop(e,Number(target.value))}:{};
            return <button className={`nav-item general-nav ${!homeView&&generalKey===key?'active':''}`} key={key} {...homeDrag(`collection:${key}`)} {...projectProps} {...(folder!==undefined?{'data-category':folder,...categoryDropProps(folder)}:{})} onClick={()=>openGeneral(entry)} title={name}><GeneralEntryIcon entry={entry} preferences={icons}/><span>{name}</span>{pinned&&<Pin size={11}/>}<small>{count||''}</small></button>;
          })}
        </nav>
        </SidebarSection>
        <SidebarSection name="Projects" icon={icons.overrides["section:Projects"]&&<AppIcon value={icons.overrides["section:Projects"]}/>} dropProps={homeDrag("group:projects")} action={
          <IconButton
            title="New project"
            onClick={() => setModal({ kind: "project" })}
          >
            <Plus size={15} />
          </IconButton>}>
        <div className="projects">
          <nav aria-label="Projects">
            {lib.projects.map((p) => (
              <div
                className={`project-row ${!homeView && !generalKey && project === p.id ? "active" : ""}`}
                data-project-id={p.id}
                data-project-name={p.name}
                key={p.id}
                onDragOver={(e) => {
                  if (
                    e.dataTransfer.types.includes("application/design-items")
                  ) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect="copy";
                    e.currentTarget.classList.add("drop-target");
                  }
                }}
                onDragLeave={(e) => {
                  if(!(e.relatedTarget instanceof Node)||!e.currentTarget.contains(e.relatedTarget))e.currentTarget.classList.remove("drop-target");
                }}
                onDrop={(e) => drop(e, p.id)}
              >
                <button className="nav-item" {...homeDrag(`project:${p.id}`)} onClick={() => navigate(p.id)}>
                  <FolderIcon preferences={icons} id={`project:${p.id}`}/>
                  <span>{p.name}</span>
                  <small>{p.count || ""}</small>
                </button>
                <Popover label="" icon={<MoreHorizontal size={15} />}>
                  <button
                    onClick={() =>
                      setModal({ kind: "renameProject", id: p.id })
                    }
                  >
                    Rename
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      setModal({ kind: "deleteProject", id: p.id })
                    }
                  >
                    Delete project
                  </button>
                </Popover>
              </div>
            ))}
          </nav>
          {!lib.projects.length && (
            <button
              className="empty-project"
              onClick={() => setModal({ kind: "project" })}
            >
              <Plus size={13} /> New project
            </button>
          )}
        </div>
        </SidebarSection>
        <SidebarSection name="Categories" label="Design Inspo" identity="design" icon={icons.overrides.design&&<AppIcon value={icons.overrides.design} size={17}/>} styleId={sectionStyle} dropProps={{...homeDrag("design"),...categoryDropProps(""),"data-category":"","data-section-label":"Design Inspo",className:categoryDrop===""?"drop-target":""}} action={
          <IconButton
            title="New category"
            onClick={() => setModal({kind:"category",ids:[]})}
          >
            <Plus size={15} />
          </IconButton>}>
        <nav className="source-list" aria-label="Design Inspo">
          <button
            className={`nav-item ${!homeView&&!generalKey&&category===null&&!source&&!recent&&!project&&!boardView&&!linksOnly&&!resourcesView ? "source-active" : ""}`}
            {...homeDrag("design")}
            onClick={() => navigate(null)}
          >
            <FolderIcon preferences={icons} id="design:all" size={14}/>
            <span>
              All categories
            </span>
          </button>
          {sortedFolders([...categories, ''],'design').map(folderRow)}
        </nav>
        </SidebarSection>
        <SidebarSection name="Components" label="App Components" identity="components" icon={icons.overrides.components&&<AppIcon value={icons.overrides.components} size={17}/>} styleId={sectionStyle} dropProps={{...homeDrag(`category:${allComponents}`),...categoryDropProps(componentInbox),"data-category":componentInbox,"data-section-label":"App Components",className:categoryDrop===componentInbox?"drop-target":""}}>
          <nav aria-label="App Components">
            {folderRow(allComponents)}
            {sortedFolders(componentFolders,'components').map(folderRow)}
          </nav>
        </SidebarSection>
        </SidebarNavigation>
        <div className="sidebar-footer"><button title="Customise app" onClick={()=>setCustomTab('sidebar')}><SlidersHorizontal size={15}/><span>Customise</span></button>
          <button title="Settings" aria-label="Settings" onClick={() => setModal({ kind: "settings" })}>
            <Settings2 size={15} />
            <span>Settings</span>
          </button>
          <IconButton
            title="Rescan library"
            onClick={() => void invoke("rescan").catch(report)}
          >
            <RefreshCw size={14} className={lib.scanning ? "spin" : ""} />
          </IconButton>
        </div>
        <div
          className="sidebar-resize"
          onPointerDown={resizeSidebar}
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
        />
      </aside>
      <main inert={!!customTab || quickPreview !== null || (viewer !== null && !widePreview) || !!modal || !!capture || !!videoDialog || duplicatesOpen || removedOpen || libraryExportOpen}>
        {homeView?<HomeDashboard icons={icons} style={homeStyle} appearance={homeAppearance} customize={()=>setCustomTab("home")} destinations={homeDestinations} open={openHomeDestination} incoming={homeDrop} received={()=>setHomeDrop(null)} dragging={!!homeShortcutDrag.ghost}/>:<>
        <header className="topbar">
          <div className="view-title">
            <h1>{title}</h1>
            <span>
              {boardView ? boardItems.length : resourcesView
                ? filtered.filter(isResource).length
                : filtered.length.toLocaleString()}
            </span>
            {lib.scanning && (
              <LoaderCircle className="spin" size={13} aria-label="Scanning" />
            )}
          </div>
          <div className="header-actions">
            <ThumbnailProgress />
            {project!==null&&<button className="subtle-button" onClick={()=>setExtraDialog("sheet")}><Grid2X2 size={14}/>Contact sheet</button>}
            <button className="icon-button" aria-label="Undo organisation change" disabled={!historyActions.undoLabel||undoing} title={historyActions.undoLabel?`Undo: ${historyActions.undoLabel} (Ctrl+Z)`:"Nothing to undo"} onClick={()=>void undoLast()}><Undo2 size={16}/></button>
            <button className="icon-button" aria-label="Redo organisation change" disabled={!historyActions.redoLabel||undoing} title={historyActions.redoLabel?`Redo: ${historyActions.redoLabel} (Ctrl+Shift+Z / Ctrl+Y)`:"Nothing to redo"} onClick={()=>void redoLast()}><Redo2 size={16}/></button>
            <label className="search">
              <Search size={15} />
              <input
                ref={searchRef}
                placeholder="Search"
                aria-label="Search library"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search ? (
                <IconButton title="Clear search" onClick={() => setSearch("")}>
                  <X size={12} />
                </IconButton>
              ) : (
                <kbd>/</kbd>
              )}
            </label>
            {(videoQueue.jobs.length>0||videoView)&&<button className="subtle-button" aria-label="Show downloads" onClick={()=>setQueueOpen(open=>!open)}><Download size={14}/> Downloads{videoQueue.pending?` · ${videoQueue.pending}`:""}</button>}
            {videoView && <button className="subtle-button" onClick={()=>setVideoDialog({url:""})}><Download size={14}/> Video link</button>}
            <Popover label="Add" icon={<Plus size={14} />}>
              <button onClick={() => void chooseCaptureFiles()}>
                <Files size={14} /> Files
              </button>
              <button onClick={() => void pasteCapture()}>
                <ClipboardPaste size={14} /> Paste
              </button>
              <button onClick={() => videoView ? setVideoDialog({url:""}) : setCapture({ files: [], url: "", destination: linkDestination })}>
                <Link2 size={14} /> Link
              </button>
            </Popover>
          </div>
        </header>
        {!originalResources && (
          <div className="toolbar">
            <div className="filters">
              {!boardView && !videoView && <select
                aria-label="Filter by type"
                value={linksOnly ? "link" : type}
                onChange={(e) => {
                  setLinksOnly(false);
                  setType(e.target.value);
                }}
              >
                <option value="all">All types</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="animation">Animations</option>
                <option value="link">Links</option>
              </select>}
              <Popover
                label={tags.length ? `Tags · ${tags.length}` : "Tags"}
                icon={<Tag size={13} />}
                active={tags.length > 0}
              >
                {lib.tags.map((t) => (
                  <label className="check-row" key={t.id}>
                    <input
                      type="checkbox"
                      checked={tags.includes(t.id)}
                      onChange={() =>
                        setTags((prev) =>
                          prev.includes(t.id)
                            ? prev.filter((id) => id !== t.id)
                            : [...prev, t.id],
                        )
                      }
                    />
                    <span>{t.name}</span>
                    <small>{t.count || ""}</small>
                  </label>
                ))}
                <div className="menu-divider" />
                <button onClick={() => setModal({ kind: "manageTags" })}>
                  <SlidersHorizontal size={13} /> Manage tags
                </button>
              </Popover>
              {lib.tags.length>0&&<select aria-label="Tag matching" value={tagMode} onChange={e=>setTagMode(e.target.value==="all"?"all":"any")}><option value="any">Any tag</option><option value="all">All tags</option></select>}
              {!boardView && !videoView && <select
                aria-label="Filter by category"
                value={category??"__all__"}
                onChange={(e) => setCategory(e.target.value==="__all__"?null:e.target.value)}
              >
                <option value="__all__">All categories</option><option value="">Uncategorised</option>
                {[...categories, allComponents, ...componentFolders].map((s) => (
                  <option value={s} key={s}>
                    {categoryLabel(s)}
                  </option>
                ))}
              </select>}
              {activeFilters && (
                <button className="clear-filters" onClick={clearFilters}>
                  <X size={12} /> Clear
                </button>
              )}
            </div>
            {!recent&&<div className="display-controls">
              <ArrowDownUp size={13} />
              <select
                aria-label="Sort items"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  if (e.target.value === "shuffle") setSeed(Date.now());
                }}
              >
                <option value="recent">Recently added</option>
                <option value="name">Name</option>
                <option value="shuffle">Shuffle</option>
              </select>
              {sort === "shuffle" && (
                <IconButton
                  title="Shuffle again"
                  onClick={() => setSeed(Date.now())}
                >
                  <RefreshCw size={12} />
                </IconButton>
              )}
              {(!tableBoard || customCollection) && <><span className="divider" />
              <Grid2X2 size={13} />
              <input
                type="range"
                aria-label="Thumbnail size"
                min="160"
                max="420"
                step="20"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              /></>}
            </div>}
          </div>
        )}
        {readingCapture && (
          <div className="capture-reading">
            <LoaderCircle className="spin" size={13} /> Reading files…
          </div>
        )}
        {selected.size > 0 && !originalResources && (
          <div className="selection-bar">
            <IconButton
              title="Clear selection"
              onClick={() => setSelected(new Set())}
            >
              <X size={14} />
            </IconButton>
            <span>{selected.size} selected</span>
            {[...selected].some(id=>lib.items.some(i=>i.id===id&&i.kind!=="link"))&&<button title="Organise folders (C)" onClick={()=>setModal({kind:"category",ids:[...selected]})}><Folder size={14}/> Organise folders</button>}
            <button
              onClick={() => setModal({ kind: "projects", ids: [...selected] })}
            >
              <FolderPlus size={14} /> Add to project
            </button>
            <button
              onClick={() => setModal({ kind: "tags", ids: [...selected] })}
            >
              <Tag size={14} /> Tags
            </button>
            {project && (
              <button
                onClick={() =>
                  void perform({
                    action: "pin_project",
                    target: project,
                    ids: [...selected],
                  })
                }
              >
                <Pin size={14} /> Pin
              </button>
            )}
            {project && (
              <button
                onClick={() =>
                  void perform({
                    action: "remove_project",
                    target: project,
                    ids: [...selected],
                  }).then(() => setSelected(new Set()))
                }
              >
                Remove from project
              </button>
            )}
            <button
              className="select-all"
              onClick={() => setSelected(new Set(filtered.map((i) => i.id)))}
            >
              Select all
            </button>
            <button onClick={() => void removeItems([...selected])}><Trash2 size={14} /> Remove from library</button>
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <IconButton title="Dismiss error" onClick={() => setError("")}>
              <X size={14} />
            </IconButton>
          </div>
        )}
        <div
          className="content"
          ref={scrollRef}
          onScroll={() => setHoverId(null)}
        >
          {generalMissing?<div className="empty-state"><span>This collection is unavailable</span><button onClick={()=>setCustomTab('general')}>Choose another destination</button></div>:generalEntry?.layout&&generalEntry.layout!=='auto'?<CollectionView items={filtered} layout={generalEntry.layout} size={size} selected={selected} select={select} open={openItem} menu={(id,event)=>{const rect=event.currentTarget.getBoundingClientRect();setItemMenu({ids:[id],x:rect.left,y:rect.bottom});}} add={()=>videoView?setVideoDialog({url:''}):generalEntry.content==='link'||boardView||resourcesView||linksOnly?setCapture({files:[],url:'',destination:linkDestination}):void chooseCaptureFiles()}/>:recent?<RecentReferences key={recent} items={filtered} added={recent==="added"} open={openItem}/>:tableBoard ? <div className={`collection-table ${boardView}-table`}>
            {linkTable(boardItems)}
            {!boardItems.length && <div className="empty-state"><span>{activeFilters?"No matches":boardView==="fonts"?"No fonts yet":"No brand guidelines yet"}</span><button onClick={()=>activeFilters?clearFilters():setCapture({files:[],url:"",destination:boardView??"links"})}>{activeFilters?"Clear filters":"Add link"}</button></div>}
          </div> : boardView ? <LinkBoard selected={selected} openItem={openItem} items={boardItems} size={size} report={report} menu={(id,event)=>{const rect=event.currentTarget.getBoundingClientRect();setItemMenu({ids:[id],x:rect.left,y:rect.bottom});}} add={()=>setCapture({files:[],url:"",destination:boardView})} /> : resourcesView ? (
            <Resources icons={icons} favourites={ordered(sitePrefs).filter(s=>!s.hidden)} openItem={openItem} key={resourceVersion} search={search} items={filtered} report={report}
              menu={(id, event) => { const rect = event.currentTarget.getBoundingClientRect(); setItemMenu({ ids: [id], x: rect.left, y: rect.bottom }); }} />
          ) : !ready && !error ? (
            <div className="empty-state">
              <LoaderCircle className="spin" size={20} />
            </div>
          ) : !lib.root && lib.items.length === 0 ? (
            <div className="empty-state">
              <button className="primary" onClick={() => void chooseRoot()}>
                <FolderPlus size={15} /> Choose Design folder
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <span>
                {activeFilters
                  ? "No matches"
                  : lib.scanning
                    ? "Indexing…"
                    : videoView ? "No videos yet" : project
                      ? "No references yet"
                      : linksOnly
                        ? "No links yet"
                        : "No files found"}
              </span>
              {activeFilters ? (
                <button onClick={clearFilters}>Clear filters</button>
              ) : project ? (
                <button onClick={() => navigate(null)}>Browse library</button>
              ) : linksOnly ? (
                <button onClick={() => setCapture({ files: [], url: "" })}>
                  Add link
                </button>
              ) : videoView ? <button onClick={()=>setVideoDialog({url:""})}>Add video</button> : <button onClick={() => void chooseCaptureFiles()}>Add files</button>}
            </div>
          ) : (
            <>
              {images.length > 0 && (
                <MediaGrid
                  removeFolder={category&&isComponent(category)&&category!==componentInbox?categoryLabel(category).slice("Components / ".length):undefined}
                  onRemoveFolder={removeFromComponentFolder}
                  masonry={true}
                  copy={copyImage}
                  copying={copying}
                  previewId={dockedPreview ? viewer : null}
                  returnTo={gridReturn}
                  onReturned={finishGridReturn}
                  items={images}
                  parent={scrollRef}
                  size={size}
                  selected={selected}
                  select={select}
                  openItem={openItem}
                  onMenu={(id) => setModal({ kind: "projects", ids: [id] })}
                  project={project}
                  onPin={(item) =>
                    project &&
                    void perform({
                      action: item.favourites?.includes(project)
                        ? "unpin_project"
                        : "pin_project",
                      target: project,
                      ids: [item.id],
                    })
                  }
                  hoverId={hoverId}
                  setHoverId={setHoverId}
                />
              )}
              {filtered.some(i=>isBoardLink(i)&&!isTableLink(i)&&!isComponent(categoryOf(i))) && <LinkBoard selected={selected} openItem={openItem} items={filtered.filter(i=>isBoardLink(i)&&!isTableLink(i)&&!isComponent(categoryOf(i)))} size={size} report={report} menu={(id,event)=>{const rect=event.currentTarget.getBoundingClientRect();setItemMenu({ids:[id],x:rect.left,y:rect.bottom});}} />}
              {links.length > 0 && (
                linkTable(links)
              )}
            </>
          )}
        </div>
        </>}
      </main>
      {quickPreview!==null&&lib.items.find(i=>i.id===quickPreview)&&<QuickPreview item={lib.items.find(i=>i.id===quickPreview)!} close={()=>setQuickPreview(null)}/>}
      {activeItem && (
        <div className={dockedPreview ? "preview-shell preview-shell-docked" : "preview-shell"}>
        <Viewer
          key={activeItem.id}
          docked={dockedPreview}
          blocked={quickPreview !== null || !!modal || !!capture || !!videoDialog || duplicatesOpen || removedOpen || libraryExportOpen}
          item={activeItem}
          items={images}
          tags={lib.tags}
          projects={lib.projects}
          close={closeViewer}
          move={moveViewer}
          addProjects={() =>
            setModal({ kind: "projects", ids: [activeItem.id] })
          }
          addTags={() => setModal({ kind: "tags", ids: [activeItem.id] })}
          copy={() => void copyImage(activeItem.id)}
          copying={copying !== null}
          remove={() => void removeItems([activeItem.id])}
          report={report}
          pinned={!!project && !!activeItem.favourites?.includes(project)}
          pin={
            project
              ? () =>
                  void perform({
                    action: activeItem.favourites?.includes(project)
                      ? "unpin_project"
                      : "pin_project",
                    target: project,
                    ids: [activeItem.id],
                  })
              : undefined
          }
        />
        </div>
      )}
      {modal?.kind === "thumbnail" && lib.items.find(i=>i.id===modal.id) && <ThumbnailEditor item={lib.items.find(i=>i.id===modal.id)!} close={()=>setModal(null)} complete={async()=>{const next=await refresh();if(!next.undo_entries)appHistory.record({label:'Change thumbnail',kind:'library',undo:()=>runLibraryHistory(false,'Change thumbnail'),redo:()=>runLibraryHistory(true)});setModal(null);setNotice("Thumbnail updated");}}/>}
      {modal?.kind==="category"&&<CategoryPicker categories={modal.ids?.length ? [...categories,...componentFolders] : categories} componentItems={lib.items.filter(i=>modal.ids?.includes(i.id)&&i.kind!=="link")} toggleComponent={async(name,remove)=>{
        const ids=modal.ids?.filter(id=>lib.items.some(i=>i.id===id&&i.kind!=="link"))??[];
        await mutate({action:remove?"remove_component_folder":"set_category",ids,value:name});
        setCategoryUndo(null);setUndoIds([]);setNotice(remove?"Removed from component folder":"Added to component folder");
      }} count={modal.ids?.filter(id=>lib.items.some(i=>i.id===id&&i.kind!=="link")).length||0} close={()=>setModal(null)} choose={async name=>{if(modal.ids?.length)await changeCategory(modal.ids,name);else{await mutate({action:"create_category",name});setUndoIds([]);setCategoryUndo(null);setNotice(`Created ${name}`);}setModal(null);}}/>}
      {modal && modal.kind !== "thumbnail" && modal.kind !== "category" && (
        <Dialog
          modal={modal}
          lib={lib}
          close={() => setModal(null)}
          mutate={mutate}
          busy={busy}
          setBusy={setBusy}
          report={report}
          project={project}
          chooseRoot={chooseRoot}
          exportLibrary={()=>{setModal(null);setLibraryExportOpen(true);}}
          backup={backup}
          duplicates={() => {
            setModal(null);
            setDuplicatesOpen(true);
          }}
          removed={() => { setModal(null); setRemovedOpen(true); }}
          setModal={setModal}
          onDeleteProject={(id) => {
            if (project === id) navigate(null);
          }}
        />
      )}
      {queueOpen && !videoDialog && !capture && !modal && viewer===null && !duplicatesOpen && !removedOpen && <VideoDownloadQueue queue={videoQueue} project={project} close={()=>setQueueOpen(false)}/>}
      {videoDialog && <VideoDownloadDialog initialUrl={videoDialog.url} lib={lib} project={project} close={()=>setVideoDialog(null)} add={(text,projects,tags)=>{
        const result=videoQueue.add(text,projects,tags);setVideoDialog(null);setQueueOpen(true);setNotice(result.added?`${result.added} queued`:"Already queued");
      }}/>}

      {extraDialog==="sheet"&&<ContactSheet title={title} items={sheetItems} initial={selected} close={()=>setExtraDialog(null)}/>}
      {libraryExportOpen && <LibraryExport close={()=>setLibraryExportOpen(false)}/>}
      {capture && (
        <CaptureDialog
          draft={capture}
          lib={lib}
          project={project}
          source={source}
          close={() => {
            void invoke("discard_capture", {
              paths: capture.files.map((f) => f.path),
            }).catch(report);
            setCapture(null);
          }}
          complete={captured}
        />
      )}
      {duplicatesOpen && (
        <DuplicatesDialog
          lib={lib}
          close={() => setDuplicatesOpen(false)}
          refresh={refresh}
        />
      )}
      {dropActive && (
        <div className="file-drop-overlay">
          <Files size={24} />
          <span>Drop to capture</span>
        </div>
      )}
      {removedOpen && <RemovedDialog revision={lib} close={() => setRemovedOpen(false)} restore={(ids) => mutate({ action: "restore_items", ids })} />}
      {homeShortcutDrag.ghost&&<div className="home-drag-ghost" style={{left:homeShortcutDrag.ghost.x+14,top:homeShortcutDrag.ghost.y+16}}><Plus size={14}/>{homeShortcutDrag.ghost.label}<small>Reorder folders or drop on Home</small></div>}
      {folderMenu&&<FolderRename key={folderMenu.name} target={folderMenu} close={()=>setFolderMenu(null)} save={name=>{const list=isComponent(folderMenu.name)?componentFolders:categories;if(list.some(key=>key!==folderMenu.name&&categoryLabel(key).replace(/^Components \/ /,'').toLocaleLowerCase()===name.toLocaleLowerCase()))throw Error('A folder with that name already exists.');setFolderLabels({...folderLabels,[folderMenu.name]:name});}}/>}
      {customTab&&<Customization initial={customTab} close={()=>setCustomTab(null)} sectionStyle={sectionStyle} chooseSection={setSectionStyle} sidebarLayout={sidebarLayout} chooseLayout={setSidebarLayout} icons={icons} changeIcons={setIcons} iconTargets={iconTargets} generalOptions={generalOptions} saveGeneral={saveGeneral} homeStyle={homeStyle} chooseHome={setHomeStyle} sidebarWidth={sidebarWidth} setSidebarWidth={setSidebarWidth} tileSize={size} setTileSize={setSize} collections={collectionPrefs} setCollections={setCollectionPrefs} sites={sitePrefs} setSites={setSitePrefs} reduced={reducedMotion} setReduced={setReducedMotion} home={homeAppearance} changeHome={setHomeAppearance} manageLibrary={()=>{setCustomTab(null);setModal({kind:'settings'});}}/>}
      {itemMenu && <ItemMenu target={itemMenu} lib={lib} close={closeItemMenu}
        category={()=>setModal({kind:"category",ids:itemMenu.ids})}
        sendToSection={(ids,components)=>void changeCategory(ids,components?componentInbox:"").catch(report)}
        copy={(id) => void copyImage(id)} copying={copying !== null}
        editLink={(item) => setModal({ kind: "editLink", id: item.id })}
        editThumbnail={(item) => setModal({ kind: "thumbnail", id: item.id })}
        moveLink={(item) => void mutate({ action: "set_link_destination", target: item.id, value: isResource(item) ? "links" : "resources" }).then(() => { setUndoIds([]); setNotice(`Moved to ${isResource(item) ? "Links" : "Resources"}`); }).catch(report)}
        add={(target) => { void mutate({ action: "add_project", target, ids: itemMenu.ids }).then(() => { setUndoIds([]); setNotice(`Added to ${lib.projects.find((p) => p.id === target)?.name}`); }).catch(report); }}
        tags={() => setModal({ kind: "tags", ids: itemMenu.ids })}
        reveal={item => item.kind === "link" ? openItem(item) : void revealItemInDir(item.path).catch(report)}
        remove={() => void removeItems(itemMenu.ids)} />}
      {notice && (
        <div className="toast" role="status">
          <Check size={14} />
          {notice}
          {receipt&&<button onClick={()=>{const ids=receipt.ids.filter(id=>lib.items.some(i=>i.id===id));if(ids.length){setReceiptBrowse(ids);setQuickPreview(ids[0]);}setNotice("");}}>{receipt.existing?"View existing":"View"}</button>}
          {receipt?.undo&&receipt.undo===historyActions.undoLabel&&<button disabled={undoing} onClick={()=>void undoLast(receipt.undo)}>Undo move</button>}
          {(categoryUndo||undoIds.length>0)&&lib.undo_label===historyActions.undoLabel&&lib.undo_label&&<button disabled={undoing} onClick={()=>void undoLast()}>Undo</button>}
        </div>
      )}
      {itemDrag.badge}
    </div>
  );
}

// Cache only dimensions, never image bytes or user paths. Reuse across category switches.
const thumbnailRatios = new Map<string, number>();
function MediaGrid({
  removeFolder,
  onRemoveFolder,
  masonry,
  previewId,
  copy,
  copying,
  returnTo,
  onReturned,
  project,
  onPin,
  items,
  parent,
  size,
  selected,
  select,
  openItem,
  onMenu,
  hoverId,
  setHoverId,
}: {
  removeFolder?: string;
  onRemoveFolder: (item:Item)=>Promise<void>;
  masonry: boolean;
  previewId: number | null;
  copy: (id: number) => Promise<void>;
  copying: number | null;
  returnTo: { id: number } | null;
  onReturned: () => void;
  project: number | null;
  onPin: (item: Item) => void;
  items: Item[];
  parent: React.RefObject<HTMLDivElement | null>;
  size: number;
  selected: Set<number>;
  select: (id: number, range?: boolean) => void;
  openItem: (item: Item, e: React.MouseEvent) => void;
  onMenu: (id: number) => void;
  hoverId: number | null;
  setHoverId: (id: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [viewport, setViewport] = useState({ top: 0, height: 1000 });
  const [revision, setRevision] = useState(0);
  const [highlighted, setHighlighted] = useState<typeof returnTo>(null);
  const ratioFrame = useRef(0);
  useLayoutEffect(() => {
    const grid = ref.current, scroller = parent.current;
    if (!grid || !scroller) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setWidth(grid.clientWidth);
      const offset = grid.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      setViewport({ top: scroller.scrollTop - offset, height: scroller.clientHeight });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    observer.observe(grid); observer.observe(scroller);
    scroller.addEventListener("scroll", schedule, { passive: true });
    update();
    return () => { observer.disconnect(); scroller.removeEventListener("scroll", schedule); cancelAnimationFrame(frame); };
  }, [parent]);
  useEffect(() => () => cancelAnimationFrame(ratioFrame.current), []);
  const layout = useMemo(() => arrangeMasonry(items.map(item => thumbnailRatios.get(`${item.id}:${item.modified}`) ?? 1 / 1.4), width, size), [items, width, size, revision]);
  const visible = layout.tiles.filter(tile => tile.top + tile.height >= viewport.top - viewport.height && tile.top <= viewport.top + viewport.height * 2);
  useLayoutEffect(() => {
    if (!returnTo) return;
    const index = items.findIndex(item => item.id === returnTo.id);
    if (index < 0) { onReturned(); return; }
    const tile = layout.tiles[index], scroller = parent.current, grid = ref.current;
    if (!scroller || !grid) return;
    const offset = grid.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTop = Math.max(0, offset + tile.top - Math.max(0, (scroller.clientHeight - tile.height) / 2));
    setViewport({ top: scroller.scrollTop - offset, height: scroller.clientHeight });
    const button = grid.querySelector<HTMLButtonElement>(`[data-item-id="${returnTo.id}"] .card-open`);
    const image = button?.querySelector('img');
    if (button && (!image || image.complete)) {
      button.focus({ preventScroll: true }); setHighlighted(returnTo); onReturned();
    }
  }, [returnTo, items, layout, parent, onReturned, viewport.top]);
  useEffect(() => {
    if (!highlighted) return;
    const timer = window.setTimeout(() => setHighlighted(null), 2000);
    return () => window.clearTimeout(timer);
  }, [highlighted]);
  return <div ref={ref} className="media-grid poster-masonry" style={{ height: layout.height }}
    onLoadCapture={event => {
      const image = event.target as HTMLImageElement;
      if (image.tagName !== 'IMG' || image.classList.contains('hover-preview') || !image.naturalWidth || !image.naturalHeight) return;
      const key = image.closest<HTMLElement>('[data-media-key]')?.dataset.mediaKey;
      const ratio = image.naturalWidth / image.naturalHeight;
      if (!key || thumbnailRatios.get(key) === ratio) return;
      if (thumbnailRatios.size > 10000) thumbnailRatios.clear();
      thumbnailRatios.set(key, ratio);
      if (!ratioFrame.current) ratioFrame.current = requestAnimationFrame(() => { ratioFrame.current = 0; setRevision(value => value + 1); });
    }}>
    {visible.map(row => {
      const item = items[row.index];
      return <div className="masonry-tile" key={`${item.id}:${item.modified}`} data-media-key={`${item.id}:${item.modified}`}
        style={{ transform: `translate(${row.left}px, ${row.top}px)`, width: row.width, height: row.height }}>
              <Card
                removeFolder={removeFolder}
                onRemoveFolder={()=>onRemoveFolder(item)}
                copy={() => void copy(item.id)}
                copying={copying !== null}
                previewed={previewId === item.id}
                returned={highlighted?.id === item.id}
                canPin={!!project}
                pinned={!!project && !!item.favourites?.includes(project)}
                pin={() => onPin(item)}
                key={`${item.id}:${item.modified}`}
                item={item}
                selected={selected.has(item.id)}
                select={(range) => select(item.id, range)}
                open={(e) => openItem(item, e)}
                menu={() => onMenu(item.id)}
                playing={hoverId === item.id}
                hover={(value) => setHoverId(value && (item.kind === "video" || item.kind === "animation") ? item.id : null)}
                drag={(e) => {
                  const ids = selected.has(item.id) ? [...selected] : [item.id];
                  e.dataTransfer.setData(
                    "application/design-items",
                    JSON.stringify(ids),
                  );
                  e.dataTransfer.effectAllowed = "copyMove";
                }}
              />
      </div>;
    })}
  </div>;
}
function Card({
  removeFolder,
  onRemoveFolder,
  previewed,
  copy,
  copying,
  returned,
  canPin,
  pinned,
  pin,
  item,
  selected,
  select,
  open,
  menu,
  playing,
  hover,
  drag,
}: {
  removeFolder?: string;
  onRemoveFolder: ()=>Promise<void>;
  copy: () => void;
  copying: boolean;
  previewed: boolean;
  returned: boolean;
  canPin: boolean;
  pinned: boolean;
  pin: () => void;
  item: Item;
  selected: boolean;
  select: (range: boolean) => void;
  open: (e: React.MouseEvent) => void;
  menu: () => void;
  playing: boolean;
  hover: (value: boolean) => void;
  drag: (e: React.DragEvent) => void;
}) {
  const [removing,setRemoving]=useState(false);
  const [thumb, setThumb] = useState(""),
    [preview, setPreview] = useState(""),
    [failed, setFailed] = useState(false),
    [motionError, setMotionError] = useState(false),
    [retry, setRetry] = useState(0);
  const motion = item.kind === "video" || item.kind === "animation";
  useEffect(() => {
    const abort = new AbortController();
    setThumb("");
    setFailed(false);
    setPreview("");
    setMotionError(false);
    media(item, "thumbnail", abort.signal).then(
      (url) => {
        if (!abort.signal.aborted) setThumb(url);
      },
      () => {
        if (!abort.signal.aborted) setFailed(true);
      },
    );
    return () => abort.abort();
  }, [item.id, item.modified, item.path, retry]);
  useEffect(() => {
    if (!playing || !motion || motionError) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      media(item, "preview", abort.signal).then(
        (url) => {
          if (!abort.signal.aborted) setPreview(url);
        },
        () => {
          if (!abort.signal.aborted) setMotionError(true);
        },
      );
    }, 180);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [playing, motion, motionError, item.id, item.modified]);
  return (
    <article
      data-item-id={item.id}
      className={`card ${selected ? "selected" : ""} ${item.missing ? "missing" : ""} ${returned ? "returned" : ""} ${previewed ? "previewed" : ""}`}
      draggable={false}
      onDragStart={drag}
      onMouseEnter={() => hover(true)}
      onMouseLeave={() => hover(false)}
    >
      <button
        className="card-open"
        title="Open reference · Space to peek"
        aria-label={`Open ${item.name}`}
        onClick={open}
        onFocus={() => hover(false)}
      >
        {thumb && !failed ? (
          <img
            src={thumb}
            alt={item.name}
            loading="lazy"
            draggable={false}
            onError={() => setFailed(true)}
          />
        ) : failed || item.missing ? (
          <span className="file-fallback">
            <ImageOff size={22} />
            <span>{item.missing ? "Missing file" : item.name}</span>
          </span>
        ) : (
          <span className="skeleton" />
        )}
        {playing &&
          preview &&
          !motionError &&
          (item.kind === "animation" ? (
            <img
              src={preview}
              alt=""
              className="hover-preview"
              draggable={false}
              onError={() => setMotionError(true)}
            />
          ) : (
            <video
              src={preview}
              autoPlay
              muted
              loop
              playsInline
              className="hover-preview"
              draggable={false}
              onError={() => setMotionError(true)}
            />
          ))}
      </button>
      <div className="card-shade" />
      {failed && !item.missing && <button className="thumbnail-retry" title="Try loading this thumbnail again" onClick={() => { forgetMedia(item, "thumbnail"); setRetry(value => value + 1); }}><RefreshCw size={12} /> Retry</button>}
      {canPin && (
        <button
          className={`card-pin ${pinned ? "pinned" : ""}`}
          aria-label={pinned ? `Unpin ${item.name}` : `Pin ${item.name}`}
          aria-pressed={pinned}
          title={pinned ? "Unpin from project" : "Pin in project"}
          onClick={pin}
        >
          <Pin size={13} fill={pinned ? "currentColor" : "none"} />
        </button>
      )}
      <button
        className={`card-select ${selected ? "checked" : ""}`}
        aria-label={`Select ${item.name}`}
        aria-pressed={selected}
        onClick={(e) => {
          e.stopPropagation();
          select(e.shiftKey);
        }}
      >
        {selected && <Check size={12} />}
      </button>
      {motion && (
        <span
          className="media-badge"
          style={canPin ? { right: 38 } : undefined}
        >
          {item.kind === "animation"
            ? item.path.toLowerCase().endsWith(".gif")
              ? "GIF"
              : "MOTION"
            : "VIDEO"}
        </span>
      )}
      <div className="card-bottom">
        {removeFolder&&<button className="card-remove-folder" aria-label={`Remove ${item.name} from ${removeFolder}`} title={`Remove from ${removeFolder}`} disabled={removing} onClick={async e=>{e.stopPropagation();if(removing)return;setRemoving(true);try{await onRemoveFolder();}finally{setRemoving(false);}}}><FolderMinus size={15}/></button>}
        <span title={item.name}>{item.name}</span>
        {canCopyImage(item) && <button aria-label={`Copy ${item.name} to clipboard`} title={item.kind === "animation" ? "Copy image (first frame)" : "Copy image"} disabled={copying} onClick={copy}><ClipboardCopy size={15} /></button>}
        <button
          aria-label={`Add ${item.name} to project`}
          title="Add to project"
          onClick={menu}
        >
          <FolderPlus size={15} />
        </button>
      </div>
    </article>
  );
}
function LinksTable({
  project,
  onPin,
  items,
  selected,
  select,
  openItem,
  onEdit,
  onProjects,
  onTags,
  onDelete,
}: {
  project: number | null;
  onPin: (item: Item) => void;
  items: Item[];
  selected: Set<number>;
  select: (id: number, range?: boolean) => void;
  openItem: (item: Item, e: React.MouseEvent) => void;
  onEdit: (id: number) => void;
  onProjects: (id: number) => void;
  onTags: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <table className="links-table">
      <thead>
        <tr>
          <th className="check-col" />
          <th>Name</th>
          <th>Link</th>
          <th className="actions-col" />
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr
            key={item.id}
            data-item-id={item.id}
            className={selected.has(item.id) ? "selected" : ""}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(
                "application/design-items",
                JSON.stringify(
                  selected.has(item.id) ? [...selected] : [item.id],
                ),
              );
              e.dataTransfer.effectAllowed = "copy";
            }}
          >
            <td>
              <input
                type="checkbox"
                aria-label={`Select ${item.name}`}
                checked={selected.has(item.id)}
                onChange={(e) =>
                  select(item.id, (e.nativeEvent as MouseEvent).shiftKey)
                }
              />
            </td>
            <td>
              <button className="link-name" onClick={(e) => openItem(item, e)}>
                {!!project && item.favourites?.includes(project) && (
                  <Pin size={11} fill="currentColor" />
                )}
                {item.name}
              </button>
            </td>
            <td>
              <button className="link-url" onClick={(e) => openItem(item, e)}>
                {item.path}
                <ExternalLink size={11} />
              </button>
            </td>
            <td>
              <Popover label="" icon={<MoreHorizontal size={15} />}>
                {project && (
                  <button onClick={() => onPin(item)}>
                    <Pin size={13} />
                    {item.favourites?.includes(project)
                      ? "Unpin from project"
                      : "Pin in project"}
                  </button>
                )}
                <button onClick={() => onProjects(item.id)}>
                  <FolderPlus size={13} /> Add to project
                </button>
                <button onClick={() => onTags(item.id)}>
                  <Tag size={13} /> Tags
                </button>
                <button onClick={() => onEdit(item.id)}>Edit</button>
                <button className="danger" onClick={() => onDelete(item.id)}>
                Remove from library
                </button>
              </Popover>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function Viewer({
  docked,
  copy,
  copying,
  pinned,
  pin,
  blocked,
  item,
  items,
  tags,
  projects,
  close,
  move,
  addProjects,
  addTags,
  remove,
  report,
}: {
  docked: boolean;
  copy: () => void;
  copying: boolean;
  pinned: boolean;
  pin?: () => void;
  blocked: boolean;
  item: Item;
  items: Item[];
  tags: Label[];
  projects: Label[];
  close: () => void;
  move: (n: number) => void;
  addProjects: () => void;
  addTags: () => void;
  remove: () => void;
  report: (e: unknown) => void;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [compatible, setCompatible] = useState(false);
  const video = item.kind === "video";
  const [imageScale, setImageScale] = useState(1);
  const [zoomReset, setZoomReset] = useState(0);
  const viewerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!docked) viewerRef.current?.focus({ preventScroll: true });
  }, [docked]);
  useEffect(() => {
    setUrl("");
    setError("");
    setCompatible(false);
    const abort = new AbortController();
    media(item, "original", abort.signal).then(
      (url) => {
        if (!abort.signal.aborted) setUrl(url);
      },
      (e) => {
        if (!abort.signal.aborted) setError(String(e));
      },
    );
    return () => abort.abort();
  }, [item.id, item.modified]);
  const fallback = () => {
    if (compatible) {
      setError("Could not play this file.");
      return;
    }
    setCompatible(true);
    setUrl("");
    media(item, "compatible").then(setUrl, (e) => setError(String(e)));
  };
  return (
    <div
      ref={viewerRef}
      tabIndex={-1}
      inert={blocked}
      className={`viewer ${docked ? "viewer-docked" : ""}`}
      data-item-id={item.id}
      role={docked ? "region" : "dialog"}
      aria-modal={docked ? undefined : true}
      aria-label={docked ? `Preview: ${item.name}` : item.name}
      onClick={(e) => {
        if (!docked && e.target === e.currentTarget) close();
      }}
    >
      <header onClick={(e) => e.stopPropagation()}>
        <div>
          <span>{item.name}</span>
          <small>
            {items.findIndex((i) => i.id === item.id) + 1} / {items.length}
          </small>
        </div>
        <div className="viewer-actions">
          {pin && (
            <button aria-pressed={pinned} onClick={pin}>
              <Pin size={14} fill={pinned ? "currentColor" : "none"} />
              {pinned ? "Unpin" : "Pin"}
            </button>
          )}
          {item.source_url && (
            <IconButton
              title="Open source website"
              onClick={() => void openUrl(item.source_url!).catch(report)}
            >
              <Link2 size={16} />
            </IconButton>
          )}
          {!video && (
            <button
              className="zoom-reset"
              title="Reset zoom (double-click image)"
              aria-label="Reset image zoom"
              onClick={() => setZoomReset((n) => n + 1)}
            >
              {Math.round(imageScale * 100)}%
            </button>
          )}
          <button onClick={addProjects}>
            <FolderPlus size={15} /> Add to project
          </button>
          <button onClick={addTags}>
            <Tag size={14} /> Tags
          </button>
          {canCopyImage(item) && <button className="icon-button" aria-label="Copy image" title={item.kind === "animation" ? "Copy image (first frame) · Ctrl+C" : "Copy image · Ctrl+C"} disabled={copying} onClick={copy}><ClipboardCopy size={16} /></button>}
          <IconButton title="Remove from library" onClick={remove}><Trash2 size={16} /></IconButton>
          <IconButton
            title="Reveal in Explorer"
            onClick={() => void revealItemInDir(item.path).catch(report)}
          >
            <ExternalLink size={16} />
          </IconButton>
          <IconButton title="Close viewer" onClick={close}>
            <X size={19} />
          </IconButton>
        </div>
      </header>
      <IconButton
        title="Previous image"
        className="viewer-prev"
        onClick={() => move(-1)}
      >
        <ArrowLeft size={20} />
      </IconButton>
      <div className="viewer-media" onClick={(e) => e.stopPropagation()}>
        {error ? (
          <div className="viewer-error">
            <ImageOff size={26} />
            <span>{error}</span>
            <button
              onClick={() => void revealItemInDir(item.path).catch(report)}
            >
              Reveal original
            </button>
          </div>
        ) : !url ? (
          <LoaderCircle size={24} className="spin" />
        ) : video ? (
          <video
            key={url}
            src={url}
            autoPlay
            muted={false}
            controls
            loop
            playsInline
            onError={fallback}
          />
        ) : (
          <ZoomImage
            src={url}
            alt={item.name}
            onError={() => setError("Could not display this image.")}
            onZoomChange={setImageScale}
            resetToken={zoomReset}
          />
        )}
      </div>
      <IconButton
        title="Next image"
        className="viewer-next"
        onClick={() => move(1)}
      >
        <ArrowRight size={20} />
      </IconButton>
      <footer onClick={(e) => e.stopPropagation()}>
        <span>{item.source.replace(/_/g, " ")}</span>
        <div>
          {projects
            .filter((p) => item.projects.includes(p.id))
            .map((p) => (
              <span className="viewer-chip" key={p.id}>
                <Folder size={11} />
                {p.name}
              </span>
            ))}
          {tags
            .filter((t) => item.tags.includes(t.id))
            .map((t) => (
              <span className="viewer-chip" key={t.id}>
                {t.name}
              </span>
            ))}
        </div>
      </footer>
    </div>
  );
}

function Dialog({
  duplicates,
  removed,
  modal,
  lib,
  close,
  mutate,
  busy,
  setBusy,
  report,
  project,
  chooseRoot,
  exportLibrary,
  backup,
  setModal,
  onDeleteProject,
}: {
  duplicates: () => void;
  removed: () => void;
  modal: Modal;
  lib: Library;
  close: () => void;
  mutate: (c: Change) => Promise<Library>;
  busy: boolean;
  setBusy: (b: boolean) => void;
  report: (e: unknown) => void;
  project: number | null;
  chooseRoot: () => Promise<void>;
  exportLibrary: () => void;
  backup: (restore: boolean) => Promise<void>;
  setModal: (m: Modal) => void;
  onDeleteProject: (id: number) => void;
}) {
  const { kind, id, ids = [] } = modal;
  const existing =
    kind === "editLink" ? lib.items.find((i) => i.id === id) : null;
  const currentLabel = kind.toLowerCase().includes("project")
    ? lib.projects.find((p) => p.id === id)
    : lib.tags.find((t) => t.id === id);
  const [name, setName] = useState(existing?.name || currentLabel?.name || ""),
    [value, setValue] = useState(existing?.path || ""),
    [formError, setFormError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const membership = kind === "projects" || kind === "tags";
  const deleting = kind.startsWith("delete");
  const titles: Record<string, string> = {
    project: "New project",
    renameProject: "Rename project",
    tag: "New tag",
    renameTag: "Rename tag",
    link: "Add link",
    editLink: "Edit link",
    projects: "Projects",
    tags: "Tags",
    settings: "Settings",
    manageTags: "Tags",
    deleteProject: "Delete project?",
    deleteTag: "Delete tag?",
    deleteLinks: "Remove link?",
  };
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    const first = dialogRef.current?.querySelector<HTMLElement>(
      "input,button,select",
    );
    first?.focus();
    return () => before?.focus();
  }, []);
  useEffect(() => {
    setName(existing?.name || currentLabel?.name || "");
    setValue(existing?.path || "");
    setFormError("");
  }, [kind, id]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const actions: Record<string, string> = {
        project: "create_project",
        renameProject: "rename_project",
        tag: "create_tag",
        renameTag: "rename_tag",
        link: "create_link",
        editLink: "edit_link",
        deleteProject: "delete_project",
        deleteTag: "delete_tag",
        deleteLinks: "delete_links",
      };
      const next = await mutate({
        action: actions[kind],
        name,
        value,
        target: kind === "link" ? (project ?? undefined) : id,
        ids,
      });
      if (ids.length && (kind === "project" || kind === "tag")) {
        const label = (kind === "project" ? next.projects : next.tags).find(
          (l) => l.name === name.trim(),
        );
        if (label)
          await mutate({
            action: kind === "project" ? "add_project" : "add_tag",
            target: label.id,
            ids,
          });
      }
      if (kind === "deleteProject" && id) onDeleteProject(id);
      close();
    } catch (e) {
      setFormError(tidyError(e));
    } finally {
      setBusy(false);
    }
  };
  const assign = async (label: Label, all: boolean) => {
    setBusy(true);
    setFormError("");
    try {
      await mutate({
        action: `${all ? "remove" : "add"}_${kind === "tags" ? "tag" : "project"}`,
        target: label.id,
        ids,
      });
    } catch (e) {
      setFormError(tidyError(e));
    } finally {
      setBusy(false);
    }
  };
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
    );
    if (!nodes?.length) return;
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal ${kind === "settings" ? "settings-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onKeyDown={trap}
      >
        <div className="modal-heading">
          <h2 id="dialog-title">{titles[kind]}</h2>
          {kind==="settings"&&<div className="customise-history"><HistoryButtons/></div>}
          <IconButton title="Close dialog" onClick={close}>
            <X size={17} />
          </IconButton>
        </div>
        {membership ? (
          <>
            <div className="membership-list">
              {(kind === "tags" ? lib.tags : lib.projects).map((label) => {
                const group = lib.items.filter((i) => ids.includes(i.id));
                const count = group.filter((i) =>
                  (kind === "tags" ? i.tags : i.projects).includes(label.id),
                ).length;
                const all = group.length > 0 && count === group.length;
                return (
                  <button
                    className="membership-row"
                    disabled={busy}
                    key={label.id}
                    aria-pressed={all}
                    onClick={() => void assign(label, all)}
                  >
                    <span
                      className={`checkbox ${all ? "checked" : count ? "partial" : ""}`}
                    >
                      {all ? <Check size={12} /> : count ? "−" : ""}
                    </span>
                    {kind === "tags" ? <Tag size={14} /> : <Folder size={14} />}
                    <span>{label.name}</span>
                  </button>
                );
              })}
            </div>
            {!(kind === "tags" ? lib.tags : lib.projects).length && (
              <div className="modal-empty">No {kind} yet</div>
            )}
            <button
              className="text-button"
              onClick={() =>
                setModal({ kind: kind === "tags" ? "tag" : "project", ids })
              }
            >
              <Plus size={14} /> New {kind === "tags" ? "tag" : "project"}
            </button>
            <div className="modal-footer">
              <button className="primary" onClick={close}>
                Done
              </button>
            </div>
          </>
        ) : kind === "settings" ? (
          <div className="settings-content">
            <div className="setting-block">
              <span className="setting-label">Storage folders</span>
              {lib.source_paths?.length ? lib.source_paths.map(([name, path]) => <div className="storage-source" key={name}>
                <button className="text-button" onClick={() => void revealItemInDir(path).catch(report)}>{name} <ExternalLink size={12} /></button>
                <code title={path}>{path.replace(/^\\\\\?\\/, "")}</code>
              </div>) : <code title={lib.root}>{lib.root || "None selected"}</code>}
              <button
                className="subtle-button"
                disabled={lib.scanning}
                onClick={() => void chooseRoot()}
              >
                Change Design folder
              </button>
            </div>
            <div className="setting-block">
              <span className="setting-label">Library</span>
              <button className="subtle-button" onClick={duplicates}>
                <Copy size={13} /> Find duplicates
              </button>
              <button className="subtle-button" onClick={removed}><Trash2 size={13} /> Removed items</button>
              <button
                className="subtle-button"
                onClick={() => void invoke("rescan").catch(report)}
              >
                <RefreshCw size={13} /> Rescan
              </button>
              <button
                className="subtle-button"
                onClick={() => setModal({ kind: "manageTags" })}
              >
                <Tag size={13} /> Manage tags
              </button>
            </div>
            <div className="setting-block">
              <span className="setting-label">Backup</span>
              <button className="primary" onClick={exportLibrary}><Download size={14}/> Export full library</button>
              <small>Original media, saved links and organisation in one portable folder.</small>
              <div className="button-row">
                <button
                  className="subtle-button"
                  onClick={() => void backup(false)}
                >
                  Export metadata
                </button>
                <button
                  className="subtle-button"
                  onClick={() => void backup(true)}
                >
                  Import metadata
                </button>
              </div>
              <small>
                Projects, tags and links. Imports merge with your library.
              </small>
            </div>
            <div className="setting-block">
              <button
                className="text-button"
                onClick={() =>
                  void invoke<string>("data_folder")
                    .then((p) => revealItemInDir(p + "\\library.sqlite"))
                    .catch(report)
                }
              >
                Open app data <ExternalLink size={12} />
              </button>
              <small>Original files stay in your source folder.</small>
            </div>
            <AppInfo/>
            <div className="shortcuts">
              <span>Quick preview <kbd>Space</kbd></span>
              <span>Undo organisation <kbd>Ctrl Z</kbd></span>
              <span>Redo organisation <kbd>Ctrl Shift Z</kbd></span>
              <span>
                Search <kbd>/</kbd>
              </span>
              <span>
                Select all <kbd>Ctrl A</kbd>
              </span>
              <span>
                Viewer <kbd>← → Esc</kbd>
              </span>
            </div>
          </div>
        ) : kind === "manageTags" ? (
          <>
            <div className="tag-manager">
              {lib.tags.map((t) => (
                <div key={t.id}>
                  <Tag size={13} />
                  <span>{t.name}</span>
                  <small>{t.count}</small>
                  <button
                    onClick={() => setModal({ kind: "renameTag", id: t.id })}
                  >
                    Rename
                  </button>
                  <IconButton
                    title={`Delete ${t.name}`}
                    onClick={() => setModal({ kind: "deleteTag", id: t.id })}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              ))}
            </div>
            <button
              className="text-button"
              onClick={() => setModal({ kind: "tag" })}
            >
              <Plus size={14} /> New tag
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            {deleting ? (
              <p className="confirmation">
                {kind === "deleteProject"
                  ? `Remove “${currentLabel?.name}” and its collection memberships? Your files stay in the library.`
                  : kind === "deleteTag"
                    ? `Remove “${currentLabel?.name}” from all references?`
                    : "Remove this saved link from the library and its projects?"}
              </p>
            ) : (
              <>
                <label className="field">
                  Name
                  <input
                    autoComplete="off"
                    maxLength={300}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      kind === "project"
                        ? "Project name"
                        : kind === "tag"
                          ? "Tag name"
                          : "Name"
                    }
                  />
                </label>
                {(kind === "link" || kind === "editLink") && (
                  <label className="field">
                    Link
                    <input
                      type="url"
                      required
                      placeholder="https://"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                    />
                  </label>
                )}
              </>
            )}
            <div className="modal-footer">
              <button type="button" className="subtle-button" onClick={close}>
                Cancel
              </button>
              <button
                disabled={busy}
                className={deleting ? "danger-button" : "primary"}
              >
                {busy ? (
                  <LoaderCircle size={14} className="spin" />
                ) : deleting ? (
                  "Remove"
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </form>
        )}
        {formError && (
          <div className="form-error" role="alert">
            {formError}
          </div>
        )}
      </div>
    </div>
  );
}
