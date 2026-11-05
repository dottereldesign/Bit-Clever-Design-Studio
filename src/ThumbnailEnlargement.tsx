import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { media } from "./api";
import type { Item } from "./model";

type Box = { x: number; y: number; width: number; height: number };
type Session = { item: Item; source: HTMLImageElement; thumbnail: string; origin: Box };
type Props = { items: Item[]; enabled: boolean; reducedMotion: boolean; onActiveChange: (active: boolean) => void };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// Use the image's actual bounds, including any object-fit letterboxing.
function imageBox(image: HTMLImageElement): Box {
  const rect = image.getBoundingClientRect();
  const fit = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
  const width = image.naturalWidth * fit, height = image.naturalHeight * fit;
  return { x: rect.left + (rect.width - width) / 2, y: rect.top + (rect.height - height) / 2, width, height };
}

export default function ThumbnailEnlargement(props: Props) {
  const latest = useRef(props); latest.current = props;
  const [session, setSession] = useState<Session | null>(null);
  const active = useRef<Session | null>(null);
  const [original, setOriginal] = useState("");
  const overlay = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const progress = useRef(0), target = useRef(0), frame = useRef(0), lastTime = useRef(0);
  const previousFocus = useRef<HTMLElement | null>(null);
  const systemMotion = useRef(window.matchMedia("(prefers-reduced-motion: reduce)"));

  const finish = useCallback(() => {
    const current = active.current;
    if (!current) return;
    cancelAnimationFrame(frame.current); frame.current = 0;
    active.current = null; progress.current = 0; target.current = 0;
    current.source.classList.remove("thumbnail-enlargement-source");
    setSession(null); setOriginal(""); latest.current.onActiveChange(false);
    const focus = previousFocus.current;
    requestAnimationFrame(() => {
      if (!active.current && focus?.isConnected) focus.focus({ preventScroll: true });
    });
  }, []);

  const animate = useCallback(function tick(time: number) {
    frame.current = 0;
    const current = active.current;
    if (!current || !overlay.current || !stage.current) return;
    if (!current.source.isConnected) { finish(); return; }
    const reduced = latest.current.reducedMotion || systemMotion.current.matches;
    const elapsed = Math.min(64, time - (lastTime.current || time - 16)); lastTime.current = time;
    const next = reduced ? target.current : progress.current + (target.current - progress.current) * (1 - Math.exp(-elapsed / 65));
    progress.current = Math.abs(next - target.current) < .0005 ? target.current : next;
    const p = progress.current;
    // The maximum is a whole-image view, never a cropped magnifying lens.
    const ratio = current.origin.width / current.origin.height;
    const width = Math.max(1, Math.min(innerWidth - 48, (innerHeight - 112) * ratio));
    const height = width / ratio;
    const scale = Math.pow(current.origin.width / width, 1 - p);
    const cx = current.origin.x + current.origin.width / 2;
    const cy = current.origin.y + current.origin.height / 2;
    const x = cx + (innerWidth / 2 - cx) * p - width * scale / 2;
    const y = cy + ((innerHeight - 24) / 2 - cy) * p - height * scale / 2;
    stage.current.style.width = `${width}px`;
    stage.current.style.height = `${height}px`;
    stage.current.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`;
    stage.current.style.borderRadius = `${(6 + 5 * p) / scale}px`;
    overlay.current.style.setProperty("--enlargement-focus", String(Math.min(1, p * 2.5)));
    if (p === 0 && target.current === 0) { finish(); return; }
    if (p !== target.current) frame.current = requestAnimationFrame(tick);
  }, [finish]);

  const wake = useCallback(() => {
    if (!frame.current) { lastTime.current = 0; frame.current = requestAnimationFrame(animate); }
  }, [animate]);
  const dismiss = useCallback(() => {
    if (!active.current) return;
    // Re-measure on return in case a background thumbnail finished loading.
    if (active.current.source.isConnected) active.current.origin = imageBox(active.current.source);
    target.current = 0; wake();
  }, [wake]);

  useEffect(() => {
    const wheel = (event: WheelEvent) => {
      if (!active.current) {
        if (!latest.current.enabled || !event.ctrlKey || event.altKey || event.shiftKey || event.buttons || document.body.classList.contains("dragging-items")) return;
        const card = event.target instanceof Element ? event.target.closest(".card[data-item-id],.collection-reference[data-item-id],.link-card[data-item-id]") : null;
        if (!card || card.closest("[inert]")) return;
        const image = card.querySelector<HTMLImageElement>(".card-open > img:not(.hover-preview),.collection-reference-image img,.link-card-open > img");
        const item = latest.current.items.find(item => item.id === Number((card as HTMLElement).dataset.itemId));
        if (!image?.complete || !image.naturalWidth || !item || item.missing) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.deltaY >= 0) return; // At the original size; don't zoom the app out.
        const origin = imageBox(image);
        if (!origin.width || !origin.height) return;
        const next = { item, source: image, thumbnail: image.currentSrc || image.src, origin };
        active.current = next; previousFocus.current = document.activeElement as HTMLElement;
        progress.current = 0; target.current = 0;
        latest.current.onActiveChange(true); setSession(next);
      } else {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!event.ctrlKey) {
          // A tiny Ctrl-wheel after pasting can create an almost invisible
          // enlargement. Ordinary scrolling means resume browsing, not lock
          // the app behind that overlay until the user discovers Escape.
          const scroller = active.current.source.closest<HTMLElement>(".content");
          const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroller?.clientHeight || innerHeight : 1;
          finish();
          scroller?.scrollBy({ top: event.shiftKey ? 0 : event.deltaY * unit, left: (event.deltaX || (event.shiftKey ? event.deltaY : 0)) * unit, behavior: "auto" });
          return;
        }
      }
      if (!event.ctrlKey || event.altKey || event.shiftKey) return;
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      target.current = clamp(target.current - clamp(pixels, -300, 300) / 1000, 0, 1);
      wake();
    };
    const key = (event: KeyboardEvent) => {
      if (!active.current) return;
      // A transient inspection must not invoke library delete/undo/preview shortcuts.
      event.stopImmediatePropagation();
      if (event.key === "Escape" || event.key === " ") { event.preventDefault(); dismiss(); }
      else if (["+", "=", "ArrowUp", "-", "_", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        target.current = clamp(target.current + (["-", "_", "ArrowDown"].includes(event.key) ? -.12 : .12), 0, 1); wake();
      } else if (event.key === "Tab") { event.preventDefault(); closeButton.current?.focus({ preventScroll: true }); }
    };
    const resize = () => { if (active.current) wake(); };
    window.addEventListener("wheel", wheel, { passive: false, capture: true });
    window.addEventListener("keydown", key, true);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("wheel", wheel, true); window.removeEventListener("keydown", key, true); window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame.current); frame.current = 0;
      active.current?.source.classList.remove("thumbnail-enlargement-source");
    };
  }, [dismiss, wake, finish]);

  useEffect(() => {
    if (!props.enabled || (active.current && (!active.current.source.isConnected || !props.items.some(item => item.id === active.current!.item.id)))) finish();
  }, [props.enabled, props.items, finish]);

  useLayoutEffect(() => {
    if (!session) return;
    session.source.classList.add("thumbnail-enlargement-source");
    overlay.current?.focus({ preventScroll: true });
    wake();
  }, [session, wake]);

  useEffect(() => {
    if (!session || session.item.kind === "video") return; // Enlarge a video's poster without starting playback.
    const abort = new AbortController();
    void media(session.item, session.item.kind === "link" ? "thumbnail" : "original", abort.signal).then(async url => {
      const image = new Image(); image.src = url;
      await image.decode();
      if (!abort.signal.aborted) setOriginal(url);
    }).catch(() => {}); // Retain the usable thumbnail if the original is unavailable.
    return () => abort.abort();
  }, [session]);

  if (!session) return null;
  return createPortal(<div ref={overlay} className="thumbnail-enlargement" tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Enlarged ${session.item.name}`} aria-describedby="thumbnail-enlargement-hint" onClick={dismiss} onContextMenu={e => e.preventDefault()}>
    <div className="thumbnail-enlargement-backdrop" />
    <div ref={stage} className="thumbnail-enlargement-image" onClick={e => e.stopPropagation()}>
      <img src={original || session.thumbnail} alt={session.item.name} draggable={false} onError={() => setOriginal("")} />
    </div>
    <button ref={closeButton} className="thumbnail-enlargement-close" aria-label="Close enlargement" title="Close · Esc" onClick={e => { e.stopPropagation(); dismiss(); }}><X size={19}/></button>
    <div className="thumbnail-enlargement-caption" onClick={e => e.stopPropagation()}><strong>{session.item.name}</strong><span id="thumbnail-enlargement-hint">Ctrl + scroll to resize · Esc to return</span></div>
  </div>, document.body);
}
