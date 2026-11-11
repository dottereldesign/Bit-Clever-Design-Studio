import {invoke} from "./diagnostics";
import type {CaptureFile,CaptureDraft} from "./CaptureDialog";
import type {ImportProgress} from "./CaptureProgress";
export async function stageFiles(files: File[], progress?:(value:ImportProgress)=>void): Promise<CaptureDraft> {
  const staged: CaptureFile[] = [];
  const started=performance.now(),totalBytes=files.reduce((sum,f)=>sum+f.size,0);let bytesRead=0,checked=0;
  const emit=(current:string)=>{const elapsed=performance.now()-started;progress?.({phase:"reading",checked,total:files.length,current,bytes:bytesRead,total_bytes:totalBytes,elapsed_ms:elapsed,remaining_seconds:elapsed>2000&&bytesRead>0?Math.ceil((totalBytes-bytesRead)*elapsed/bytesRead/1000):null});};
  try {
    for (const file of files) {
      emit(file.name);
      const entry = await invoke<CaptureFile>("stage_begin", {
        name: file.name,
      });
      staged.push(entry);
      const token = entry.path.replace(/\\/g, "/").split("/").pop()!;
      for (let offset = 0; offset < file.size; offset += 2 * 1024 * 1024) {
        const bytes = new Uint8Array(
          await file.slice(offset, offset + 2 * 1024 * 1024).arrayBuffer(),
        );
        await invoke("stage_chunk", bytes, {
          headers: { "x-capture-token": token },
        });
        bytesRead+=bytes.length;emit(file.name);
      }
      checked++;emit(file.name);
    }
    return { files: staged, url: "" };
  } catch (error) {
    await invoke("discard_capture", { paths: staged.map((f) => f.path) }).catch(
      () => {},
    );
    throw error;
  }
}
