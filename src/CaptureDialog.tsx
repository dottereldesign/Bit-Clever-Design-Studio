import WebsiteAutoCapture from './WebsiteAutoCapture';
import {stageFiles} from "./captureImport";
import CaptureProgress, {type ImportProgress} from "./CaptureProgress";
import { readClipboard } from "./clipboard";
import { useEffect, useRef, useState } from "react";
import { Channel, convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Check, FileImage, LoaderCircle, X } from "lucide-react";
import { boardNames, isBoardDestination, isTableCollection, type Library, type LinkDestination } from "./model";
import { RatioSelect, ThumbnailCrop } from "./ThumbnailEditor";
import { appHistory } from "./appHistory";

export type CaptureFile = { path: string; name: string };
export type CaptureDraft = { files: CaptureFile[]; url: string; thumbnail?: CaptureFile; destination?: LinkDestination };
export type CaptureResult = { history_labels?: string[]; move_label?: string; moved_from?: string | null; ids: number[]; added: number; reused: number; destination?: LinkDestination | null };
export default function CaptureDialog({
  draft,
  lib,
  project,
  source,
  close,
  complete,
}: {
  draft: CaptureDraft;
  lib: Library;
  project: number | null;
  source: string;
  close: () => void;
  complete: (result: CaptureResult) => Promise<void>;
}) {
  const [importProgress,setImportProgress]=useState<ImportProgress|null>(null);
  const [name, setName] = useState(
      draft.files.length === 1
        ? draft.files[0].name.replace(/\.[^.]+$/, "")
        : "",
    ),
    [url, setUrl] = useState(draft.url),
    [sourceUrl, setSourceUrl] = useState("");
  const [projects, setProjects] = useState<number[]>(project ? [project] : []),
    [linkDestination, setLinkDestination] = useState(draft.destination ?? "links"),
    [destination, setDestination] = useState(["Photography", "Videos"].includes(source.split("/")[0]) ? source.split("/")[0] : "Design"),
    [tags, setTags] = useState<number[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const board = isBoardDestination(linkDestination);
  const [thumbnail, setThumbnail] = useState<CaptureFile | undefined>(draft.thumbnail);
  const [reading, setReading] = useState(false);
  const [ratio, setRatio] = useState(4/3);
  const [adjusting, setAdjusting] = useState(false);
  const pending = useRef(false);
  const saving = useRef(false);
  const website = linkDestination === "websites";
  const websiteUrl=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(website&&!reading&&!thumbnail)websiteUrl.current?.focus();},[website,reading,thumbnail]);
  const validWebsiteUrl = (()=>{try{return ["https:","http:"].includes(new URL(url).protocol);}catch{return false;}})();
  const saveAfterPaste = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!reading && saveAfterPaste.current && (thumbnail || isTableCollection(linkDestination)) && url) {
      saveAfterPaste.current = false; form.current?.requestSubmit();
    }
  }, [reading, thumbnail, url, linkDestination]);
  const staged = useRef<string[]>(draft.thumbnail ? [draft.thumbnail.path] : []);
  const cleanup = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { clearTimeout(cleanup.current); return () => { cleanup.current = setTimeout(() => { void invoke("discard_capture", { paths: staged.current }).catch(() => {}); }, 0); }; }, []);
  const receive = (incoming: CaptureDraft) => {
    if (incoming.files.length) {
      const file = incoming.files[0];
      staged.current.push(...incoming.files.map(file => file.path));
      setThumbnail(file);
    }
    if (incoming.url) setUrl(incoming.url);
  };
  const paste = async () => {
    if (pending.current || busy || reading) return;
    pending.current = true; setReading(true); setError("");
    try { receive(await readClipboard<CaptureDraft>()); }
    catch (error) { saveAfterPaste.current = false; setError(String(error)); }
    finally { pending.current = false; setReading(false); }
  };
  const toggle = (ids: number[], id: number) =>
    ids.includes(id) ? ids.filter((n) => n !== id) : [...ids, id];
  const save = async (image = thumbnail) => {
    if (busy || pending.current || saving.current) return;
    if (website && !validWebsiteUrl) {setError("Paste a valid http or https URL first.");return;}
    if (board && !isTableCollection(linkDestination) && !image) { setError("Capture or paste a thumbnail first."); return; }
    saving.current=true;setBusy(true);
    setError("");
    try {
      const onProgress=new Channel<ImportProgress>();onProgress.onmessage=setImportProgress;
      const result = await appHistory.perform(()=>invoke<CaptureResult>("capture_items_progress", {
        onProgress,
        input: {
          files: draft.files,
          thumbnail: image,
          destination: linkDestination,
          url,
          name,
          source_url: sourceUrl,
          projects,
          project_only:project!==null&&projects.includes(project),
          tags,
          source: destination,
          resource: draft.files.length === 0 && linkDestination === "resources",
        },
      }));
      await complete(result);
      setImportProgress(null);
    } catch (e) {
      setError(String(e));
      setImportProgress(null);setBusy(false);saving.current=false;
    }
  };
  const submit = async (e: React.FormEvent) => { e.preventDefault(); await save(); };
  const captureScreen = async () => {
    if (busy || pending.current || !form.current?.reportValidity()) return;
    pending.current = true; setReading(true); setError("");
    let file: CaptureFile | null = null;
    try {
      file = await invoke<CaptureFile | null>("capture_screen", {ratio});
      if(file) { staged.current.push(file.path); setThumbnail(file); }
    } catch(e) { setError(String(e)); }
    finally { pending.current = false; setReading(false); }
    if(file) await save(file);
  };
  useEffect(()=>{
    if(website&&validWebsiteUrl&&thumbnail&&!reading&&!error&&!saving.current)void save(thumbnail);
  },[website,validWebsiteUrl,thumbnail,reading,url]);
  const receiveWebsiteFiles=async(files:File[])=>{
    if(pending.current||busy||reading)return;
    pending.current=true;setReading(true);setError("");
    try{const images=files.filter(f=>f.type.startsWith("image/"));if(!images.length)throw Error("Choose an image for the thumbnail.");receive(await stageFiles(images.slice(0,1)));}
    catch(e){setError(String(e));}finally{pending.current=false;setReading(false);}
  };
  if(website)return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy&&!reading)close();}}>
    <div className="modal capture-modal website-capture" role="dialog" aria-modal="true" aria-label="Add website"
      onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v'){e.preventDefault();e.stopPropagation();void paste();}if(e.key==='Escape'&&(busy||reading)){e.preventDefault();e.stopPropagation();}}}
      onPaste={e=>{if(e.clipboardData.files.length){e.preventDefault();void receiveWebsiteFiles(Array.from(e.clipboardData.files));}}}
      onDragOver={e=>{e.preventDefault();e.stopPropagation();}}
      onDrop={e=>{e.preventDefault();e.stopPropagation();void receiveWebsiteFiles(Array.from(e.dataTransfer.files));}}>
      <div className="modal-heading"><h2>{validWebsiteUrl?'Capture website':'Add website'}</h2><button className="icon-button" aria-label="Close capture" disabled={busy||reading} onClick={close}><X size={17}/></button></div>
      <label className="field">Website URL<input ref={websiteUrl} autoFocus type="url" required aria-label="Website URL" placeholder="https://" value={url} disabled={busy||reading} onChange={e=>{setError('');setUrl(e.target.value);}}/></label>
      {validWebsiteUrl&&!thumbnail&&<WebsiteAutoCapture url={url} autoStart={!!draft.url&&draft.url===url} busy={setReading} image={file=>{staged.current.push(file.path);setThumbnail(file);}}/>}
      <div className="website-thumbnail-drop">
        {thumbnail?<img src={convertFileSrc(thumbnail.path)} alt="Website thumbnail"/>:<FileImage size={28}/>}
        <p>{busy?'Saving website…':reading?'Working…':validWebsiteUrl?'Or paste or drop an image. It saves automatically.':'Paste a website URL, then its image.'}</p>
        <button className="primary" disabled={!validWebsiteUrl||busy||reading} onClick={()=>void paste()}>Paste image</button>
        <label className="subtle-button">Choose image<input type="file" accept="image/*" disabled={!validWebsiteUrl||busy||reading} onChange={e=>void receiveWebsiteFiles(Array.from(e.target.files??[]))}/></label>
      </div>
      {busy&&<CaptureProgress progress={importProgress}/>}
      {error&&<div className="form-error" role="alert">{error}{thumbnail&&validWebsiteUrl&&<button className="subtle-button" onClick={()=>void save()}>Retry save</button>}</div>}
    </div>
  </div>;
  return (
    <><div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy && !reading) close();
      }}
    >
      <div
        className="modal capture-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Capture"
        onKeyDown={e=>{
          if(board && e.key==='Enter' && pending.current) { e.preventDefault(); e.stopPropagation(); saveAfterPaste.current=true; return; }
          if(board && e.key==='Enter' && ((e.target instanceof HTMLInputElement) || (e.target as HTMLElement).closest('.capture-assign'))) { e.preventDefault(); e.stopPropagation(); form.current?.requestSubmit(); return; }
          if(e.key==='Escape'&&(busy||reading)){e.preventDefault();e.stopPropagation();}
          if(board&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v') {e.preventDefault();e.stopPropagation();void paste();}
        }}
        onPaste={e=>{ if(board&&e.clipboardData.files.length){e.preventDefault(); if(pending.current||busy||reading)return; pending.current=true;setReading(true);void stageFiles(Array.from(e.clipboardData.files)).then(receive).catch(e=>setError(String(e))).finally(()=>{pending.current=false;setReading(false);});} }}
      >
        <div className="modal-heading">
          <h2>{isBoardDestination(linkDestination) ? boardNames[linkDestination] : "Capture"}</h2>
          <button
            className="icon-button"
            aria-label="Close capture"
            disabled={busy || reading}
            onClick={close}
          >
            <X size={17} />
          </button>
        </div>
        <form ref={form} onSubmit={submit}>
          {draft.files.length === 0 && <label className="field">Save to
            <select aria-label="Save link to" value={linkDestination} onChange={(e) => setLinkDestination(e.target.value as LinkDestination)}>
              <option value="links">Links</option><option value="resources">Resources</option>{Object.entries(boardNames).map(([key,name])=><option key={key} value={key}>{name}</option>)}
            </select>
          </label>}
          {draft.files.length > 0 ? (
            <div className="capture-files">
              {draft.files.map((file, n) => (
                <div key={`${file.path}-${n}`}>
                  <FileImage size={14} />
                  <span>{file.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <label className="field">
              Link
              <input
                autoFocus
                type="url"
                required
                placeholder="https://"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
          )}
          {draft.files.length === 0 && !isTableCollection(linkDestination) && <div className="thumbnail-capture">
            {thumbnail && <img src={convertFileSrc(thumbnail.path)} alt="Thumbnail" />}
            <RatioSelect value={ratio} change={setRatio} disabled={busy||reading}/>
            <button type="button" className="primary" disabled={busy || reading || !url.trim()} onClick={() => void captureScreen()}>{reading ? "Working…" : "Capture & save"}</button>
            <button type="button" className="subtle-button" disabled={busy || reading} onClick={() => void paste()}>{reading ? "Reading…" : thumbnail ? "Replace thumbnail" : "Paste thumbnail"}</button>
            {thumbnail&&<button type="button" className="subtle-button" disabled={busy||reading} onClick={()=>setAdjusting(true)}>Adjust thumbnail</button>}
          </div>}
          {draft.files.length > 0 && <label className="field">Save files to
            <select value={destination} onChange={(e) => setDestination(e.target.value)}>
              {["Design", "Photography", "Videos"].map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>}
          {draft.files.length < 2 && (
            <label className="field">
              Name
              <input
                autoFocus={draft.files.length > 0}
                value={name}
                maxLength={300}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
              />
            </label>
          )}
          {draft.files.length > 0 && (
            <label className="field">
              Source link <span className="optional">optional</span>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://"
              />
            </label>
          )}
          <div className="capture-assign">
            <span>Projects</span>
            <div>
              {lib.projects.length ? (
                lib.projects.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className={projects.includes(p.id) ? "chosen" : ""}
                    aria-pressed={projects.includes(p.id)}
                    onClick={() => setProjects(toggle(projects, p.id))}
                  >
                    {projects.includes(p.id) && <Check size={11} />} {p.name}
                  </button>
                ))
              ) : (
                <small>No projects yet</small>
              )}
            </div>
            <span>Tags</span>
            <div>
              {lib.tags.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={tags.includes(t.id) ? "chosen" : ""}
                  aria-pressed={tags.includes(t.id)}
                  onClick={() => setTags(toggle(tags, t.id))}
                >
                  {tags.includes(t.id) && <Check size={11} />} {t.name}
                </button>
              ))}
            </div>
          </div>
          {busy&&<CaptureProgress progress={importProgress}/>}
      {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-footer">
            <button
              type="button"
              className="subtle-button"
              disabled={busy || reading}
              onClick={close}
            >
              Cancel
            </button>
            <button type="submit" className="primary" disabled={busy || reading}>
              {busy ? (
                <>
                  <LoaderCircle size={14} className="spin" /> Checking & saving…
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>{adjusting&&thumbnail&&<ThumbnailCrop file={thumbnail} ratio={ratio} close={()=>setAdjusting(false)} save={async file=>{staged.current.push(file.path);setThumbnail(file);setAdjusting(false);}}/>}</>
  );
}
