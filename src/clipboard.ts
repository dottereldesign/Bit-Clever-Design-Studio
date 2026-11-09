import { invoke } from "@tauri-apps/api/core";

// Clipboard reads and writes share one OS resource. Keep all app entry points
// in order without disabling navigation or scrolling while native work runs.
let tail: Promise<void> = Promise.resolve();
let pendingCopy: Promise<void> | null = null;

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = tail.then(operation);
  tail = result.then(() => undefined, () => undefined);
  return result;
}

export function copyImageToClipboard(id: number): Promise<void> {
  const copy = enqueue(() => invoke<void>("copy_image", { id }));
  pendingCopy = copy;
  const clear = () => { if (pendingCopy === copy) pendingCopy = null; };
  void copy.then(clear, clear);
  return copy;
}

export function readClipboard<T>(): Promise<T> {
  // Capture the write that preceded this paste, not a future queued copy.
  // Its rejection cancels this paste instead of reading stale clipboard data.
  const copy = pendingCopy;
  return enqueue(async () => {
    if (copy) await copy;
    return invoke<T>("read_clipboard");
  });
}
