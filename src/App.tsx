import { useAppBranding } from "./AppBranding";
import ClientsWorkspace from "./ClientsWorkspace";
import ResearchWorkspace, {researchPages} from "./ResearchWorkspace";
import {OnboardingSettings} from "./LeadsTour";
import CalendarConnection,{useCalendarSync} from './CalendarConnection';
import {setDiagnosticContext,setDiagnosticRecords,opaqueId} from './diagnosticContext';
import StudioWorkspace from "./StudioWorkspace";
import type {StudioRoute} from "./studio";
import ProjectWorkspace, {ProjectFilePreview} from "./ProjectWorkspace";
import {useThumbnailReadiness} from './useThumbnailReadiness';
import Diagnostics from './DiagnosticsPanel';
import {record as recordDiagnostic,recordError,errorCode} from './diagnostics';
import {useVirtualizer} from '@tanstack/react-virtual';
import {ProjectTree, OrganiseProjectFolders, type FolderScope} from './ProjectFolders';
import LinkRating from './LinkRating';
import {useSelectionAppearance} from './SelectionStyles';
import ColourPicker, {ProjectColours} from './ColourPicker';
import HoverPreview from "./HoverPreview";
import {stageFiles} from "./captureImport";
import CaptureProgress, {type ImportProgress} from "./CaptureProgress";
import {Channel} from "@tauri-apps/api/core";
import { readViewSession, useViewSession, type ViewState } from "./viewSession";
import { copyImageToClipboard, readClipboard } from "./clipboard";
import { acceptsExternalDrop, readWebDrop } from './webDrop';
import StorageBar from './StorageBar';
import StoragePanel from './StoragePanel';
import {applyBackupPreferences,trackLibraryPreferences} from './backupPreferences';
import FolderRename from './FolderRename';
import { readFolderLabels } from './model';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { invoke, isTauri } from "./diagnostics";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "./nativeUi";
import { revealItemInDir } from "./nativeUi";
import { openUrl } from "./api";
import appLogo from "./assets/app-logo.svg";
import { arrangeMasonry } from "./masonry";
import {
  Star,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Folder,
  FolderPlus,
  FolderMinus,
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
import { changeLibrary, loadLibrary, media, cachedMedia, prioritizeThumbnail, forgetMedia, type Change } from "./api";
import ThumbnailProgress from "./ThumbnailProgress";
import { canCopyImage, isResource, isBoardLink, isCollectionLink, boardNames, isBoardDestination, type BoardKey, type LinkDestination, filterItems, type Item, type Label, type Library } from "./model";
import ContactSheet from "./ContactSheet";
import RecentReferences from "./RecentReferences";
import { collections, sites, withWebsites, withCodePen, ordered, useLocalList, type Shortcut, type GeneralTarget } from "./Shortcuts";
import LibraryExport from "./LibraryExport";
import AppInfo from "./AppInfo";
import QuickPreview from "./QuickPreview";
import ThumbnailEnlargement from "./ThumbnailEnlargement";
import useItemDragFeedback from "./useItemDragFeedback";
import ZoomImage from "./ZoomImage";
import VideoDownloadDialog from "./VideoDownloadDialog";
import VideoDownloadQueue from "./VideoDownloadQueue";
import useVideoQueue from "./useVideoQueue";
import Resources from "./Resources";
import LinkBoard from "./LinkBoard";
import ThumbnailEditor from "./ThumbnailEditor";
import CaptureDialog, {
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
import { allComponents, componentFolders as builtInComponentFolders, componentInbox, filingCategory, isComponent } from "./componentsLibrary";
import CategoryPicker from "./CategoryPicker";
import {designFoldersOf, componentFoldersOf, categoryOf, categoryLabel, libraryCategories, isTableCollection, isTableLink, createMembershipIndex} from "./model";

const empty: Library = {
  items: [],
  projects: [],
  tags: [],
  sources: [],
  root: "",
  scanning: false,
};
type Modal = {
  componentFolder?: boolean;
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

export default function App({startOnHome}:{startOnHome?:boolean}={}) {
 const branding=useAppBranding();
  useSelectionAppearance();
  const [savedSession]=useState(()=>startOnHome===undefined?readViewSession():null);
  const savedView=savedSession?.view;
  const [homeView,setHomeView]=useState(savedView?.homeView??startOnHome??true);
  const [homeDrop,setHomeDrop]=useState<string|null>(null);
  const [lib, setLib] = useState<Library>(empty),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNoticeText] = useState("");
  const [receipt,setReceipt]=useState<{ids:number[];existing:boolean;undo?:string} | null>(null);
  const setNotice=useCallback((text:string)=>{setReceipt(null);setNoticeText(text);},[]);
  const [tagMode,setTagMode]=useState<"any"|"all">(savedView?.tagMode??"any");
  const [recent,setRecent]=useState<"added"|"viewed"|null>(savedView?.recent??null);
  const [history,setHistory]=useLocalList<{id:number;path:string}>("reference-history",[]);
  const [collectionPrefs,setCollectionPrefs,setCollectionPrefsRaw]=useHistoryState<Shortcut[]>("collection-shortcuts",()=>{try{const value=JSON.parse(localStorage.getItem("collection-shortcuts")??"null");return withWebsites(Array.isArray(value)?value:collections);}catch{return collections;}},"Sidebar shortcuts");
  useEffect(()=>{const next=withWebsites(collectionPrefs);if(next!==collectionPrefs)setCollectionPrefsRaw(next);},[collectionPrefs,setCollectionPrefsRaw]);
  const [sitePrefs,setSitePrefs,setSitePrefsRaw]=useHistoryState<Shortcut[]>("site-shortcuts",()=>{try{const value=JSON.parse(localStorage.getItem("site-shortcuts")??"null");return Array.isArray(value)?value:sites;}catch{return sites;}},"Favourite websites");
  useEffect(()=>{const next=withCodePen(sitePrefs);if(next!==sitePrefs)setSitePrefsRaw(next);},[sitePrefs,setSitePrefsRaw]);
  const [extraDialog,setExtraDialog]=useState<"sheet"|null>(null);
  const [viewedOrder,setViewedOrder]=useState<number[]>(()=>savedView?.recent==="viewed"?history.map(entry=>entry.id):[]);
  const [receiptBrowse,setReceiptBrowse]=useState<number[]>([]);
  const track=useCallback((item:Item)=>setHistory(old=>old[0]?.id===item.id&&old[0].path===item.path?old:
    [{id:item.id,path:item.path},...old.filter(entry=>entry.id!==item.id)].slice(0,60)),[setHistory]);
  const [studioView,setStudioView]=useState<StudioRoute|null>(()=>localStorage.getItem("clients-startup")==="true"?{section:"clients",page:"today"}:savedView?.studioView??null);
  const [projectSection,setProjectSection]=useState<"overview"|"files"|"client"|"moodboard">(savedView?.projectSection??(savedView?.projectFolder!=null?"files":"overview"));
  const [projectFolder,setProjectFolder]=useState<FolderScope>(savedView?.projectFolder??null);
  const [ratingFilter,setRatingFilter]=useState(savedView?.ratingFilter??'');
  const [folderMembers,setFolderMembers]=useState<number[]|null>(null);
  const [project, setProject] = useState<number | null>(savedView?.project??null),
    [linksOnly, setLinksOnly] = useState(savedView?.linksOnly??false);
  const [search, setSearch] = useState(savedView?.search??""),
    [type, setType] = useState(savedView?.type??"all"),
    [tags, setTags] = useState<number[]>(savedView?.tags??[]),
    [source, setSource] = useState(savedView?.source??""),
    [sort, setSort] = useState(savedView?.sort??"recent");
  const [seed, setSeed] = useState(savedView?.seed??Date.now()),
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
  const [folderAppearance,setFolderAppearance]=useHistoryState<Record<string,{color?:string;starred?:boolean}>>('folder-appearance',()=>{try{return JSON.parse(localStorage.getItem('folder-appearance')??'{}');}catch{return {}; }},'Folder appearance');
  const [folderMenu,setFolderMenu]=useState<{name:string;x:number;y:number}|null>(null);
  const [folderOrder,setFolderOrder]=useHistoryState<Record<string,string[]>>('sidebar-folder-order',()=>{try{return JSON.parse(localStorage.getItem('sidebar-folder-order')??'{}');}catch{return {}; }},'Folder order');
  const sortedFolders=(folders:string[],group:string)=>{const saved=folderOrder[group]??[];return [...folders].sort((a,b)=>{const ai=saved.indexOf(a),bi=saved.indexOf(b);return (ai<0?Infinity:ai)-(bi<0?Infinity:bi)||categoryLabel(a).localeCompare(categoryLabel(b),undefined,{numeric:true,sensitivity:'base'});});};
  const navLayout=sidebarLayouts[sidebarLayout-1]??sidebarLayouts[0];
  const [generalKey,setGeneralKey]=useState<string|null>(savedView?.generalKey??null);
  const generalEntry=collectionPrefs.find(s=>s.key===generalKey);
  const generalRoute=useRef(generalEntry?JSON.stringify([generalEntry.key,generalEntry.target??{kind:'view',value:generalEntry.key}]):'');
  const generalMissing=generalEntry?.target?.kind==='project'&&!lib.projects.some(p=>String(p.id)===generalEntry.target!.value);
  useSidebarSpace(sidebarLayout);
  useEffect(()=>{localStorage.setItem('home-style',String(homeStyle));},[homeStyle]);
  useEffect(()=>{localStorage.setItem('home-appearance',JSON.stringify(homeAppearance));},[homeAppearance]);
  useEffect(()=>{localStorage.setItem('reduce-motion',String(reducedMotion));document.documentElement.dataset.motion=reducedMotion?'reduce':'';if(reducedMotion)document.getAnimations().forEach(a=>a.cancel());},[reducedMotion]);
  const [selected, setSelected] = useState<Set<number>>(new Set()),
    [viewer, setViewer] = useState<number | null>(savedView?.viewer??null),
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
  const [storageOpen,setStorageOpen]=useState(false);
  const [libraryMigration,setLibraryMigration]=useState(false);
  const [quickPreview,setQuickPreview]=useState<number|null>(null);
  const [thumbnailEnlarged,setThumbnailEnlarged]=useState(false);
  const previewCandidate=useRef<number|null>(null);
  const historyActions=useHistory();
  const undoing=historyActions.busy;
  const libRef=useRef(lib);libRef.current=lib;
  const historyReady=useRef(false);
  const pasteBusy=useRef(false);
  const stopHoverRef=useRef<()=>void>(()=>{});
  const setHoverId=useCallback((_id:null)=>stopHoverRef.current(),[]);
  const [category,setCategory] = useState<string|null>(savedView?.category??null);
  const [categoryUndo,setCategoryUndo] = useState<[number,string][]|null>(null);
  const categoryUndoNotice = useRef("");
  const [categoryDrop,setCategoryDrop] = useState<string|null>(null);
  const [videoView, setVideoView] = useState(savedView?.videoView??false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [videoDialog, setVideoDialog] = useState<{url:string}|null>(null);
  const [boardView, setBoardView] = useState<BoardKey | null>(savedView?.boardView??null);
  const [resourcesView, setResourcesView] = useState(savedView?.resourcesView??false),
    [capture, setCapture] = useState<CaptureDraft | null>(null),
    [duplicatesOpen, setDuplicatesOpen] = useState(false),
    [dropActive, setDropActive] = useState(false),
    [readingCapture, setReadingCapture] = useState(false);
  const [itemMenu, setItemMenu] = useState<ItemMenuTarget | null>(null),
    [removedOpen, setRemovedOpen] = useState(false),
    [undoIds, setUndoIds] = useState<number[]>([]);
  const [gridReturn, setGridReturn] = useState<{ id: number; offset?: number } | null>(savedSession?.scroll.anchor??null);
  const [copying, setCopying] = useState<number | null>(null);
  const [resourceVersion, setResourceVersion] = useState(0);
  const copyBusy = useRef(false);
  const finishGridReturn = useCallback(() => setGridReturn(null), []);
  const closeViewer = useCallback(() => {
    if (viewer !== null && libRef.current.items.some(i=>i.id===viewer&&i.kind==='link')) {
      requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>(`.link-card[data-item-id="${viewer}"] .link-card-open`)?.focus({preventScroll:true}));
    } else if (viewer !== null && !widePreview) setGridReturn({ id: viewer });
    setViewer(null);
  }, [viewer, widePreview]);
  const closeItemMenu = useCallback(() => setItemMenu(null), []);
  useEffect(() => {
    if (thumbnailEnlarged || quickPreview !== null || modal || viewer !== null || capture || duplicatesOpen) setHoverId(null);
    if (thumbnailEnlarged) setGridReturn(null);
  }, [thumbnailEnlarged,quickPreview,modal, viewer, capture, duplicatesOpen]);
  useEffect(()=>{if(quickPreview!==null&&!lib.items.some(i=>i.id===quickPreview))setQuickPreview(null);},[lib.items,quickPreview]);
  const [searchOpen,setSearchOpen]=useState(false);
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
  const clientInitialisation=useRef<{root:string;pending:Promise<unknown>}|null>(null);
  const initialiseClients=useCallback(()=>{
    const root=libRef.current.root;
    if(clientInitialisation.current?.root===root)return clientInitialisation.current.pending;
    const pending=invoke<boolean>('clients_initialise').then(changed=>changed?refresh():undefined).catch(error=>{clientInitialisation.current=null;throw error;});
    clientInitialisation.current={root,pending};return pending;
  },[refresh]);
  useCalendarSync(ready,refresh);
  const report = useCallback((e: unknown) => {recordError('ui.error',e);setError(tidyError(e));}, []);
  useEffect(()=>trackLibraryPreferences(report),[report]);
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
  useEffect(()=>{if(project!==null&&typeof projectFolder==='number'&&lib.items.length&&!(lib.project_folders??[]).some(f=>f.id===projectFolder&&f.project_id===project))setProjectFolder(null);},[project,projectFolder,lib.project_folders,lib.items.length]);
  const membershipIndex=useMemo(()=>{
    const start=performance.now(),index=createMembershipIndex(lib.items);
    recordDiagnostic('library.membership_index','success',performance.now()-start,{items:lib.items.length});
    return index;
  },[lib.items]);
  const enlargementItems=useMemo(()=>lib.items.filter(item=>item.kind!=="file"),[lib.items]);
  const sheetItems=useMemo(()=>project!==null?membershipIndex.projects.get(project)??[]:[],[membershipIndex,project]);
  const linkDestination: LinkDestination = boardView ?? (resourcesView ? "resources" : "links");
  const allCategoriesView = category === null && !project && !recent && !boardView && !videoView && !linksOnly && !resourcesView && !source;
  const filtered = useMemo(
    () => {
      if(studioView)return [];
      const start=performance.now();
      const matches=filterItems(lib.items, {
        designsOnly:allCategoriesView,
        projectFolder:project!==null?projectFolder:null,projectFolderIds:(lib.project_folders??[]).filter(f=>f.project_id===project).map(f=>f.id),rating:ratingFilter,
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
      },membershipIndex);
      recordDiagnostic('library.filter','success',performance.now()-start,{items:lib.items.length,count:matches.length});
      if(generalMissing || (project!==null&&!generalEntry&&projectSection!=="files") || (project!==null && !generalEntry && projectFolder===null && !search && type==="all" && !tags.length && !ratingFilter))return [];
      if(recent!=="viewed")return matches;
      const byId=new Map(matches.map(i=>[i.id,i]));
      return viewedOrder.flatMap(id=>byId.get(id)??[]);
    },
    [studioView,lib.items, membershipIndex, lib.project_folders, projectSection, projectFolder, ratingFilter, search, type, tags, source, project, linksOnly, sort, seed, boardView, videoView,category,tagMode,recent,viewedOrder,allCategoriesView,generalEntry,generalMissing,resourcesView],
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
  const previewItems = useMemo(()=>filtered.filter(i=>i.kind!=="link"||(i.source==="Websites"&&!!i.thumbnail)),[filtered]);
  const links = useMemo(
    () => filtered.filter((i) => i.kind === "link" && (componentFoldersOf(i).length>0 || !isBoardLink(i) || isTableLink(i))),
    [filtered],
  );
  const navigationStart=useRef<number|null>(null);
  useLayoutEffect(()=>{
    setDiagnosticRecords(lib.studio??[]);
    const section=modal?.kind==='settings'?'settings':studioView?.section??(homeView?'home':project!==null&&!generalEntry?'projects':generalEntry||boardView||linksOnly||resourcesView||videoView||recent?'general':category&&isComponent(category)?'components':'designs');
    const item=studioView?.id?(lib.studio??[]).find(e=>e.id===studioView.id):undefined;
    setDiagnosticContext({section,...(studioView?{page:studioView.page,tab:studioView.tab??(item?.kind==='lead'?'overview':item?.kind==='campaign'?'plan':'details'),...(item?{record_kind:item.kind,record_id:opaqueId(item.id)}:{})}:section==='projects'?{tab:projectSection,project:project!}:{} )});
  },[lib.studio,studioView,homeView,project,projectSection,generalEntry,boardView,linksOnly,resourcesView,videoView,recent,category,modal?.kind]);
  const viewState=useMemo<ViewState>(()=>({studioView,projectSection,projectFolder,ratingFilter,homeView,generalKey,project,category,linksOnly,resourcesView,boardView,videoView,recent,search,type,tags,tagMode,source,sort,seed,viewer}),[studioView,projectSection,projectFolder,ratingFilter,homeView,generalKey,project,category,linksOnly,resourcesView,boardView,videoView,recent,search,type,tags,tagMode,source,sort,seed,viewer]);
  useLayoutEffect(()=>{const start=navigationStart.current??performance.now();navigationStart.current=null;const operation=crypto.randomUUID();const fields={view:modal?.kind==='settings'?'settings':studioView?studioView.section:homeView?'home':project!==null?'project':category!==null?'folder':boardView??(resourcesView?'resources':recent??(linksOnly?'links':videoView?'videos':'designs')),project,folder:typeof projectFolder==='number'?projectFolder:category!==null?'category-'+Array.from(category).reduce((hash,char)=>(Math.imul(hash,31)+char.charCodeAt(0))>>>0,0).toString(16):null,items:filtered.length};recordDiagnostic('navigation','started',0,fields,operation);let second=0,finished=false;const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{finished=true;recordDiagnostic('navigation','success',performance.now()-start,fields,operation);});});return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);if(!finished)recordDiagnostic('navigation','cancelled',performance.now()-start,fields,operation);};},[studioView,projectSection,homeView,project,projectFolder,category,boardView,linksOnly,resourcesView,recent,videoView,modal?.kind]);
  useViewSession({state:viewState,initial:savedSession,ready,enabled:startOnHome===undefined,restoring:gridReturn!==null,scroller:scrollRef});
  useEffect(()=>{if(ready&&gridReturn?.offset!==undefined&&(!images.some(item=>item.id===gridReturn.id)||homeView||boardView||resourcesView||recent||customCollection))setGridReturn(null);},[ready,gridReturn,images,homeView,boardView,resourcesView,recent,customCollection]);
  const activeItem = lib.items.find((i) => i.id === viewer);
  const dockedPreview = widePreview && !!activeItem;
  useEffect(() => {
    if (ready && viewer !== null && !filtered.some(item => item.id === viewer)) setViewer(null);
  }, [filtered, viewer, ready]);
  const title = generalEntry?.name??(recent==="added"?"Recently added":recent==="viewed"?"Recently viewed":videoView ? "Facebook Videos" : boardView ? boardNames[boardView] : resourcesView
    ? "Resources"
    : project
      ? lib.projects.find((p) => p.id === project)?.name || "Project"
      : linksOnly
        ? "Links"
        : category !== null ? categoryLabel(category) : source ? source.split("/").pop()! : "All Designs");
  const activeFilters = !!(search || type !== "all" || tags.length || ratingFilter);
  const clearFilters = () => {
    setRatingFilter('');
    setSearch("");
    setType("all");
    setTags([]);
    setSource("");
  };
  useEffect(()=>{const replay=()=>{setModal(null);setHomeView(false);setStudioView({section:'leads',page:'pipeline'});};window.addEventListener('replay-leads-tour',replay);return()=>window.removeEventListener('replay-leads-tour',replay);},[]);
  const navigate = (id: number | null, onlyLinks = false) => {
    setStudioView(null);
    setHomeView(false);
    setGeneralKey(null);
    setQuickPreview(null);
    setGridReturn(null);
    setRecent(null);
    setResourcesView(false);
    setBoardView(null);
    setVideoView(false);
    setCategory(null);
    setProject(id);setProjectSection("overview");setProjectFolder(null);setRatingFilter('');
    if(id===null&&!onlyLinks&&sort.startsWith('rating-'))setSort('recent');
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
    const tracked=new Set(['win_studio_lead','update_studio','convert_studio_lead','update_client_records','update_project_overview','rate_links','unfile_project_folder','create_project_folder','rename_project_folder','move_project_folder','delete_project_folder','reorder_project_folders','add_project_folder','remove_project_folder','set_category','remove_design_folder','remove_component_folder','add_project','remove_project','add_tag','remove_tag','pin_project','unpin_project','remove_items','restore_items','create_link','edit_link','set_link_destination','set_source_url','rename_project','rename_tag','delete_project','delete_tag','create_project','create_tag','create_category']);
    if(!next.undo_entries&&tracked.has(c.action)&&next.undo_label){
      const recorded=typeof next.undo_count==='number'&&typeof before.undo_count==='number'?next.undo_count>before.undo_count||(next.undo_count===100&&JSON.stringify(next)!==JSON.stringify(before)):JSON.stringify(next)!==JSON.stringify(before);
      if(recorded){const label=next.undo_label;appHistory.record({label,kind:'library',undo:()=>runLibraryHistory(false,label),redo:()=>runLibraryHistory(true)});}
    }
    return next;
  }),[refresh,runLibraryHistory]);
  const undoLast=useCallback(async(expected?:string)=>{if(expected&&appHistory.undoLabel!==expected){setNotice("A newer change took place. Use the header Undo action.");return;}await appHistory.undo();},[]);
  const redoLast=useCallback(async()=>{await appHistory.redo();},[]);
  useEffect(()=>{
    const gesture=()=>crypto.randomUUID();
    const typing=(target:EventTarget|null)=>target instanceof HTMLElement&&!!target.closest('textarea,[contenteditable=true],input:not([type=range]):not([type=color]):not([type=number]):not([type=checkbox]):not([type=radio]):not([type=button])');
    const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&!e.altKey&&!typing(e.target)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();void ((e.key.toLowerCase()==='y'||e.shiftKey)?appHistory.redo():appHistory.undo());return;}if(e.target instanceof HTMLElement&&e.target.matches('input[type=range]')&&e.key.startsWith('Arrow'))appHistory.beginGesture(`key-${gesture()}`);};
    const down=(e:PointerEvent)=>{if(e.target instanceof HTMLElement&&e.target.closest('input[type=range],.sidebar-resize'))appHistory.beginGesture(`pointer-${gesture()}`);};
    const end=()=>appHistory.endGesture();
    document.addEventListener('keydown',key,true);document.addEventListener('keyup',end,true);document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);window.addEventListener('blur',end);
    return ()=>{document.removeEventListener('keydown',key,true);document.removeEventListener('keyup',end,true);document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',end);window.removeEventListener('blur',end);};
  },[]);
  const componentFolders=useMemo(()=>[...new Set([...builtInComponentFolders,...(lib.categories??[]).filter(isComponent),...lib.items.flatMap(componentFoldersOf)])],[lib]);
  const categories = useMemo(()=>libraryCategories(lib),[lib]);
  const categoryCounts = useMemo(() => new Map([...membershipIndex.categories].map(([name,items])=>[name,items.length])), [membershipIndex]);
  const generalCounts=useMemo(()=>{const counts=new Map<string,number>();for(const item of lib.items){counts.set(item.source,(counts.get(item.source)??0)+1);if(item.kind==='link'&&!isCollectionLink(item))counts.set('__links',(counts.get('__links')??0)+1);if(item.kind==='video'&&(item.source==='Videos'||item.source.startsWith('Videos/')))counts.set('__videos',(counts.get('__videos')??0)+1);}return counts;},[lib.items]);
  const homeDestinations=useMemo<HomeDestination[]>(()=>[
    {id:"design",label:"Design Inspo",kind:"category",value:"__all__",group:"design",count:lib.items.filter(i=>i.kind!=="link"&&designFoldersOf(i).length>0).length},
    {id:"group:general",label:"General",kind:"group",value:"general",group:"general"},
    {id:"group:projects",label:"Projects",kind:"group",value:"projects",group:"projects",count:lib.projects.length},
    ...collectionPrefs.map(s=>({id:`collection:${s.key}`,label:s.name,kind:"collection" as const,value:s.key,group:"general"})),
    ...lib.projects.map(p=>({id:`project:${p.id}`,label:p.name,kind:"project" as const,value:String(p.id),group:"projects",count:p.count})),
    ...[...categories,"",allComponents,...componentFolders].map(name=>({id:`category:${name}`,label:name===allComponents?"App Components":isComponent(name)?categoryLabel(name).slice("Components / ".length):categoryLabel(name),kind:"category" as const,value:name,group:isComponent(name)||name===allComponents?"components":"design",count:categoryCounts.get(name)??0})),
  ],[lib.items,lib.projects,collectionPrefs,categories,folderLabels,categoryCounts,componentFolders]);
  const generalOptions=useMemo<GeneralOption[]>(()=>[
    ...collections.map(entry=>({label:entry.name,target:{kind:'view' as const,value:entry.key}})),
    {label:'Design Inspo / All',target:{kind:'category',value:'__all__'}},{label:'App Components / All',target:{kind:'category',value:allComponents}},
    ...lib.projects.map(p=>({label:`Project / ${p.name}`,target:{kind:'project' as const,value:String(p.id)}})),
    ...[...categories,'',...componentFolders].map(name=>({label:`${isComponent(name)?'App Components':'Design Inspo'} / ${categoryLabel(name)}`,target:{kind:'category' as const,value:name}})),
  ],[lib.projects,categories,folderLabels,componentFolders]);
  const iconTargets=useMemo(()=>[{id:'home',label:'Home'},{id:'folders',label:'All folder icons'},{id:'section:Marketing',label:'Marketing section'},{id:'section:Leads',label:'Leads section'},{id:'section:Clients',label:'Clients section'},{id:'section:Research',label:'Research section'},{id:'section:General',label:'General section'},{id:'section:Projects',label:'Projects section'},{id:'design',label:'Design Inspo section'},{id:'components',label:'App Components section'},{id:'design:all',label:'All Design Inspo'},
    ...collectionPrefs.map(s=>({id:`collection:${s.key}`,label:`General / ${s.name}`})),...sitePrefs.map(s=>({id:`website:${s.key}`,label:`Website / ${s.name}`})),...lib.projects.map(p=>({id:`project:${p.id}`,label:`Project / ${p.name}`})),...[...categories,'',allComponents,...componentFolders].map(name=>({id:`category:${name}`,label:categoryLabel(name)}))],[collectionPrefs,sitePrefs,lib.projects,categories,folderLabels,componentFolders]);
  const designRows=useMemo(()=>sortedFolders([...categories,''],'design'),[categories,folderOrder,folderLabels]);
  const componentRows=useMemo(()=>sortedFolders(componentFolders,'components'),[folderOrder,folderLabels,componentFolders]);
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
    if(target.kind==='category'){if(target.value!=='__all__')setCategory(target.value===allComponents?allComponents:filingCategory(target.value));return;}
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
    if(destination.kind==="category"){if(destination.value!=="__all__")setCategory(destination.value===allComponents?allComponents:filingCategory(destination.value));return;}
    const key=destination.value;
    if(isBoardDestination(key))setBoardView(key);
    if(key==="resources")setResourcesView(true);
    if(key==="facebook"){setVideoView(true);setSource("Videos");}
    if(key==="added"||key==="viewed"){setRecent(key);if(key==="viewed"){const byId=new Map(lib.items.map(i=>[i.id,i.path]));setViewedOrder(history.filter(h=>byId.get(h.id)===h.path).map(h=>h.id));}}
  };
  const homeShortcutDrag=useHomeShortcutDrag(()=>{setHomeView(true);setViewer(null);setSelected(new Set());},setHomeDrop,(id,target,after)=>{const from=id.slice(9),to=target.slice(9),group=isComponent(from)?'components':'design';if(isComponent(from)!==isComponent(to)||from===to)return;const rows=sortedFolders(group==='components'?componentFolders:[...categories,''],group).filter(name=>name!==from),index=rows.indexOf(to);if(index<0)return;rows.splice(index+(after?1:0),0,from);setFolderOrder(previous=>({...previous,[group]:rows}));});
  const homeDrag=(id:string)=>homeShortcutDrag.props(id,homeDestinations.find(d=>d.id===id)?.label??"Destination");
  const changeCategory = async (ids:number[],name:string) => {
    const items=lib.items.filter(i=>ids.includes(i.id)&&(i.kind!=="link"||isComponent(name)||componentFoldersOf(i).length>0));
    if(!items.length)throw Error("Select images or videos to change category.");
    name = filingCategory(name);
    const previous: [number,string][] = items.map(i=>[i.id,categoryOf(i)]);
    await mutate({action:"set_category",ids:items.map(i=>i.id),value:name});
    setUndoIds([]);setCategoryUndo(previous);setSelected(new Set());
    categoryUndoNotice.current=`${items.length} ${items.length===1?"reference":"references"} ${name && name!==componentInbox ? "added to" : "moved to"} ${name===componentInbox?"App Components / Uncategorised":name===""?"Design Inspo / Uncategorised":categoryLabel(name)}`;
    setNotice(categoryUndoNotice.current);
  };
  const removeFromComponentFolder = async (item:Item) => {
    if(project!==null&&typeof projectFolder==='number'){await perform({action:'remove_project_folder',target:projectFolder,ids:[item.id]});return;}
    if(!category||category===allComponents||category===componentInbox)return;
    const folder=category;
    try {
      await mutate({action:isComponent(folder)?"remove_component_folder":"remove_design_folder",ids:[item.id],value:folder});
      setSelected(previous=>{const next=new Set(previous);next.delete(item.id);return next;});
      setUndoIds([]);setCategoryUndo([[item.id,folder]]);
      categoryUndoNotice.current=`Removed from ${categoryLabel(folder)}`;
      setNotice(categoryUndoNotice.current);
    } catch(error){report(error);}
  };
  const categoryDropProps = (name:string) => ({
    onDragOver:(e:React.DragEvent)=>{if(e.dataTransfer.types.includes("application/design-items")||acceptsExternalDrop(e.dataTransfer)){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect=acceptsExternalDrop(e.dataTransfer)?"copy":"move";setCategoryDrop(name);}},
    onDragLeave:(e:React.DragEvent)=>{if(!(e.relatedTarget instanceof Node)||!e.currentTarget.contains(e.relatedTarget))setCategoryDrop(null);},
    onDrop:(e:React.DragEvent)=>{e.preventDefault();e.stopPropagation();setCategoryDrop(null);setDropActive(false);if(acceptsExternalDrop(e.dataTransfer)){queueImageDrop(e.dataTransfer,name);return;}try{const ids=JSON.parse(e.dataTransfer.getData("application/design-items"));if(Array.isArray(ids)&&ids.every(Number.isInteger))void changeCategory(ids,name).catch(report);}catch{/* Unrelated drag. */}}
  });
  const folderRow = (s: string) => (
    <button
      className={`nav-item source-item ${s===allComponents?"source-parent":""} ${!homeView && !generalKey && category === s ? "source-active" : ""} ${categoryDrop===s?"drop-target":""}`}
      {...homeDrag(`category:${s}`)}
      onContextMenu={e=>{e.preventDefault();e.stopPropagation();setFolderMenu({name:s,x:e.clientX,y:e.clientY});}}
      data-folder-order={s===allComponents?undefined:isComponent(s)?'components':'design'}
      data-category={s}
      {...categoryDropProps(s)}
      key={s}
      title={`Open ${categoryLabel(s)}; drop references here to ${s&&s!==componentInbox&&s!==allComponents?"add to this folder":"change category"}`}
      onClick={() => { navigate(null); setCategory(s); }}
    >
      {isComponent(s)&&folderAppearance[s]?.starred&&<Star className="folder-star" size={11} fill="currentColor" aria-label="Starred folder"/>}
      <i className="folder-row-icon" style={{color:folderAppearance[s]?.color}}><FolderIcon preferences={icons} id={`category:${s}`} size={14}/></i>
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
    // Gallery clicks only focus the thumbnail for Space preview. Keep explicit
    // link actions and modifier-key selection available.
    if(item.kind!=="link"&&(project!==null||category!==null||allCategoriesView)){setSelected(new Set([item.id]));anchor.current=item.id;return;}
    if(item.kind==="file"){setQuickPreview(item.id);return;}
    if (item.kind === "link" && !(item.source === "Websites" && item.thumbnail)) {
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
      await copyImageToClipboard(id);
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
        const n = previewItems.findIndex((i) => i.id === id);
        return previewItems[(n + delta + previewItems.length) % previewItems.length]?.id ?? null;
      });
    },
    [previewItems],
  );
  useLayoutEffect(() => {
    const key = (e: KeyboardEvent) => {
      if(document.querySelector('.project-dialog-backdrop')||(e.target as HTMLElement)?.closest('.link-rating'))return;
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
      if(document.querySelector('.project-dialog-backdrop')||(e.target as HTMLElement)?.closest('.link-rating,.project-folder-dialog'))return;
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

    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [modal, viewer, filtered, moveViewer, capture, duplicatesOpen, removedOpen, itemMenu, selected, removeItems, closeViewer, activeItem, copyImage, videoDialog, quickPreview, undoLast, redoLast, widePreview, libraryExportOpen,extraDialog,receiptBrowse,homeView,customTab]);
  useEffect(()=>{
    if(!searchOpen)return;
    searchRef.current?.focus();searchRef.current?.select();
    const outside=(e:PointerEvent)=>{if(!(e.target as HTMLElement)?.closest(".search-popup"))setSearchOpen(false);};
    window.addEventListener("pointerdown",outside);return()=>window.removeEventListener("pointerdown",outside);
  },[searchOpen]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(e.altKey||modal||capture||videoDialog||duplicatesOpen||removedOpen||libraryExportOpen||storageOpen||extraDialog||customTab||quickPreview!==null||itemMenu||viewer!==null)return;
      if(document.querySelector('.project-dialog-backdrop')||(e.target as HTMLElement)?.closest('.link-rating,.project-folder-dialog'))return;
      const typing=(e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable=true]");
      const command=e.ctrlKey||e.metaKey;
      if(command&&e.key===","&&!typing){e.preventDefault();setSearchOpen(false);setModal({kind:"settings"});return;}
      if((command&&["f","k"].includes(e.key.toLowerCase()))||(!typing&&!command&&e.key==="/")){
        e.preventDefault();if(studioView){window.dispatchEvent(new Event("studio-search"));return;}if(project!==null&&!generalEntry&&projectSection==='client'){window.dispatchEvent(new Event('client-search'));return;}if(project!==null&&!generalEntry)setProjectSection('files');if(homeView)navigate(null);setSearchOpen(true);searchRef.current?.focus();searchRef.current?.select();
      }
    };
    window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
  },[studioView,modal,capture,videoDialog,duplicatesOpen,removedOpen,libraryExportOpen,storageOpen,extraDialog,customTab,quickPreview,itemMenu,viewer,homeView,project,projectSection,generalEntry]);
  const showCaptureReceipt=useCallback((result:CaptureResult, next:Library, targetCategory:string|null, targetProject?:{project:number;folder:number|null})=>{
    const saved=next.items.filter(i=>result.ids.includes(i.id));
    if(!saved.length)return;
    const item=saved[0];
    const projectDestination=targetProject?[next.projects.find(p=>p.id===targetProject.project)?.name,targetProject.folder?next.project_folders?.find(f=>f.id===targetProject.folder)?.name:undefined].filter(Boolean).join(' / '):null;
    const destination=projectDestination||(targetCategory!==null?categoryLabel(targetCategory):result.destination==="links"?"Links":result.destination==="resources"?"Resources":
      result.destination&&isBoardDestination(result.destination)?boardNames[result.destination]:
      item.source||'library');
    const prior=new Map(lib.items.map(i=>[i.id,i]));
    const already=result.reused>0&&!result.added&&saved.every(i=>{
      const previous=prior.get(i.id);
      if(targetProject)return !!previous&&(targetProject.folder?previous.project_folders?.includes(targetProject.folder):previous.projects.includes(targetProject.project));
      return targetCategory===null||!!previous&&(isComponent(filingCategory(targetCategory))?componentFoldersOf(previous).includes(filingCategory(targetCategory)):designFoldersOf(previous).includes(filingCategory(targetCategory)));
    });
    const message=result.moved_from?`Moved from ${result.moved_from} to ${destination}`:
      result.added&&result.reused?`${result.added} added · ${result.reused} reused in ${destination}`:
      already?`Already in ${destination}`:`${saved.length===1?"Added":saved.length+" added"} to ${destination}`;
    setUndoIds([]);setCategoryUndo(null);setNoticeText(message);
    setReceipt({ids:saved.map(i=>i.id),existing:already&&!result.moved_from,undo:result.move_label});
  },[lib.items]);
  const [importProgress,setImportProgress]=useState<ImportProgress|null>(null);
  const dropQueue = useRef(Promise.resolve());
  const [pendingImports,setPendingImports]=useState(0);
  const enqueueImport=useCallback((operation:()=>Promise<void>)=>{
    const queuedAt=performance.now();const operationId=crypto.randomUUID();recordDiagnostic('import.queue','started',0,{},operationId);
    setPendingImports(count=>count+1);
    dropQueue.current=dropQueue.current.then(async()=>{
      setReadingCapture(true);setImportProgress(null);
      try{recordDiagnostic('import.queue','success',performance.now()-queuedAt,{},operationId);await operation();recordDiagnostic('import.workflow','success',performance.now()-queuedAt,{},operationId);}catch(error){recordDiagnostic('import.workflow','error',performance.now()-queuedAt,{error_code:errorCode(error)},operationId);report(error);}
      finally{setPendingImports(count=>count-1);setReadingCapture(false);setImportProgress(null);}
    });
  },[report]);
  const queueImageDrop = useCallback((data:DataTransfer, destination:string|null, projectTarget?:{project:number;folder:number|null}) => {
    setDropActive(false);
    // Read immediately: browser drag data is unavailable after the drop event returns.
    const payload = readWebDrop(data);
    enqueueImport(async () => {
      let files:CaptureDraft['files'] = [];
      try {
        if(payload.files.length) files = (await stageFiles(payload.files,setImportProgress)).files;
        else if(payload.imageUrl) files = [await invoke('stage_web_image',{url:payload.imageUrl})];
        else if(!payload.sourceUrl) throw new Error('Drag the image itself, or copy and paste it into this folder.');
        const onProgress=new Channel<ImportProgress>();onProgress.onmessage=setImportProgress;
        setImportProgress({phase:'waiting',checked:0,total:0,current:'',elapsed_ms:0,remaining_seconds:null});
        const result = await appHistory.perform(()=>invoke<CaptureResult>('capture_items_progress',{onProgress,input:{
          files,url:files.length?'':payload.sourceUrl,name:files.length===1?files[0].name.replace(/\.[^.]+$/,''):'',
          source:destination==='Photography'?'Photography':'Design',project_only:!!projectTarget,projects:projectTarget?[projectTarget.project]:[],tags:[],source_url:payload.sourceUrl,resource:false,
        }}));
        setImportProgress({phase:'finishing',checked:0,total:0,current:'Updating folders and thumbnails',elapsed_ms:0,remaining_seconds:null});
        recordCapture(result);
        if(projectTarget?.folder&&result.ids.length)await mutate({action:'add_project_folder',target:projectTarget.folder,ids:result.ids});
        if(!projectTarget&&destination!==null&&result.ids.length)await mutate({action:'set_category',ids:result.ids,value:filingCategory(destination)});
        showCaptureReceipt(result,await refresh(),destination,projectTarget);
      } catch(error){report(error);}
      finally {
        await invoke('discard_capture',{paths:files.map(file=>file.path)}).catch(report);
      }
    });
  },[mutate,recordCapture,refresh,report,showCaptureReceipt,enqueueImport]);
  const pasteCapture = useCallback(async (target?:{category:string|null;project:number|null;folder:number|null}) => {
    if(target||((category!==null||project!==null)&&!resourcesView&&!boardView&&!videoView&&!linksOnly)){
      // Read now, not when the import reaches the front of the queue. The clipboard
      // helper still orders native reads behind preceding app copy operations.
      const snapshot=readClipboard<CaptureDraft>().then(draft=>({draft,error:null}),error=>({draft:null,error}));
      const targetProject=target?target.project:project;const destination=targetProject!==null?null:target?target.category:category;const targetFolder=target?target.folder:typeof projectFolder==='number'?projectFolder:null;
      enqueueImport(async()=>{
        const {draft,error}=await snapshot;
        if(!draft)throw error;
        try{
          if(!draft.files.length&&!(draft.url&&(targetProject!==null||(destination!==null&&isComponent(destination))||destination===allComponents))){
            if(target)throw Error('Copy an image or file to paste into a Design Inspo folder. Links can be pasted into projects or App Components.');
            setCapture({...draft,destination:linkDestination});return;
          }
          const onProgress=new Channel<ImportProgress>();onProgress.onmessage=setImportProgress;
          setImportProgress({phase:'waiting',checked:0,total:0,current:'',elapsed_ms:0,remaining_seconds:null});
          const result=await appHistory.perform(()=>invoke<CaptureResult>('capture_items_progress',{onProgress,input:{
            files:draft.files,url:draft.files.length?'':draft.url,name:draft.files.length===1?draft.files[0].name.replace(/\.[^.]+$/,''):'',
            source:destination==='Photography'?'Photography':'Design',project_only:targetProject!==null,projects:targetProject!==null?[targetProject]:[],tags:[],source_url:'',resource:false,
          }}));
          recordCapture(result);
          setImportProgress({phase:'finishing',checked:0,total:0,current:'Updating folders and thumbnails',elapsed_ms:0,remaining_seconds:null});
          if(result.ids.length&&destination!==null)await mutate({action:'set_category',ids:result.ids,value:filingCategory(destination)});
          if(result.ids.length&&targetFolder!==null)await mutate({action:'add_project_folder',ids:result.ids,target:targetFolder});
          showCaptureReceipt(result,await refresh(),destination,targetProject!==null?{project:targetProject,folder:targetFolder}:undefined);
        }finally{await invoke('discard_capture',{paths:draft.files.map(file=>file.path)}).catch(report);}
      });
      return;
    }
    if(pasteBusy.current)return;
    pasteBusy.current=true;
    try {
      setReadingCapture(true);
      const draft = await readClipboard<CaptureDraft>();
      if(videoView && draft.url){setVideoDialog({url:draft.url});return;}
      setCapture(boardView ? { ...draft, files: [], thumbnail: draft.files[0], destination: linkDestination } : { ...draft, destination: linkDestination });
    } catch (e) {
      report(e);
    } finally {
      pasteBusy.current=false;
      setReadingCapture(false);
    }
  }, [report, resourcesView, boardView, linkDestination, videoView, category, project, projectFolder, linksOnly, refresh,showCaptureReceipt,mutate,recordCapture,enqueueImport]);
  const openStudio=(route:StudioRoute)=>{navigate(null);setStudioView(route);};
  const [addSectionRequest,setAddSectionRequest]=useState(0);
  const startSectionAdd=(section:'marketing'|'leads'|'research'|'clients')=>{openStudio({section,page:section==='marketing'?'campaigns':section==='leads'?'pipeline':section==='clients'?'today':'all'});setAddSectionRequest(n=>n+1);};
  useEffect(()=>{if(!addSectionRequest)return;const input=document.querySelector<HTMLInputElement>('.studio-quick-add input[aria-label="New record name"],.research-add input,.clients-add input');input?.focus();input?.scrollIntoView({block:'nearest'});},[addSectionRequest]);

  const importStudio=(id:string,mode:'paste'|'files'|'drop',data?:DataTransfer)=>{
    const payload=data?readWebDrop(data):null;
    const snapshot=mode==='paste'?readClipboard<CaptureDraft>().then(draft=>({draft,error:null}),error=>({draft:null,error})):null;
    const selected=mode==='files'?open({multiple:true,title:'Add studio files'}).then(paths=>({paths,error:null}),error=>({paths:null,error})):null;
    enqueueImport(async()=>{
      let files:CaptureDraft['files']=[];
      try{
        let url='';
        if(snapshot){const result=await snapshot;if(!result.draft)throw result.error;files=result.draft.files;url=result.draft.url;}
        else if(selected){const result=await selected;if(result.error)throw result.error;if(!result.paths)return;files=(Array.isArray(result.paths)?result.paths:[result.paths]).map(path=>({path,name:path.replace(/\\/g,'/').split('/').pop()!}));}
        else if(payload){if(payload.files.length)files=(await stageFiles(payload.files,setImportProgress)).files;else if(payload.imageUrl)files=[await invoke('stage_web_image',{url:payload.imageUrl})];url=payload.sourceUrl;}
        if(!files.length&&!url)throw Error('Copy a file, image or URL first.');
        const onProgress=new Channel<ImportProgress>();onProgress.onmessage=setImportProgress;
        const result=await appHistory.perform(()=>invoke<CaptureResult>('capture_items_progress',{onProgress,input:{studio:id,files,url:files.length?'':url,name:'',source:'Design',projects:[],tags:[],resource:false}}));
        recordCapture(result);await refresh();setNotice(`Saved ${result.ids.length} reference${result.ids.length===1?'':'s'}`);
      }finally{await invoke('discard_capture',{paths:files.map(f=>f.path)}).catch(report);}
    });
  };
  const chooseCaptureFiles = async () => {
    if(project!==null){
      const target=project,folder=typeof projectFolder==='number'?projectFolder:null;
      try{const paths=await open({multiple:true,title:'Add project files'});if(!paths)return;
        const files=(Array.isArray(paths)?paths:[paths]).map(path=>({path,name:path.replace(/\\/g,'/').split('/').pop()!}));
        enqueueImport(async()=>{const onProgress=new Channel<ImportProgress>();onProgress.onmessage=setImportProgress;
          const result=await appHistory.perform(()=>invoke<CaptureResult>('capture_items_progress',{onProgress,input:{files,source:'Design',projects:[target],project_only:true,tags:[],url:'',name:'',source_url:'',resource:false}}));
          recordCapture(result);if(folder!==null&&result.ids.length)await mutate({action:'add_project_folder',target:folder,ids:result.ids});
          showCaptureReceipt(result,await refresh(),null,{project:target,folder});
        });
      }catch(error){report(error);}return;
    }
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
        setCapture(boardView==="websites"?{files:[],url:"",thumbnail:files[0],destination:"websites"}:{ files, url: "" });
      }
    } catch (e) {
      report(e);
    }
  };
  useEffect(() => {
    const paste = (e: KeyboardEvent) => {
      if(studioView||document.querySelector('.project-dialog-backdrop'))return;
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "v" && !e.repeat &&
        !(e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true]",
        ) &&
        quickPreview === null && !libraryExportOpen && !storageOpen && !extraDialog && !capture &&
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
      if((e.target as HTMLElement)?.closest(".home-dashboard,.customise-backdrop,.studio-workspace")){setDropActive(false);return;}
      if (!extraDialog && !storageOpen && e.dataTransfer && acceptsExternalDrop(e.dataTransfer)) {
        e.preventDefault();
        setDropActive(true);
      }
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDropActive(false);
    };
    const drop = (e: DragEvent) => {
      setDropActive(false);
      if((e.target as HTMLElement)?.closest(".home-dashboard,.customise-backdrop,.studio-workspace"))return;
      if(extraDialog||storageOpen)return;
      if(e.dataTransfer && acceptsExternalDrop(e.dataTransfer) && !resourcesView && !boardView && !videoView && !linksOnly){
        e.preventDefault();
        queueImageDrop(e.dataTransfer,category,project!==null?{project,folder:typeof projectFolder==='number'?projectFolder:null}:undefined);
        return;
      }
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) {
        e.preventDefault();
        setReadingCapture(true);
        stageFiles(files,setImportProgress)
          .then(draft=>setCapture(boardView==="websites"?{...draft,files:[],thumbnail:draft.files[0],destination:"websites"}:draft))
          .catch(report)
          .finally(() => {setReadingCapture(false);setImportProgress(null);});
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
  }, [studioView,pasteCapture, report, capture, duplicatesOpen, removedOpen, modal, resourcesView, linkDestination, videoView, videoDialog,quickPreview,libraryExportOpen,extraDialog,queueImageDrop,category,project,projectFolder,boardView,linksOnly,storageOpen]);
  const captured = async (result: CaptureResult) => {
    recordCapture(result);
    if(project===null&&category!==null && (capture?.files.length || isComponent(category) || category===allComponents) && result.ids.length) await mutate({action:"set_category",ids:result.ids,value:filingCategory(category)});
    if(project!==null&&typeof projectFolder==='number'&&result.ids.length)await mutate({action:'add_project_folder',target:projectFolder,ids:result.ids});
    const next=await refresh();
    if (capture)
      await invoke("discard_capture", {
        paths: capture.files.map((f) => f.path),
      }).catch(report);
    setCapture(null);
    if (result.destination && project===null) {
      navigate(null, result.destination === "links");
      setResourcesView(result.destination === "resources");
      if (result.destination && isBoardDestination(result.destination)) setBoardView(result.destination);
      if (result.destination === "resources") setResourceVersion(version => version + 1);
    }
    showCaptureReceipt(result,next,result.destination?null:category,project!==null?{project,folder:typeof projectFolder==='number'?projectFolder:null}:undefined);
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
            title: "Choose library.json inside your backup folder",
            filters: [{ name: "Design backup", extensions: ["json"] }],
          })
        : await save({
            defaultPath: "design-backup.json",
            filters: [{ name: "Design backup", extensions: ["json"] }],
          });
      if (typeof path === "string") {
        await invoke("backup", { path, restore });
        if (restore) {
          appHistory.clearLibrary();await refresh();setStorageOpen(false);
          const preferences=await invoke<Record<string,unknown>>('backup_preferences',{path:path.replace(/[\\/][^\\/]+$/,'').replace(/[\\/]Library Data$/,'')});
          if(preferences&&Object.keys(preferences).length){applyBackupPreferences(preferences);localStorage.removeItem('last-workspace-view');window.location.reload();return;}
        }
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
  const linkTable = (items: Item[]) => <LinksTable onFolders={id=>setFolderMembers([id])} onRate={(id,value)=>void perform({action:'rate_links',ids:[id],value:value===null?'':String(value)})} showCategories={linksOnly||items.some(item=>!isCollectionLink(item))} items={items} selected={selected} select={select} openItem={openItem}
    onEdit={id=>setModal({kind:"editLink",id})} onProjects={id=>setModal({kind:"projects",ids:[id]})}
    onTags={id=>setModal({kind:"tags",ids:[id]})} onDelete={id=>void removeItems([id])} project={project}
    onPin={item=>project&&void perform({action:item.favourites?.includes(project)?"unpin_project":"pin_project",target:project,ids:[item.id]})}/>;
  const itemDrag=useItemDragFeedback({
    enabled:!thumbnailEnlarged&&(viewer===null||widePreview)&&quickPreview===null&&!modal&&!capture&&!videoDialog&&!duplicatesOpen&&!removedOpen&&!itemMenu&&!libraryExportOpen,
    ids:id=>selected.has(id)?[...selected]:[id],
    category:(ids,name)=>void changeCategory(ids,name).catch(report),
    project:(ids,target)=>void mutate({action:"add_project",ids,target}).then(()=>{setUndoIds([]);setNotice("Added to project");}).catch(report),
    projectFolder:(ids,target)=>void mutate({action:'add_project_folder',ids,target}).then(()=>{setUndoIds([]);setNotice('Added to folder');}).catch(report),
    unfileProject:(ids,target)=>void mutate({action:'unfile_project_folder',ids,target}).then(()=>{setUndoIds([]);setNotice('Moved to Unfiled');}).catch(report),
    started:()=>setHoverId(null),
  });
  const libraryDialog = modal && modal.kind !== "thumbnail" && modal.kind !== "category" && (
        <Dialog
          modal={modal}
          projectFolder={projectFolder}
          lib={lib}
          close={() => setModal(null)}
          mutate={mutate}
          busy={busy}
          setBusy={setBusy}
          report={report}
          project={project}
          chooseRoot={chooseRoot}
          exportLibrary={()=>{setModal(null);setLibraryMigration(false);setLibraryExportOpen(true);}}
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
      );
  const viewToolbar=(<div className="toolbar">
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
                <option value="link">Links</option>{project!==null&&<option value="file">Files</option>}
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
              {project===null && !boardView && !videoView && <select
                aria-label="Filter by category"
                value={category??"__all__"}
                onChange={(e) => setCategory(e.target.value==="__all__"?null:e.target.value)}
              >
                <option value="__all__">All Designs</option><option value="">Uncategorised</option>
                {[...categories, allComponents, ...componentFolders].map((s) => (
                  <option value={s} key={s}>
                    {categoryLabel(s)}
                  </option>
                ))}
              </select>}
              {(linksOnly||project!==null)&&<select aria-label="Filter by rating" value={ratingFilter} onChange={e=>setRatingFilter(e.target.value)}><option value="">All ratings</option><option value="unrated">Unrated</option><option value="4+">4 stars & up</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} stars</option>)}</select>}
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
                <option value="shuffle">Shuffle</option>{(linksOnly||project!==null)&&<><option value="rating-high">Highest rating</option><option value="rating-low">Lowest rating</option></>}
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
          </div>);
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
        onClickCapture={e=>{if((e.target as HTMLElement).closest('.nav-item,.brand,[aria-label=Settings]')){const stamp=performance.now();navigationStart.current=stamp;setTimeout(()=>{if(navigationStart.current===stamp)navigationStart.current=null;},0);}if(modal?.kind==='settings'&&(e.target as HTMLElement).closest('.nav-item,.brand'))setModal(null);}}
        inert={thumbnailEnlarged || !!customTab || quickPreview !== null || (viewer !== null && !widePreview) || (!!modal&&modal.kind!=='settings') || !!capture || !!videoDialog || duplicatesOpen || removedOpen || libraryExportOpen || storageOpen}
      >
        <button className="brand" aria-label="Go to Home" onClick={()=>{navigate(null);setHomeView(true);}} onDragEnter={e=>{if(e.dataTransfer.types.includes(homeMime))setHomeView(true);}}>
          <img src={branding.logo || appLogo} alt="" className="brand-logo" style={{width:branding.size,height:branding.size,maxWidth:"45%"}} />
          <span className="brand-name"><span>{branding.name}</span><span>{branding.slogan}</span></span>
        </button>
        <SidebarNavigation order={navLayout.order}>
        <SidebarSection name="Marketing" action={<IconButton title="Add campaign" onClick={()=>startSectionAdd('marketing')}><Plus size={14}/></IconButton>} identity="marketing" styleId={sectionStyle} onOpen={()=>openStudio({section:'marketing',page:'campaigns'})} icon={icons.overrides['section:Marketing']&&<AppIcon value={icons.overrides['section:Marketing']}/>}><nav>{['campaigns','ideas','calendar'].map(page=><button key={page} className={`nav-item ${studioView?.section==='marketing'&&studioView.page===page?'active':''}`} aria-current={studioView?.section==='marketing'&&studioView.page===page?'page':undefined} onClick={()=>openStudio({section:'marketing',page})}>{page[0].toUpperCase()+page.slice(1)}</button>)}</nav></SidebarSection>
        <SidebarSection name="Leads" action={<IconButton title="Add lead" onClick={()=>startSectionAdd('leads')}><Plus size={14}/></IconButton>} identity="leads" styleId={sectionStyle} onOpen={()=>openStudio({section:'leads',page:'pipeline'})} icon={icons.overrides['section:Leads']&&<AppIcon value={icons.overrides['section:Leads']}/>}><nav>{['pipeline','follow-ups','contacts'].map(page=><button key={page} className={`nav-item ${studioView?.section==='leads'&&studioView.page===page?'active':''}`} aria-current={studioView?.section==='leads'&&studioView.page===page?'page':undefined} onClick={()=>openStudio({section:'leads',page})}>{page[0].toUpperCase()+page.slice(1)}</button>)}</nav></SidebarSection>
        <SidebarSection name="Clients" identity="clients" styleId={sectionStyle} icon={icons.overrides['section:Clients']&&<AppIcon value={icons.overrides['section:Clients']}/>} onOpen={()=>openStudio({section:'clients',page:'today'})} action={<IconButton title="Add client" onClick={()=>startSectionAdd('clients')}><Plus size={14}/></IconButton>}><nav><button className={`nav-item ${studioView?.section==='clients'&&!studioView.id?'active':''}`} onClick={()=>openStudio({section:'clients',page:'today'})}>Dashboard</button>{(lib.studio??[]).filter(e=>e.kind==='client'&&!e.archived).map(e=><button className={`nav-item ${studioView?.id===e.id?'active':''}`} key={e.id} onClick={()=>openStudio({section:'clients',page:'today',id:e.id,tab:'feed'})}>{e.name}</button>)}</nav></SidebarSection>
        <SidebarSection name="General" identity="general" styleId={sectionStyle} icon={icons.overrides["section:General"]&&<AppIcon value={icons.overrides["section:General"]}/>} dropProps={homeDrag("group:general")} action={<IconButton title="Add General entry" onClick={()=>setCustomTab("general")}><Plus size={14}/></IconButton>}>
        <nav aria-label="Library">
          {ordered(collectionPrefs).filter(s=>!s.hidden).map(entry=>{
            const {key,name,pinned}=entry,target=entry.target??{kind:'view',value:key},view=target.kind==='view'?target.value:'',board=isBoardDestination(view);
            const count=target.kind==='project'?lib.projects.find(p=>String(p.id)===target.value)?.count:target.kind==='category'?categoryCounts.get(target.value):view==='links'?generalCounts.get('__links')??0:board?generalCounts.get(boardNames[view])??0:view==='facebook'?generalCounts.get('__videos')??0:0;
            const folder=target.kind==='category'?(target.value==='__all__'?'':target.value===allComponents?componentInbox:target.value):undefined;
            const projectProps=target.kind==='project'?{'data-project-id':Number(target.value),'data-project-name':name,onDragOver:(e:React.DragEvent)=>{if(e.dataTransfer.types.includes('application/design-items')){e.preventDefault();e.currentTarget.classList.add('drop-target');}},onDragLeave:(e:React.DragEvent)=>e.currentTarget.classList.remove('drop-target'),onDrop:(e:React.DragEvent)=>drop(e,Number(target.value))}:{};
            return <button className={`nav-item general-nav ${!homeView&&generalKey===key?'active':''}`} key={key} {...homeDrag(`collection:${key}`)} {...projectProps} {...(folder!==undefined?{'data-category':folder,...categoryDropProps(folder)}:{})} onClick={()=>openGeneral(entry)} title={name}><GeneralEntryIcon entry={entry} preferences={icons}/><span>{name}</span>{pinned&&<Pin size={11}/>}<small>{count||''}</small></button>;
          })}
        </nav>
        </SidebarSection>
        <SidebarSection name="Projects" identity="projects" styleId={sectionStyle} icon={icons.overrides["section:Projects"]&&<AppIcon value={icons.overrides["section:Projects"]}/>} dropProps={homeDrag("group:projects")} action={
          <IconButton
            title="New project"
            onClick={() => setModal({ kind: "project" })}
          >
            <Plus size={15} />
          </IconButton>}>
        <div className="projects">
          <nav aria-label="Projects">
            {lib.projects.map(p=><ProjectTree key={p.id} project={p} folders={lib.project_folders??[]} items={lib.items}
              active={!homeView&&!generalKey&&project===p.id} overviewActive={projectSection==='overview'} scope={projectSection==='files'?projectFolder:null} open={scope=>{navigate(p.id);setProjectFolder(scope);setProjectSection(scope===null?"overview":"files");}}
              icon={<FolderIcon preferences={icons} id={`project:${p.id}`}/>} mutate={mutate} report={report}
              paste={folder=>void pasteCapture({category:null,project:p.id,folder})} rename={()=>setModal({kind:'renameProject',id:p.id})} remove={()=>setModal({kind:'deleteProject',id:p.id})}
              homeProps={homeDrag(`project:${p.id}`)} externalDrop={(data,folder)=>queueImageDrop(data,null,{project:p.id,folder})}/>)}
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
            className={`nav-item ${!studioView&&!homeView&&!generalKey&&category===null&&!source&&!recent&&!project&&!boardView&&!linksOnly&&!resourcesView ? "source-active" : ""}`}
            {...homeDrag("design")}
            onClick={() => navigate(null)}
          >
            <FolderIcon preferences={icons} id="design:all" size={14}/>
            <span>
              All Designs
            </span>
          </button>
          {designRows.map(folderRow)}
        </nav>
        </SidebarSection>
        <SidebarSection name="Components" action={<IconButton title="New component folder" onClick={()=>setModal({kind:"category",ids:[],componentFolder:true})}><Plus size={14}/></IconButton>} label="App Components" identity="components" icon={icons.overrides.components&&<AppIcon value={icons.overrides.components} size={17}/>} styleId={sectionStyle} dropProps={{...homeDrag(`category:${allComponents}`),...categoryDropProps(componentInbox),"data-category":componentInbox,"data-section-label":"App Components",className:categoryDrop===componentInbox?"drop-target":""}}>
          <nav aria-label="App Components">
            {folderRow(allComponents)}
            {componentRows.map(folderRow)}
          </nav>
        </SidebarSection>
        <SidebarSection name="Research" action={<IconButton title="Add research" onClick={()=>startSectionAdd('research')}><Plus size={14}/></IconButton>} identity="research" styleId={sectionStyle} onOpen={()=>openStudio({section:'research',page:'all'})} icon={icons.overrides['section:Research']&&<AppIcon value={icons.overrides['section:Research']}/>}><nav>{researchPages.map(([page,label])=><button key={page} className={`nav-item ${studioView?.section==='research'&&studioView.page===page?'active':''}`} aria-current={studioView?.section==='research'&&studioView.page===page?'page':undefined} onClick={()=>openStudio({section:'research',page})}>{label}</button>)}</nav></SidebarSection>
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
      <main inert={thumbnailEnlarged || !!customTab || quickPreview !== null || (viewer !== null && !widePreview) || (!!modal&&modal.kind!=='settings') || !!capture || !!videoDialog || duplicatesOpen || removedOpen || libraryExportOpen || storageOpen}>
        {modal?.kind==='settings'?libraryDialog:<>{studioView?.section==='clients'?<ClientsWorkspace initialise={initialiseClients} lib={lib} route={studioView} navigate={setStudioView} mutate={mutate} importInto={importStudio} preview={item=>item.kind==='link'?void openUrl(item.path).catch(report):setQuickPreview(item.id)} openProject={id=>navigate(id)}/>:studioView?.section==='research'?<ResearchWorkspace lib={lib} route={studioView} navigate={setStudioView} mutate={mutate} importInto={importStudio} preview={item=>{if(item.kind==='link')void openUrl(item.path).catch(report);else {setReceiptBrowse((lib.studio??[]).find(e=>e.id===studioView.id)?.files??[item.id]);setQuickPreview(item.id);}}} openProject={id=>navigate(id)}/>:studioView?<StudioWorkspace lib={lib} route={studioView} navigate={setStudioView} mutate={mutate} importInto={importStudio} preview={item=>{if(item.kind==='link')void openUrl(item.path).catch(report);else{setReceiptBrowse((lib.studio??[]).find(e=>e.id===studioView.id)?.files??[item.id]);setQuickPreview(item.id);}}} openProject={id=>navigate(id)}/>:homeView?<><HomeDashboard headerActions={<ColourPicker projects={lib.projects}/>} icons={icons} style={homeStyle} appearance={homeAppearance} customize={()=>setCustomTab("home")} destinations={homeDestinations} open={openHomeDestination} incoming={homeDrop} received={()=>setHomeDrop(null)} dragging={!!homeShortcutDrag.ghost}/></>:<>
        <header className="topbar">
          <div className="view-title">
            <h1>{title}</h1>
            <span>
              {project!==null&&!generalEntry&&projectSection!=="files"?"":project!==null&&!generalEntry&&projectFolder===null&&!activeFilters?sheetItems.length.toLocaleString():boardView ? boardItems.length : resourcesView
                ? filtered.filter(isResource).length
                : filtered.length.toLocaleString()}
            </span>
            {lib.scanning && (
              <LoaderCircle className="spin" size={13} aria-label="Scanning" />
            )}
          </div>
          <div className="header-actions">
            <ThumbnailProgress />
            <ColourPicker projects={lib.projects}/>
            {project!==null&&projectSection==="files"&&<button className="subtle-button" onClick={()=>setExtraDialog("sheet")}><Grid2X2 size={14}/>Contact sheet</button>}
            <button className="icon-button" aria-label="Undo organisation change" disabled={!historyActions.undoLabel||undoing} title={historyActions.undoLabel?`Undo: ${historyActions.undoLabel} (Ctrl+Z)`:"Nothing to undo"} onClick={()=>void undoLast()}><Undo2 size={16}/></button>
            <button className="icon-button" aria-label="Redo organisation change" disabled={!historyActions.redoLabel||undoing} title={historyActions.redoLabel?`Redo: ${historyActions.redoLabel} (Ctrl+Shift+Z / Ctrl+Y)`:"Nothing to redo"} onClick={()=>void redoLast()}><Redo2 size={16}/></button>
            <StorageBar revision={lib} onOpen={()=>setStorageOpen(true)}/>
            {search&&!searchOpen&&<button className="subtle-button search-active" title="Clear search" onClick={()=>setSearch("")}>“{search}” <X size={12}/></button>}
            <label className="search search-popup" hidden={!searchOpen}>
              <Search size={15} />
              <input
                ref={searchRef}
                placeholder="Search"
                aria-label="Search library"
                onKeyDown={e=>{if(e.key==="Escape"||e.key==="Enter"){e.preventDefault();e.stopPropagation();setSearchOpen(false);searchRef.current?.blur();}}}
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
            {(project===null||!!generalEntry||projectSection==="files")&&<Popover label="Add" icon={<Plus size={14} />}>
              <button onClick={() => void chooseCaptureFiles()}>
                <Files size={14} /> Files
              </button>
              <button onClick={() => void pasteCapture()}>
                <ClipboardPaste size={14} /> Paste
              </button>
              <button onClick={() => videoView ? setVideoDialog({url:""}) : setCapture({ files: [], url: "", destination: linkDestination })}>
                <Link2 size={14} /> Link
              </button>
            </Popover>}
          </div>
        </header>
        {!originalResources&&(project===null||!!generalEntry)&&viewToolbar}

        {project!==null&&<ProjectColours key={project} project={project}/>}
        {(readingCapture||pendingImports>0) && (
          <div className="capture-reading">
            <CaptureProgress progress={importProgress} queued={Math.max(0,pendingImports-1)}/>
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
          {project!==null&&!generalEntry&&!generalMissing&&lib.projects.some(p=>p.id===project)?<ProjectWorkspace relatedStudio={<div className="studio-project-links">{(lib.studio??[]).filter(e=>["lead","campaign","client"].includes(e.kind)&&e.projects.includes(project)).map(e=><button key={e.id} onClick={()=>openStudio({section:e.kind==="client"?"clients":e.kind==="lead"?"leads":"marketing",page:e.kind==="client"?"today":e.kind==="lead"?"pipeline":"campaigns",id:e.id})}>{e.kind==="client"?"Client":e.kind==="lead"?"Lead":"Campaign"}: {e.name} <ArrowRight size={13}/></button>)}</div>} fileToolbar={viewToolbar} section={projectSection} changeSection={setProjectSection} clients={lib.client_records} overview={lib.project_overviews?.find(o=>o.project_id===project)} key={project} project={lib.projects.find(p=>p.id===project)!} folders={lib.project_folders??[]} items={filtered} allItems={sheetItems} scope={projectFolder} navigate={scope=>{setProjectSection("files");setProjectFolder(scope);setSelected(new Set());}} mutate={mutate} report={report} addFiles={()=>void chooseCaptureFiles()} paste={folder=>void pasteCapture({category:null,project,folder})} drop={(data,folder)=>queueImageDrop(data,null,{project,folder})} selected={selected} select={(item,event)=>{if(event.ctrlKey||event.metaKey||event.shiftKey)select(item.id,event.shiftKey);else setSelected(new Set([item.id]));}} menu={(item,event)=>setItemMenu({ids:selected.has(item.id)?[...selected]:[item.id],x:event.clientX,y:event.clientY})} preview={item=>item.kind==='link'?void openUrl(item.path).catch(report):setQuickPreview(item.id)} size={size} order={sort} search={search||(activeFilters?'filters':'')} scroller={scrollRef}/>:generalMissing?<div className="empty-state"><span>This collection is unavailable</span><button onClick={()=>setCustomTab('general')}>Choose another destination</button></div>:generalEntry?.layout&&generalEntry.layout!=='auto'?<CollectionView items={filtered} layout={generalEntry.layout} size={size} selected={selected} select={select} open={openItem} menu={(id,event)=>{const rect=event.currentTarget.getBoundingClientRect();setItemMenu({ids:[id],x:rect.left,y:rect.bottom});}} add={()=>videoView?setVideoDialog({url:''}):generalEntry.content==='link'||boardView||resourcesView||linksOnly?setCapture({files:[],url:'',destination:linkDestination}):void chooseCaptureFiles()}/>:recent?<RecentReferences key={recent} items={filtered} added={recent==="added"} open={openItem}/>:tableBoard ? <div className={`collection-table ${boardView}-table`}>
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
                  removeFolder={project!==null&&typeof projectFolder==='number'?(lib.project_folders??[]).find(f=>f.id===projectFolder)?.name:category&&category!==allComponents&&category!==componentInbox?categoryLabel(category).replace(/^Components \/ /,""):undefined}
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
                  stopHoverRef={stopHoverRef}
                />
              )}
              {filtered.some(i=>isBoardLink(i)&&!isTableLink(i)&&!componentFoldersOf(i).length) && <LinkBoard selected={selected} openItem={openItem} items={filtered.filter(i=>isBoardLink(i)&&!isTableLink(i)&&!componentFoldersOf(i).length)} size={size} report={report} menu={(id,event)=>{const rect=event.currentTarget.getBoundingClientRect();setItemMenu({ids:[id],x:rect.left,y:rect.bottom});}} />}
              {links.length > 0 && (
                linkTable(links)
              )}
            </>
          )}
        </div>
        </>}
      </>}
      </main>
      <ThumbnailEnlargement items={enlargementItems} reducedMotion={reducedMotion} onActiveChange={setThumbnailEnlarged}
        enabled={!homeView&&!customTab&&(viewer===null||widePreview)&&quickPreview===null&&!modal&&!capture&&!videoDialog&&!duplicatesOpen&&!removedOpen&&!itemMenu&&!folderMenu&&!libraryExportOpen&&!extraDialog}/>
      {quickPreview!==null&&lib.items.find(i=>i.id===quickPreview)&&(lib.items.find(i=>i.id===quickPreview)!.kind==="file"?<ProjectFilePreview item={lib.items.find(i=>i.id===quickPreview)!} close={()=>setQuickPreview(null)}/>:<QuickPreview item={lib.items.find(i=>i.id===quickPreview)!} close={()=>setQuickPreview(null)}/>)}
      {activeItem && (
        <div className={dockedPreview ? "preview-shell preview-shell-docked" : "preview-shell"}>
        <Viewer
          key={activeItem.id}
          docked={dockedPreview}
          blocked={thumbnailEnlarged || quickPreview !== null || (!!modal&&modal.kind!=='settings') || !!capture || !!videoDialog || duplicatesOpen || removedOpen || libraryExportOpen || storageOpen}
          item={activeItem}
          items={previewItems}
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
      {modal?.kind==="category"&&<CategoryPicker creatingComponents={modal.componentFolder} categories={modal.ids?.length ? [...categories,...componentFolders] : modal.componentFolder?componentFolders:categories} componentItems={lib.items.filter(i=>modal.ids?.includes(i.id)&&i.kind!=="link")} toggleComponent={async(name,remove)=>{
        const ids=modal.ids?.filter(id=>lib.items.some(i=>i.id===id&&i.kind!=="link"))??[];
        await mutate({action:remove?(isComponent(name)?"remove_component_folder":"remove_design_folder"):"set_category",ids,value:name});
        setCategoryUndo(null);setUndoIds([]);setNotice(remove?"Removed from folder":"Added to folder");
      }} count={modal.ids?.filter(id=>lib.items.some(i=>i.id===id&&i.kind!=="link")).length||0} close={()=>setModal(null)} choose={async name=>{if(modal.componentFolder)name=`Components / ${name}`;if(modal.ids?.length)await changeCategory(modal.ids,name);else{await mutate({action:"create_category",name});setUndoIds([]);setCategoryUndo(null);setNotice(`Created ${name}`);}setModal(null);}}/>}
      {folderMembers&&<OrganiseProjectFolders folders={lib.project_folders??[]} projects={lib.projects} items={lib.items.filter(i=>folderMembers.includes(i.id))} mutate={mutate} close={()=>setFolderMembers(null)}/>}
      {modal?.kind!=='settings'&&libraryDialog}
      {queueOpen && !videoDialog && !capture && !modal && viewer===null && !duplicatesOpen && !removedOpen && <VideoDownloadQueue queue={videoQueue} project={project} close={()=>setQueueOpen(false)}/>}
      {videoDialog && <VideoDownloadDialog initialUrl={videoDialog.url} lib={lib} project={project} close={()=>setVideoDialog(null)} add={(text,projects,tags)=>{
        const result=videoQueue.add(text,projects,tags);setVideoDialog(null);setQueueOpen(true);setNotice(result.added?`${result.added} queued`:"Already queued");
      }}/>}

      {extraDialog==="sheet"&&<ContactSheet title={title} items={sheetItems} initial={selected} close={()=>setExtraDialog(null)}/>}
      {storageOpen&&<StoragePanel lib={lib} close={()=>setStorageOpen(false)} backup={()=>{setStorageOpen(false);setLibraryMigration(false);setLibraryExportOpen(true);}} migrate={()=>{setStorageOpen(false);setLibraryMigration(true);setLibraryExportOpen(true);}} restore={()=>void backup(true)}/>}
      {libraryExportOpen && <LibraryExport migration={libraryMigration} close={()=>setLibraryExportOpen(false)}/>}
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
      {folderMenu&&<FolderRename key={folderMenu.name} target={folderMenu} canRename={!!folderMenu.name&&folderMenu.name!==allComponents&&folderMenu.name!==componentInbox} paste={()=>void pasteCapture({category:folderMenu.name,project:null,folder:null})} close={()=>setFolderMenu(null)} appearance={isComponent(folderMenu.name)?{...folderAppearance[folderMenu.name],icon:icons.overrides[`category:${folderMenu.name}`],setColor:color=>setFolderAppearance(previous=>({...previous,[folderMenu.name]:{...previous[folderMenu.name],color}})),toggleStar:()=>setFolderAppearance(previous=>({...previous,[folderMenu.name]:{...previous[folderMenu.name],starred:!previous[folderMenu.name]?.starred}})),setIcon:icon=>setIcons(previous=>{const overrides={...previous.overrides};if(icon)overrides[`category:${folderMenu.name}`]=icon;else delete overrides[`category:${folderMenu.name}`];return {...previous,overrides};})}:undefined} save={name=>{const list=isComponent(folderMenu.name)?componentFolders:categories;if(list.some(key=>key!==folderMenu.name&&categoryLabel(key).replace(/^Components \/ /,'').toLocaleLowerCase()===name.toLocaleLowerCase()))throw Error('A folder with that name already exists.');setFolderLabels({...folderLabels,[folderMenu.name]:name});}}/>}
      {customTab&&<Customization initial={customTab} close={()=>setCustomTab(null)} sectionStyle={sectionStyle} chooseSection={setSectionStyle} sidebarLayout={sidebarLayout} chooseLayout={setSidebarLayout} icons={icons} changeIcons={setIcons} iconTargets={iconTargets} generalOptions={generalOptions} saveGeneral={saveGeneral} homeStyle={homeStyle} chooseHome={setHomeStyle} sidebarWidth={sidebarWidth} setSidebarWidth={setSidebarWidth} tileSize={size} setTileSize={setSize} collections={collectionPrefs} setCollections={setCollectionPrefs} sites={sitePrefs} setSites={setSitePrefs} reduced={reducedMotion} setReduced={setReducedMotion} home={homeAppearance} changeHome={setHomeAppearance} manageLibrary={()=>{setCustomTab(null);setModal({kind:'settings'});}}/>}
      {itemMenu && <ItemMenu target={itemMenu} lib={lib} close={closeItemMenu} report={report}
        organisationActions={<>
          <button role="menuitem" onClick={()=>{setFolderMembers(itemMenu.ids);closeItemMenu();}}><FolderPlus size={13}/>Project folders</button>
          {project!==null&&typeof projectFolder==='number'&&<button role="menuitem" onClick={()=>{void perform({action:'remove_project_folder',target:projectFolder,ids:itemMenu.ids});closeItemMenu();}}>Remove from folder</button>}
          {project!==null&&<><button role="menuitem" onClick={()=>{void perform({action:'pin_project',target:project,ids:itemMenu.ids});closeItemMenu();}}><Pin size={13}/>Pin in project</button><button role="menuitem" onClick={()=>{void perform({action:'remove_project',target:project,ids:itemMenu.ids}).then(()=>setSelected(new Set()));closeItemMenu();}}>Remove from project</button></>}
          {itemMenu.ids.some(id=>lib.items.some(i=>i.id===id&&i.kind==='link'))&&<><div className="context-section">Rate links</div><LinkRating onChange={value=>{void perform({action:'rate_links',ids:itemMenu.ids,value:value===null?'':String(value)});closeItemMenu();}}/><button role="menuitem" onClick={()=>{void perform({action:'rate_links',ids:itemMenu.ids,value:''});closeItemMenu();}}>Clear rating</button></>}
          <button role="menuitem" onClick={()=>{setSelected(new Set(filtered.map(i=>i.id)));closeItemMenu();}}>Select all</button>
          {selected.size>0&&<button role="menuitem" onClick={()=>{setSelected(new Set());closeItemMenu();}}>Clear selection</button>}
        </>}
        category={()=>setModal({kind:"category",ids:itemMenu.ids})}
        sendToSection={(ids,components)=>void changeCategory(ids,components?componentInbox:"").catch(report)}
        copy={(id) => void copyImage(id)} copying={copying !== null}
        editLink={(item) => setModal({ kind: "editLink", id: item.id })}
        editThumbnail={(item) => setModal({ kind: "thumbnail", id: item.id })}
        moveLink={(item) => void mutate({ action: "set_link_destination", target: item.id, value: isResource(item) ? "links" : "resources" }).then(() => { setUndoIds([]); setNotice(`Moved to ${isResource(item) ? "Links" : "Resources"}`); }).catch(report)}
        add={(target) => { void mutate({ action: "add_project", target, ids: itemMenu.ids }).then(() => { setUndoIds([]); setNotice(`Added to ${lib.projects.find((p) => p.id === target)?.name}`); }).catch(report); }}
        tags={() => setModal({ kind: "tags", ids: itemMenu.ids })}
        reveal={item => item.kind === "link" ? void openUrl(item.path).then(()=>track(item)).catch(report) : void revealItemInDir(item.path).catch(report)}
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
  stopHoverRef,
}: {
  removeFolder?: string;
  onRemoveFolder: (item:Item)=>Promise<void>;
  masonry: boolean;
  previewId: number | null;
  copy: (id: number) => Promise<void>;
  copying: number | null;
  returnTo: { id: number; offset?: number } | null;
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
  stopHoverRef:React.RefObject<()=>void>;
}) {
  const [hoverId,setHoverId]=useState<number|null>(null);
  useLayoutEffect(()=>{stopHoverRef.current=()=>setHoverId(null);return()=>{stopHoverRef.current=()=>{};};},[stopHoverRef]);
  const itemsById=useMemo(()=>new Map(items.map(item=>[item.id,item])),[items]);
  const latest=useRef({copy,onRemoveFolder,onPin,select,openItem,onMenu,selected,itemsById});latest.current={copy,onRemoveFolder,onPin,select,openItem,onMenu,selected,itemsById};
  const handlers=useRef(new Map<number,{copy:()=>void;remove:()=>Promise<void>;pin:()=>void;select:(range:boolean)=>void;open:(e:React.MouseEvent)=>void;menu:()=>void;hover:(value:boolean)=>void;drag:(e:React.DragEvent)=>void}>());
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [viewport, setViewport] = useState({ top: 0, height: 1000 });
  const [revision, setRevision] = useState(0);
  const [highlighted, setHighlighted] = useState<typeof returnTo>(null);
  const ratioFrame = useRef(0);
  const interruptedReturn = useRef<typeof returnTo>(null);
  useThumbnailReadiness(items,ref,parent);
  useEffect(()=>{for(const id of handlers.current.keys())if(!itemsById.has(id))handlers.current.delete(id);},[itemsById]);
  useLayoutEffect(() => {
    // On Home -> library, the child layout effect precedes the parent ref attachment.
    // The DOM ancestor is already present, so always attach the size observer.
    const grid = ref.current, scroller = parent.current ?? grid?.closest<HTMLDivElement>(".content");
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
  const layout = useMemo(() => {const start=performance.now();const next=arrangeMasonry(items.map(item => thumbnailRatios.get(`${item.id}:${item.modified}`) ?? 1 / 1.4), width, size);const duration=performance.now()-start;if(duration>8)recordDiagnostic('layout.masonry','warning',duration,{items:items.length,width});return next;}, [items, width, size, revision]);
  const visible = layout.tiles.filter(tile => tile.top + tile.height >= viewport.top - viewport.height && tile.top <= viewport.top + viewport.height * 2);
  useLayoutEffect(() => {
    if (!returnTo) return;
    interruptedReturn.current = null;
    const scroller = parent.current ?? ref.current?.closest<HTMLDivElement>(".content");
    if (!scroller) return;
    // Restoring a position is temporary. A slow/failed thumbnail must never
    // pin the viewport against user input or pull it back after they move on.
    const cancel = () => { interruptedReturn.current = returnTo; onReturned(); };
    const key = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", "Escape", " "].includes(event.key)) cancel();
    };
    scroller.addEventListener("wheel", cancel, { passive: true, capture: true });
    scroller.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("pointerdown", cancel, true);
    window.addEventListener("keydown", key, true);
    const timeout = window.setTimeout(cancel, 3000);
    return () => {
      clearTimeout(timeout);
      scroller.removeEventListener("wheel", cancel, true); scroller.removeEventListener("touchstart", cancel);
      window.removeEventListener("pointerdown", cancel, true); window.removeEventListener("keydown", key, true);
    };
  }, [returnTo, parent, onReturned]);
  useLayoutEffect(() => {
    if (!returnTo || interruptedReturn.current === returnTo) return;
    const index = items.findIndex(item => item.id === returnTo.id);
    if (index < 0) { onReturned(); return; }
    const tile = layout.tiles[index], scroller = parent.current, grid = ref.current;
    if (!scroller || !grid) return;
    const offset = grid.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTop = Math.max(0, offset + tile.top - (returnTo.offset ?? Math.max(0, (scroller.clientHeight - tile.height) / 2)));
    setViewport({ top: scroller.scrollTop - offset, height: scroller.clientHeight });
    const button = grid.querySelector<HTMLButtonElement>(`[data-item-id="${returnTo.id}"] .card-open`);
    const image = button?.querySelector('img');
    if (button && (returnTo.offset === undefined ? (!image || image.complete) : (image?.complete && image.naturalWidth > 0) || !!button.querySelector(".file-fallback"))) {
      // Neighbouring thumbnails can still change the rows above this anchor.
      // Finish only after the rendered images and layout have settled.
      const pending=[...grid.querySelectorAll<HTMLImageElement>('img:not(.hover-preview)')].some(img=>!img.complete);
      if(pending)return;
      const timer=window.setTimeout(()=>{button.focus({preventScroll:true});if(returnTo.offset===undefined)setHighlighted(returnTo);onReturned();},160);
      return()=>clearTimeout(timer);
    }
  }, [returnTo, items, layout, parent, onReturned, viewport.top]);
  useEffect(() => {
    if (!highlighted) return;
    const timer = window.setTimeout(() => setHighlighted(null), 2000);
    return () => window.clearTimeout(timer);
  }, [highlighted]);
  return <div ref={ref} className="media-grid poster-masonry" style={{ height: layout.height }}
    onErrorCapture={() => { if(returnTo&&!ratioFrame.current)ratioFrame.current=requestAnimationFrame(()=>{ratioFrame.current=0;setRevision(value=>value+1);}); }}
    onLoadCapture={event => {
      const image = event.target as HTMLImageElement;
      if (image.tagName !== 'IMG' || image.classList.contains('hover-preview') || !image.naturalWidth || !image.naturalHeight) return;
      const key = image.closest<HTMLElement>('[data-media-key]')?.dataset.mediaKey;
      const ratio = image.naturalWidth / image.naturalHeight;
      if (!key || (thumbnailRatios.get(key) === ratio && !returnTo)) return;
      if (thumbnailRatios.size > 10000) thumbnailRatios.clear();
      thumbnailRatios.set(key, ratio);
      if (!ratioFrame.current) ratioFrame.current = requestAnimationFrame(() => { ratioFrame.current = 0; setRevision(value => value + 1); });
    }}>
    {visible.map(row => {
      const item = items[row.index];
      if(!handlers.current.has(item.id)){const id=item.id;handlers.current.set(id,{
        copy:()=>void latest.current.copy(id),remove:()=>latest.current.onRemoveFolder(latest.current.itemsById.get(id)!),pin:()=>latest.current.onPin(latest.current.itemsById.get(id)!),select:range=>latest.current.select(id,range),open:e=>latest.current.openItem(latest.current.itemsById.get(id)!,e),menu:()=>latest.current.onMenu(id),hover:value=>{const current=latest.current.itemsById.get(id);setHoverId(value&&(current?.kind==='video'||current?.kind==='animation')?id:null);},drag:e=>{const selection=latest.current.selected;e.dataTransfer.setData('application/design-items',JSON.stringify(selection.has(id)?[...selection]:[id]));e.dataTransfer.effectAllowed='copyMove';}
      });}
      const actions=handlers.current.get(item.id)!;
      return <div className="masonry-tile" key={`${item.id}:${item.modified}`} data-media-key={`${item.id}:${item.modified}`}
        style={{ transform: `translate(${row.left}px, ${row.top}px)`, width: row.width, height: row.height }}>
              <Card
                removeFolder={removeFolder}
                onRemoveFolder={actions.remove}
                copy={actions.copy}
                copying={copying !== null}
                previewed={previewId === item.id}
                returned={highlighted?.id === item.id}
                canPin={!!project}
                pinned={!!project && !!item.favourites?.includes(project)}
                pin={actions.pin}
                key={`${item.id}:${item.modified}`}
                item={item}
                selected={selected.has(item.id)}
                select={actions.select}
                open={actions.open}
                menu={actions.menu}
                playing={hoverId === item.id}
                hover={actions.hover}
                visibleNow={row.top+row.height>=viewport.top&&row.top<=viewport.top+viewport.height}
                drag={actions.drag}
              />
      </div>;
    })}
  </div>;
}
const Card=memo(function Card({
  visibleNow,
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
  visibleNow:boolean;
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
  const [thumb, setThumb] = useState(()=>cachedMedia(item,"thumbnail")??""),
    [preview, setPreview] = useState(""),
    [failed, setFailed] = useState(false),
    [motionError, setMotionError] = useState(false),
    [retry, setRetry] = useState(0);
  const motion = item.kind === "video" || item.kind === "animation";
  useEffect(() => {
    const abort = new AbortController();
    if(item.kind==="file"){setFailed(true);return;}
    setThumb(cachedMedia(item,"thumbnail")??"");
    setFailed(false);
    setPreview("");
    setMotionError(false);
    media(item, "thumbnail", abort.signal,visibleNow?0:1).then(
      (url) => {
        if (!abort.signal.aborted) setThumb(url);
      },
      () => {
        if (!abort.signal.aborted) setFailed(true);
      },
    );
    return () => abort.abort();
  }, [item.id, item.modified, item.path, item.thumbnail, retry]);
  useEffect(()=>{prioritizeThumbnail(item,visibleNow);},[item,visibleNow]);
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
        title="Space to preview · Ctrl + scroll to enlarge"
        aria-label={`${item.name} · Space to preview`}
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
        {playing && preview && !motionError && <HoverPreview key={`${item.id}:${preview}`} src={preview} animation={item.kind==='animation'} onError={()=>setMotionError(true)}/>}
      </button>
      <div className="card-shade" />
      {failed && item.kind!=="file" && !item.missing && <button className="thumbnail-retry" title="Try loading this thumbnail again" onClick={() => { forgetMedia(item, "thumbnail"); setRetry(value => value + 1); }}><RefreshCw size={12} /> Retry</button>}
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
});
function LinksTable({
  onRate,onFolders,
  showCategories,
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
  onRate:(id:number,value:number|null)=>void;
  onFolders:(id:number)=>void;
  showCategories:boolean;
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
  const table = useRef<HTMLTableElement>(null);
  const [scrollMargin,setScrollMargin]=useState(0);
  const virtual=items.length>80;
  const rows=useVirtualizer<HTMLDivElement,HTMLTableRowElement>({
    count:virtual?items.length:0,
    getScrollElement:()=>table.current?.closest<HTMLDivElement>('.content')??null,
    estimateSize:()=>35,
    getItemKey:index=>items[index].id,
    overscan:8,
    scrollMargin,
  });
  useLayoutEffect(()=>{
    const element=table.current,scroller=element?.closest<HTMLDivElement>('.content');
    if(!element||!scroller||!virtual)return;
    const measure=()=>setScrollMargin(element.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop+(element.tHead?.offsetHeight??0));
    const observer=new ResizeObserver(measure);observer.observe(scroller);observer.observe(element);
    if(element.previousElementSibling)observer.observe(element.previousElementSibling);
    measure();return()=>observer.disconnect();
  },[virtual,items]);
  const visibleRows=rows.getVirtualItems();
  const top=visibleRows.length?Math.max(0,visibleRows[0].start-scrollMargin):0;
  const bottom=visibleRows.length?Math.max(0,rows.getTotalSize()-(visibleRows.at(-1)!.end-scrollMargin)):0;
  const rendered=virtual?visibleRows.map(row=>({item:items[row.index],index:row.index})):items.map((item,index)=>({item,index}));
  const spacer=(height:number)=>height>0?<tr aria-hidden="true"><td colSpan={showCategories?6:5} style={{height,padding:0,border:0}}/></tr>:null;
  return (
    <table ref={table} className="links-table" aria-rowcount={items.length+1}>
      <thead>
        <tr>
          <th className="check-col" />
          <th>Name</th>
          <th>Link</th>
          {showCategories&&<th className="link-category-column">Category</th>}<th className="rating-column">Rating</th>
          <th className="actions-col" />
        </tr>
      </thead>
      <tbody>
        {virtual&&spacer(top)}
        {rendered.map(({item,index}) => (
          <tr
            key={item.id}
            ref={virtual?rows.measureElement:undefined}
            data-index={index}
            aria-rowindex={index+2}
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
            {showCategories&&<td className="link-category-column">{item.source.startsWith("Links/")?item.source.slice(6):"—"}</td>}<td className="rating-column"><LinkRating value={item.rating} onChange={value=>onRate(item.id,value)} label={`${item.name} rating`}/></td>
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
                <button onClick={()=>onFolders(item.id)}><FolderPlus size={13}/>Project folders</button>
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
        {virtual&&spacer(bottom)}
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
  }, [item.id, item.modified, item.thumbnail]);
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
          <ColourPicker projects={projects}/>
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
            title={item.kind==="link"?"Open website":"Reveal in Explorer"}
            onClick={() => void (item.kind==="link"?openUrl(item.path):revealItemInDir(item.path)).catch(report)}
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
              onClick={() => void revealItemInDir(item.kind==="link"?item.thumbnail!:item.path).catch(report)}
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
  project, projectFolder,
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
  projectFolder:FolderScope;
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
      if(kind==='link'&&typeof projectFolder==='number'){const item=next.items.find(i=>i.kind==='link'&&i.path===value.trim());if(item)await mutate({action:'add_project_folder',target:projectFolder,ids:[item.id]});}
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
      className={kind==='settings'?'settings-page-shell':'modal-backdrop'}
      onMouseDown={(e) => {
        if (kind!=='settings'&&e.target === e.currentTarget && !busy) close();
      }}
    >
      <div
        ref={dialogRef}
        className={kind==='settings'?'settings-page':'modal'}
        role={kind==='settings'?'region':'dialog'}
        aria-modal={kind==='settings'?undefined:true}
        aria-labelledby="dialog-title"
        onKeyDown={kind==='settings'?undefined:trap}
      >
        <div className="modal-heading">
          <h2 id="dialog-title">{titles[kind]}</h2>
          {kind==="settings"&&<div className="customise-history"><HistoryButtons/></div>}
          <IconButton title={kind==='settings'?'Back to library':'Close dialog'} onClick={close}>
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
            <OnboardingSettings/><CalendarConnection/><Diagnostics/>
            <section className="setting-block keyboard-shortcuts" aria-label="Keyboard shortcuts">
              <span className="setting-label">Keyboard shortcuts</span>
              <div className="shortcuts">
                {[["Search", "/ · Ctrl F · Ctrl K"],["Settings", "Ctrl ,"],["Undo", "Ctrl Z"],["Redo", "Ctrl Shift Z · Ctrl Y"],["Quick preview", "Space"],["Previous / next preview", "← / →"],["Close / clear selection", "Esc"],["Select all visible items", "Ctrl A"],["Organise selected images", "C"],["Remove selected items", "Delete"],["Copy image in viewer", "Ctrl C"],["Paste files, images or links", "Ctrl V"],["Enlarge hovered thumbnail", "Ctrl + mouse wheel"],["Scroll website screenshot", "Ctrl + mouse wheel"]].map(([label,keys])=><span key={label}>{label}<kbd>{keys}</kbd></span>)}
              </div>
              <small>Single-key shortcuts work outside text fields. Selection and preview shortcuts apply while browsing your library.</small>
            </section>
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
