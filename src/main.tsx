import {prepareHomeStartup} from './startup';
import {startDiagnostics,flushDiagnostics,record,recordError} from './diagnostics';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";
import {loadLibraryPreferences,flushLibraryPreferences} from "./backupPreferences";
import {getCurrentWindow} from "@tauri-apps/api/window";
import {invoke,isTauri} from "./diagnostics";
import {open} from "./nativeUi";
function Recovery({error}:{error:unknown}){const [message,setMessage]=React.useState(String(error));return <div role="alert" style={{padding:32,maxWidth:720}}><h2>Locate Your Library</h2><p>Your library could not be opened. Reconnect its drive or choose its new location.</p><pre style={{whiteSpace:"pre-wrap"}}>{message}</pre><button onClick={()=>window.location.reload()}>Try Again</button><button onClick={async()=>{try{const path=await open({directory:true,multiple:false,title:"Locate your Bit Clever Library"});if(typeof path==="string")await invoke("open_library",{path});}catch(e){setMessage(String(e));}}}>Choose Library Folder</button></div>;}
class DiagnosticBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error:Error){recordError('frontend.render_error',error);void flushDiagnostics();}
 render(){return this.state.failed?<div role="alert" style={{padding:32}}><h2>The view could not be displayed</h2><p>The error has been recorded in local diagnostics. Your saved library has not been removed.</p><button onClick={()=>location.reload()}>Reload Studio</button></div>:this.props.children;}
}
const stopDiagnostics=startDiagnostics();
if(import.meta.hot)import.meta.hot.dispose(stopDiagnostics);
const root=ReactDOM.createRoot(document.getElementById("root")!);
loadLibraryPreferences().then(async()=>{
 prepareHomeStartup();
 if(isTauri())await getCurrentWindow().onCloseRequested(async event=>{event.preventDefault();try{await flushLibraryPreferences();await flushDiagnostics();await getCurrentWindow().destroy();}catch(error){root.render(<Recovery error={error}/>);}});
 root.render(
  <React.StrictMode>
    <DiagnosticBoundary><React.Profiler id="App" onRender={(_,phase,duration,base)=>{if(duration>16)record('frontend.render','warning',duration,{phase,render_ms:duration,base_ms:base});}}><App startOnHome/></React.Profiler></DiagnosticBoundary>
  </React.StrictMode>,
);}).catch(error=>{recordError('frontend.initialise',error);root.render(<Recovery error={error}/>);});
