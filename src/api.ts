import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { Library, Item } from "./model";
import { MediaQueue } from "./mediaQueue";
export const openUrl = (url: string) => invoke<void>("open_external_url", { url });
export const loadLibrary = () => invoke<Library>("get_library");
export type Change = {
  action: string;
  ids?: number[];
  target?: number;
  name?: string;
  value?: string;
};
export const changeLibrary = (change: Change) =>
  invoke<void>("update", { change });
const cache = new Map<string, string>();
export const mediaQueue = new MediaQueue();
export function forgetMedia(item: Item, mode: string) {
  cache.delete(`${item.id}:${item.modified}:${item.path}:${item.thumbnail ?? ''}:${mode}`);
}
export async function media(
  item: Item,
  mode: string,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) throw new Error("Cancelled");
  const key = `${item.id}:${item.modified}:${item.path}:${item.thumbnail ?? ''}:${mode}`;
  if (cache.has(key)) return cache.get(key)!;
  if (item.kind === "link" && item.thumbnail) return convertFileSrc(item.thumbnail);
  if (mode === "preview" && item.kind === "animation")
    return convertFileSrc(item.path);
  if (mode === "original" && !item.path.toLowerCase().endsWith(".mov"))
    return convertFileSrc(item.path);
  return mediaQueue.request(key, mode === "thumbnail", async () => {
    const path = await invoke<string>("get_media", { id: item.id, mode });
    const url = convertFileSrc(path);
    cache.set(key, url);
    return url;
  }, signal);
}
