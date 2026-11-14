use base64::Engine;
use std::io::Cursor;
use tauri::Manager;

fn decode_logo(logo: Option<&str>) -> Result<image::RgbaImage, String> {
    let bytes = match logo {
        Some(value) => {
            if value.len() > 1_000_000 { return Err("Logo is too large".into()); }
            let encoded = value.strip_prefix("data:image/png;base64,").ok_or("Expected a PNG logo")?;
            base64::engine::general_purpose::STANDARD.decode(encoded).map_err(|e| e.to_string())?
        }
        None => include_bytes!("../icons/icon.png").to_vec(),
    };
    let mut reader = image::ImageReader::with_format(Cursor::new(bytes), image::ImageFormat::Png);
    let mut limits = image::Limits::default();
    limits.max_image_width=Some(1024); limits.max_image_height=Some(1024); limits.max_alloc=Some(16*1024*1024);
    reader.limits(limits);
    Ok(reader.decode().map_err(|e|e.to_string())?.thumbnail(256,256).to_rgba8())
}

#[tauri::command]
pub async fn apply_app_branding(app:tauri::AppHandle, window:tauri::WebviewWindow, name:String, logo:Option<String>, shortcut:bool)->Result<(),String>{
    let name=name.trim().to_string();
    if name.is_empty() || name.chars().count()>64 || name.chars().any(char::is_control){return Err("Enter an app name of 1–64 characters".into());}
    let pixels=tauri::async_runtime::spawn_blocking(move||decode_logo(logo.as_deref())).await.map_err(|e|e.to_string())??;
    window.set_title(&name).map_err(|e|e.to_string())?;
    window.set_icon(tauri::image::Image::new_owned(pixels.clone().into_raw(),pixels.width(),pixels.height())).map_err(|e|e.to_string())?;
    if shortcut {tauri::async_runtime::spawn_blocking(move||save_shortcut(&app,&name,&pixels)).await.map_err(|e|e.to_string())??;}
    Ok(())
}

#[cfg(windows)]
fn save_shortcut(app:&tauri::AppHandle,name:&str,pixels:&image::RgbaImage)->Result<(),String>{
    use sha2::{Digest,Sha256};
    let folder=app.path().app_data_dir().map_err(|e|e.to_string())?.join("branding");
    std::fs::create_dir_all(&folder).map_err(|e|e.to_string())?;
    let hash=format!("{:x}",Sha256::digest(pixels.as_raw()));
    let icon=folder.join(format!("{}.ico",&hash[..16]));
    if !icon.exists(){pixels.save_with_format(&icon,image::ImageFormat::Ico).map_err(|e|e.to_string())?;}
    let desktop=app.path().desktop_dir().map_err(|e|e.to_string())?;
    let safe:String=name.chars().map(|c|if "<>:\"/\\|?*".contains(c){'_'}else{c}).collect();
    // The prefix prevents reserved Windows device names; never overwrite an unrelated shortcut.
    let suffix=if cfg!(debug_assertions){" (Dev)"}else{""};
    let path=desktop.join(format!("Studio - {}{}.lnk",safe.trim_end_matches([' ','.']),suffix));
    let ownership=folder.join(if cfg!(debug_assertions){"shortcut-dev.json"}else{"shortcut.json"});
    let previous:Option<String>=std::fs::read_to_string(&ownership).ok().and_then(|s|serde_json::from_str(&s).ok());
    if path.exists() && previous.as_deref()!=path.to_str(){return Err("A shortcut with that name already exists. Choose another app name.".into());}
    let (target,args,working)=if cfg!(debug_assertions){
        let root=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent().ok_or("Missing development folder")?;
        let launcher=root.join("scripts/start-dev.ps1");
        if !launcher.exists(){return Err("Development launcher is missing".into());}
        (std::env::var("SystemRoot").unwrap_or_else(|_|"C:\\Windows".into())+"\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",format!("-NoProfile -ExecutionPolicy Bypass -File \"{}\"",launcher.display()),root.to_string_lossy().into_owned())
    }else{let exe=std::env::current_exe().map_err(|e|e.to_string())?;(exe.to_string_lossy().into_owned(),String::new(),exe.parent().ok_or("Missing app directory")?.to_string_lossy().into_owned())};
    write_shortcut(&folder,&serde_json::json!({"path":path,"target":target,"arguments":args,"working":working,"icon":icon}))?;
    std::fs::write(&ownership,serde_json::to_vec(&path.to_string_lossy()).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    if let Some(old)=previous{let old=std::path::PathBuf::from(old);if old!=path && old.parent()==Some(desktop.as_path()) && old.extension().and_then(|s|s.to_str())==Some("lnk") && old.file_name().is_some_and(|s|s.to_string_lossy().starts_with("Studio - ")){std::fs::remove_file(old).map_err(|e|e.to_string())?;}}
    Ok(())
}
#[cfg(windows)]
fn write_shortcut(folder:&std::path::Path,data:&serde_json::Value)->Result<(),String>{
    use std::os::windows::process::CommandExt;
    let input=folder.join("shortcut-input.json");
    std::fs::write(&input,serde_json::to_vec(data).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    let script=folder.join("update-shortcut.ps1");
    std::fs::write(&script,r#"param([string]$InputPath)
$ErrorActionPreference='Stop'
$d=Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json
$s=(New-Object -ComObject WScript.Shell).CreateShortcut($d.path)
$s.TargetPath=$d.target
$s.Arguments=$d.arguments
$s.WorkingDirectory=$d.working
$s.IconLocation=$d.icon + ',0'
$s.Save()
"#).map_err(|e|e.to_string())?;
    let output=std::process::Command::new("powershell.exe").args(["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File"]).arg(&script).arg(&input).creation_flags(0x08000000).output().map_err(|e|e.to_string())?;
    if !output.status.success(){return Err("Windows could not save the desktop shortcut".into());}
    Ok(())
}
#[cfg(not(windows))]
fn save_shortcut(_: &tauri::AppHandle,_:&str,_:&image::RgbaImage)->Result<(),String>{Err("Desktop branding is available on Windows".into())}
#[cfg(test)]
mod tests{use super::*;#[test]fn logo_validation(){assert!(decode_logo(None).is_ok());assert!(decode_logo(Some("data:image/svg+xml,bad")).is_err());assert!(decode_logo(Some("data:image/png;base64,AA==")).is_err());let image=decode_logo(None).unwrap();assert!(image.width()<=256&&image.height()<=256);}}

#[cfg(all(test,windows))]
#[test]
fn windows_shortcut_is_created_in_isolated_folder(){
    let folder=tempfile::tempdir().unwrap();
    let path=folder.path().join("Studio - Test & Co.lnk");
    let icon=folder.path().join("test.ico");
    decode_logo(None).unwrap().save_with_format(&icon,image::ImageFormat::Ico).unwrap();
    let target=std::env::current_exe().unwrap();
    write_shortcut(folder.path(),&serde_json::json!({"path":path,"target":target,"arguments":"","working":folder.path(),"icon":icon})).unwrap();
    assert!(std::fs::metadata(path).unwrap().len()>0);
}
