import {open as nativeOpen,save as nativeSave,type OpenDialogOptions,type SaveDialogOptions} from '@tauri-apps/plugin-dialog';
import {revealItemInDir as nativeReveal} from '@tauri-apps/plugin-opener';
import {traceDiagnostic} from './diagnostics';
export function open<T extends OpenDialogOptions>(options?:T){return traceDiagnostic('dialog.open',{mode:options?.directory?'directory':'file',phase:'awaiting_user'},()=>nativeOpen(options),value=>value===null?'cancelled':'success');}
export function save(options?:SaveDialogOptions){return traceDiagnostic('dialog.save',{phase:'awaiting_user'},()=>nativeSave(options),value=>value===null?'cancelled':'success');}
export function revealItemInDir(path:string|string[]){return traceDiagnostic('shell.reveal',{count:Array.isArray(path)?path.length:1},()=>nativeReveal(path));}
