import {startDiagnostics,flushDiagnostics} from './diagnostics';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";
import {loadLibraryPreferences,flushLibraryPreferences} from "./backupPreferences";
import {getCurrentWindow} from "@tauri-apps/api/window";
import {invoke,isTauri} from "./diagnostics";
import {open} from "@tauri-apps/plugin-dialog";
function Recovery({error}:{error:unknown}){const [message,setMessage]=React.useState(String(error));return <div role="alert" style={{padding:32,maxWidth:720}}><h2>Locate Your Library</h2><p>Your library could not be opened. Reconnect its drive or choose its new location.</p><pre style={{whiteSpace:"pre-wrap"}}>{message}</pre><button onClick={()=>window.location.reload()}>Try Again</button><button onClick={async()=>{try{const path=await open({directory:true,multiple:false,title:"Locate your BitClever Library"});if(typeof path==="string")await invoke("open_library",{path});}catch(e){setMessage(String(e));}}}>Choose Library Folder</button></div>;}
const stopDiagnostics=startDiagnostics();
if(import.meta.hot)import.meta.hot.dispose(stopDiagnostics);
const root=ReactDOM.createRoot(document.getElementById("root")!);
loadLibraryPreferences().then(async()=>{
 if(isTauri())await getCurrentWindow().onCloseRequested(async event=>{event.preventDefault();try{await flushLibraryPreferences();await flushDiagnostics();await getCurrentWindow().destroy();}catch(error){root.render(<Recovery error={error}/>);}});
 root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);}).catch(error=>root.render(<Recovery error={error}/>));
