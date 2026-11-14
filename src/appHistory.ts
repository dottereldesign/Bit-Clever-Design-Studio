import {record as diagnosticRecord,errorCode} from './diagnostics';
export type HistoryEntry = {
  label: string;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
  group?: string;
  kind?: "library";
};
type Fallback = {
  undoLabel?: string | null;
  redoLabel?: string | null;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

// One session history for mounted and unmounted views. Native library entries
// delegate to the database's durable, transactional undo/redo stacks.
export class AppHistory {
  past: HistoryEntry[] = [];
  future: HistoryEntry[] = [];
  cancelGesture: (() => void) | null = null;
  gesture: string | null = null;
  fallback: Fallback | null = null;
  onError: (error: unknown) => void = () => {};
  private replaying = false;
  private pending = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private fallbackRedoAllowed = true;
  private values = new Map<string, unknown>();
  private listeners = new Set<() => void>();
  private revision = 0;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
  snapshot = () => this.revision;
  notify = () => { this.revision++; this.listeners.forEach(fn => fn()); };
  get busy() { return this.replaying || this.pending > 0; }

  read<T>(key: string, initial: () => T): T {
    if (!this.values.has(key)) this.values.set(key, initial());
    return this.values.get(key) as T;
  }
  write(values: Record<string, unknown>) {
    for (const [key, value] of Object.entries(values)) {
      this.values.set(key, value);
      if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(value));
    }
    this.notify();
  }
  commit(label: string, before: Record<string, unknown>, after: Record<string, unknown>) {
    if (this.replaying || JSON.stringify(before) === JSON.stringify(after)) return;
    this.record({
      label, undo: () => this.write(before), redo: () => this.write(after),
      group: this.gesture ? `${this.gesture}:${Object.keys(after).sort().join(",")}` : undefined,
    });
    this.write(after);
    if(!this.gesture)diagnosticRecord('settings.change','success',0,{count:Object.keys(after).length,field:Object.keys(after).filter(k=>['app-theme','app-colour-sources','cta-appearance','tab-appearance','analytics-appearance','home-overview','sidebar-section-order','customise-tab-order','sidebar-layout','selection-style','settings-appearance','home-plan','home-tiles','home-style','home-appearance','app-icons','folder-appearance','sidebar-section-colours','sidebar-width','studio-layouts','project-file-layouts','reduce-motion'].includes(k)).join('.')});
  }
  record(entry: HistoryEntry) {
    if (this.replaying) return;
    const previous = this.past.at(-1);
    if (entry.group && previous?.group === entry.group) {
      this.past[this.past.length - 1] = { ...entry, undo: previous.undo };
    } else {
      this.past = [...this.past.slice(-99), entry];
    }
    this.future = [];
    this.fallbackRedoAllowed = false;
    this.notify();
  }
  // Serialize library edits and prevent Undo from overtaking an unfinished save.
  async perform<T>(operation: () => Promise<T>): Promise<T> {
    if (this.replaying) throw Error("Wait for Undo or Redo to finish.");
    this.pending++;
    this.notify();
    const task = this.queue.then(operation);
    this.queue = task.catch(() => {});
    try { return await task; }
    finally { this.pending--; this.notify(); }
  }
  beginGesture(id: string) { if (!this.gesture) this.gesture = id; }
  endGesture() { if(this.gesture)diagnosticRecord('settings.gesture','success');this.gesture = null; }
  get undoLabel() { return this.past.at(-1)?.label ?? this.fallback?.undoLabel ?? null; }
  get redoLabel() {
    return this.future.at(-1)?.label ??
      (this.past.length || !this.fallbackRedoAllowed ? null : this.fallback?.redoLabel) ?? null;
  }
  async undo() { await this.run(false); }
  async redo() { await this.run(true); }
  private async run(redo: boolean) {
    if (this.replaying) return;
    // A shortcut pressed while a save is finishing should undo that save, not vanish.
    while (this.pending > 0) await this.queue;
    if (this.replaying) return;
    if (this.cancelGesture) {
      const cancel = this.cancelGesture;
      this.cancelGesture = null;
      cancel();
      return;
    }
    if (redo ? !this.redoLabel : !this.undoLabel) return;
    this.endGesture();
    const source = redo ? this.future : this.past, entry = source.at(-1);
    const operation=crypto.randomUUID(),started=performance.now();diagnosticRecord(redo?'history.redo':'history.undo','started',0,{},operation);
    this.replaying = true;
    this.notify();
    try {
      if (entry) {
        const task = redo ? entry.redo() : entry.undo();
        if (task) await task;
        source.pop();
        (redo ? this.past : this.future).push(entry);
      } else if (this.fallback) {
        const fallback = this.fallback, label = (redo ? fallback.redoLabel : fallback.undoLabel)!;
        await (redo ? fallback.redo() : fallback.undo());
        // Remember older durable edits too, so Redo keeps its chronological
        // position relative to settings undone earlier in this session.
        (redo ? this.past : this.future).push({ label, kind: "library", undo: fallback.undo, redo: fallback.redo });
        if (!redo) this.fallbackRedoAllowed = true;
      }
      diagnosticRecord(redo?'history.redo':'history.undo','success',performance.now()-started,{},operation);
    } catch (error) { diagnosticRecord(redo?'history.redo':'history.undo','error',performance.now()-started,{error_code:errorCode(error)},operation);this.onError(error); }
    finally { this.replaying = false; this.notify(); }
  }
  clearLibrary() {
    this.past = this.past.filter(e => e.kind !== "library");
    this.future = [];
    this.fallbackRedoAllowed = false;
    this.notify();
  }
}
export const appHistory = new AppHistory();
