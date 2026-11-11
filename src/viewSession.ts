import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { isBoardDestination, type BoardKey } from "./model";

export type ViewState = {
  projectFolder?:number|"unfiled"|null; ratingFilter?:string;
  homeView: boolean; generalKey: string | null; project: number | null;
  category: string | null; linksOnly: boolean; resourcesView: boolean;
  boardView: BoardKey | null; videoView: boolean; recent: "added" | "viewed" | null;
  search: string; type: string; tags: number[]; tagMode: "any" | "all";
  source: string; sort: string; seed: number; viewer: number | null;
};
export type ScrollAnchor = { id: number; offset: number };
type ViewSession = { view: ViewState; scroll: { top: number; anchor?: ScrollAnchor } };
const storageKey = "last-workspace-view";
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const nullableId = (value: unknown) => value === null || (finite(value) && Number.isInteger(value) && value >= 0);

export function readViewSession(): ViewSession | null {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (saved?.version !== 1 || !saved.view || !saved.scroll) return null;
    const v = saved.view;
    if (![v.homeView, v.linksOnly, v.resourcesView, v.videoView].every(value => typeof value === "boolean") ||
      ![v.search, v.type, v.source, v.sort].every(value => typeof value === "string") ||
      ![v.generalKey, v.category].every(value => value === null || typeof value === "string") ||
      ![v.project, v.viewer].every(nullableId) || !finite(v.seed) ||
      !Array.isArray(v.tags) || !v.tags.every((id: unknown) => finite(id) && Number.isInteger(id)) ||
      !["any", "all"].includes(v.tagMode) || ![null, "added", "viewed"].includes(v.recent) ||
      (v.boardView !== null && !isBoardDestination(v.boardView)) ||
      !finite(saved.scroll.top) || saved.scroll.top < 0) return null;
    if(v.projectFolder!==undefined && v.projectFolder!=="unfiled" && !nullableId(v.projectFolder))v.projectFolder=null;
    if(!["","unrated","4+","1","2","3","4","5"].includes(v.ratingFilter))v.ratingFilter="";
    const anchor = saved.scroll.anchor;
    if (anchor && (!finite(anchor.id) || !finite(anchor.offset))) delete saved.scroll.anchor;
    return { view: v, scroll: saved.scroll };
  } catch { return null; }
}

// Save during normal navigation/scrolling as well as on exit: native window
// shutdown is not guaranteed to deliver a final browser unload event.
export function useViewSession({ state, initial, ready, enabled, restoring, scroller }: {
  state: ViewState; initial: ViewSession | null; ready: boolean; enabled: boolean;
  restoring: boolean; scroller: RefObject<HTMLDivElement | null>;
}) {
  const latest = useRef({ state, ready, enabled, restoring }); latest.current = { state, ready, enabled, restoring };
  const restored = useRef(false);
  const save = useRef(() => {});
  useLayoutEffect(() => {
    if (!ready || restored.current || !enabled) return;
    restored.current = true;
    if (initial && !restoring && scroller.current) scroller.current.scrollTop = initial.scroll.top;
  }, [ready, enabled, initial, restoring, scroller]);
  useEffect(() => {
    let timer = 0;
    const write = () => {
      clearTimeout(timer); timer = 0;
      const current = latest.current;
      if (!current.enabled || !current.ready || current.restoring) return;
      const content = scroller.current;
      const scroll: ViewSession["scroll"] = { top: content?.scrollTop ?? 0 };
      if (content) {
        const bounds = content.getBoundingClientRect();
        const cards = [...content.querySelectorAll<HTMLElement>(".card[data-item-id]")];
        const first = cards.filter(card => card.getBoundingClientRect().bottom > bounds.top)
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
        if (first) scroll.anchor = { id: Number(first.dataset.itemId), offset: first.getBoundingClientRect().top - bounds.top };
      }
      try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, view: current.state, scroll })); } catch { /* A full/disabled local store must not break browsing. */ }
    };
    save.current = write;
    const onScroll = (event: Event) => { if (event.target === scroller.current && !timer) timer = window.setTimeout(write, 120); };
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("pagehide", write); window.addEventListener("beforeunload", write);
    return () => {
      clearTimeout(timer); document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("pagehide", write); window.removeEventListener("beforeunload", write);
    };
  }, [scroller]);
  // State is memoized by the caller, so hovering thumbnails doesn't write storage.
  useEffect(() => { save.current(); }, [state, ready, restoring]);
}
