import {useBranding} from "./AppBranding";
import { useEffect, useState } from "react";
import { invoke } from "./diagnostics";
import { ExternalLink } from "lucide-react";
import { openUrl } from "./api";

export default function AppInfo() {
  const [branding]=useBranding();
  const [version,setVersion]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{void invoke<string>("app_version").then(setVersion).catch(()=>{});},[]);
  return <div className="setting-block">
    <span className="setting-label">Installed version</span>
    <span>{branding.name.trim() || "Bit Clever Studio"} {version || "—"}</span>
    <button className="text-button" onClick={()=>void openUrl("https://github.com/dottereldesign/Bit-Clever-Studio/releases/latest").catch(e=>setError(String(e)))}>Get latest update <ExternalLink size={12}/></button>
    {error && <small role="alert">{error}</small>}
  </div>;
}
