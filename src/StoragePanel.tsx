import {useEffect,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {open} from '@tauri-apps/plugin-dialog';
import {FolderOpen,Download,ShieldCheck,Upload} from 'lucide-react';
import {StudioDialog} from './Shortcuts';
import type {Library} from './model';

export default function StoragePanel({lib,close,backup,restore}:{lib:Library;close:()=>void;backup:()=>void;restore:()=>void}){
 const [data,setData]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{invoke<string>('data_folder').then(setData).catch(e=>setError(String(e)));},[]);
 const verify=async()=>{setError('');setStatus('');setBusy(true);try{const path=await open({directory:true,multiple:false,title:'Choose the backup folder to verify'});if(typeof path!=='string')return;const result=await invoke<{files:number;missing:string[]}>('verify_library_backup',{path});setStatus(result.missing.length?`${result.files} files verified, but ${result.missing.length} originals were unavailable when this backup was created. Review manifest.json.`:`Verified ${result.files} files. This copy matches the backup checksums.`);}catch(e){setError(String(e));}finally{setBusy(false);}};
 const location=(name:string,path:string,description:string)=><div className="storage-location" key={name}><div><strong>{name}</strong><p>{description}</p><code>{path.replace(/^\\\\\?\\/,'')||'Not configured'}</code></div><button className="text-button" disabled={!path} onClick={()=>void invoke(name==='App data'?'open_data_folder':'open_storage_folder',{name}).catch(e=>setError(String(e)))}><FolderOpen size={15}/> Open folder</button></div>;
 return <StudioDialog title="Storage & backup" close={close}><div className="storage-panel">
  <p>Your library has two parts: original files and the information that organises them. A portable backup gathers both into one folder.</p>
  <h3>Your files</h3>
  {(lib.source_paths?.length?lib.source_paths:[['Design',lib.root]]).map(([name,path])=>location(name,path,'Original images, animations and videos. Imported references can also live outside these folders; the backup includes their tracked files too.'))}
  {location('App data',data,'library.sqlite stores names, links, tags, projects and every component-folder assignment. Home images and custom icons live here too. Cache and staging are temporary; this folder alone is not a full backup.')}
  <h3>One folder to take with you</h3>
  <p>Create a portable backup, then copy that entire dated folder to your external drive. Verify the copy before relying on it. Create a fresh backup when your library changes.</p>
  <div className="storage-actions"><button className="primary" onClick={backup}><Download size={15}/> Create backup</button><button className="subtle-button" disabled={busy} onClick={()=>void verify()}><ShieldCheck size={15}/>{busy?'Verifying…':'Verify backup'}</button><button className="subtle-button" onClick={restore}><Upload size={15}/> Restore backup</button></div>
  <p className="storage-note">Includes media, saved links, thumbnails, all folder memberships, projects, tags, Home tiles and appearance settings. Removed items, undo history, browser sessions and temporary caches are excluded. Restore merges library records and restores saved appearance; keep the restored folder in its permanent location.</p>
  {status&&<p role="status">{status}</p>}{error&&<p role="alert" className="form-error">{error}</p>}
 </div></StudioDialog>;
}
