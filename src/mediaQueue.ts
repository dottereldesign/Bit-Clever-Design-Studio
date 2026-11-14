export type MediaProgress = { total: number; completed: number; failed: number; pending: number };
type Job = {
  key: string;
  thumbnail: boolean;
  priority:number;
  signals: Set<AbortSignal | undefined>;
  run: () => Promise<string>;
  resolve: (value: string) => void;
  reject: (error: unknown) => void;
  promise: Promise<string>;
};

// Share native work across StrictMode remounts and rapid gallery navigation.
// Aborting one card must never cancel another card's request for the same file.
export class MediaQueue {
  private active = 0;
  private jobs = new Map<string, Job>();
  private queue: Job[] = [];
  private listeners = new Set<() => void>();
  private progress: MediaProgress = { total: 0, completed: 0, failed: 0, pending: 0 };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getProgress = () => this.progress;
  private update(patch: Partial<MediaProgress>) {
    this.progress = { ...this.progress, ...patch };
    this.listeners.forEach(listener => listener());
  }
  request(key: string, thumbnail: boolean, run: () => Promise<string>, signal?: AbortSignal, priority=1): Promise<string> {
    if (signal?.aborted) return Promise.reject(new Error("Cancelled"));
    let job = this.jobs.get(key);
    if (!job) {
      let resolve!: Job['resolve'], reject!: Job['reject'];
      const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
      job = { key, thumbnail, priority:thumbnail?priority:-1, run, signals: new Set(), resolve, reject, promise };
      this.jobs.set(key, job);
      if (thumbnail) {
        const p = this.progress;
        this.update(p.pending ? { total: p.total + 1, pending: p.pending + 1 } : { total: 1, pending: 1, completed: 0, failed: 0 });
        this.queue.push(job);
      } else this.queue.unshift(job);
    }
    job.priority=Math.min(job.priority,thumbnail?priority:-1);
    this.queue.sort((a,b)=>a.priority-b.priority);
    job.signals.add(signal);
    const result = !signal ? job.promise : new Promise<string>((resolve, reject) => {
      const abort = () => reject(new Error("Cancelled"));
      signal.addEventListener('abort', abort, { once: true });
      job!.promise.then(value => {
        if (!signal.aborted) resolve(value);
      }, reject).finally(() => signal.removeEventListener('abort', abort));
    });
    if(thumbnail&&priority>0)queueMicrotask(()=>this.pump());else this.pump();
    return result;
  }
  prioritize(key:string,priority:number){const job=this.jobs.get(key);if(job){job.priority=priority;this.queue.sort((a,b)=>a.priority-b.priority);}}
  private pump() {
    while (this.active < 3 && this.queue.length) {
      const job = this.queue.shift()!;
      if ([...job.signals].every(signal => signal?.aborted)) {
        this.jobs.delete(job.key);
        if (job.thumbnail) this.update({ total: this.progress.total - 1, pending: this.progress.pending - 1 });
        job.reject(new Error("Cancelled"));
        continue;
      }
      this.active++;
      void Promise.resolve().then(job.run).then(job.resolve, error => {
        if (job.thumbnail) this.update({ failed: this.progress.failed + 1 });
        job.reject(error);
      }).finally(() => {
        this.jobs.delete(job.key);
        this.active--;
        if (job.thumbnail) this.update({ completed: this.progress.completed + 1, pending: this.progress.pending - 1 });
        this.pump();
      });
    }
  }
}
