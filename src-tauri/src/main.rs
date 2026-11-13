#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod diagnostics;
mod browser;
mod website_capture;
mod storage;
mod clipboard;
mod content;
mod db;
mod download;
mod library;
mod resources;
mod sources;
mod thumbnail;
mod home_covers;
mod history;
mod project_folders;
mod project_files;
mod project_overview;
mod client_records;
mod studio;
mod clients;
mod calendar_sync;
mod library_export;
mod managed_library;
use db::{err, Result};
use notify::Watcher;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
use tauri::{Emitter, Manager};

struct LibraryLocation { config:PathBuf, error:Option<String> }

#[derive(Clone)]
struct State {
    db: PathBuf,
    cache: PathBuf,
    ffmpeg: PathBuf,
    downloader: PathBuf,
    downloading: Arc<AtomicBool>,
    download_cancel: Arc<AtomicBool>,
    scanning: Arc<AtomicBool>,
    media_slots: Arc<tokio::sync::Semaphore>,
    content_lock: Arc<std::sync::Mutex<()>>,
    index_progress: Arc<std::sync::Mutex<Option<content::DuplicateProgress>>>,
    exporting: Arc<AtomicBool>,
    export_cancel: Arc<AtomicBool>,
}
#[tauri::command]
async fn client_meeting_pack(id:String,destination:String,state:tauri::State<'_,State>)->Result<String>{let path=state.db.clone();tauri::async_runtime::spawn_blocking(move||clients::meeting_pack(&db::connect(&path)?,&id,std::path::Path::new(&destination))).await.map_err(err)?}
#[tauri::command]
async fn client_feed(client:Option<String>,before:Option<i64>,state:tauri::State<'_,State>)->Result<Vec<clients::Event>>{let path=state.db.clone();tauri::async_runtime::spawn_blocking(move||clients::events(&db::connect(&path)?,client.as_deref(),before,100)).await.map_err(err)?}
#[tauri::command]
fn website_capture_browsers()->Vec<website_capture::Browser>{website_capture::browsers()}
#[tauri::command]
fn website_capture_control(action:String,jobs:tauri::State<'_,website_capture::Jobs>)->Result<()>{
 if let Some(job)=jobs.0.lock().map_err(err)?.as_ref(){match action.as_str(){"cancel"=>job.cancel.store(true,Ordering::SeqCst),"continue"=>job.resume.store(true,Ordering::SeqCst),_=>return Err("Unknown capture action".into())}}Ok(())
}
#[tauri::command]
async fn capture_website(app:tauri::AppHandle,window:tauri::WebviewWindow,url:String,browser:String,on_progress:tauri::ipc::Channel<website_capture::Progress>,state:tauri::State<'_,State>,jobs:tauri::State<'_,website_capture::Jobs>)->Result<content::CaptureFile>{
 let data=state.db.parent().ok_or("Data folder unavailable")?.to_owned();
 let job=Arc::new(website_capture::Job::default());{let mut active=jobs.0.lock().map_err(err)?;if active.is_some(){return Err("A website capture is already running.".into());}*active=Some(job.clone());}
 let result=tauri::async_runtime::spawn_blocking(move||website_capture::capture(&data,&browser,&url,&job,false,&mut |p|{let _=on_progress.send(p);})).await.map_err(err);
 *jobs.0.lock().map_err(err)?=None;let _=window.set_focus();let file=result??;
 app.asset_protocol_scope().allow_file(&file.path).map_err(err)?;Ok(file)
}
#[tauri::command]
async fn website_thumbnail(id:i64,state:tauri::State<'_,State>)->Result<String>{
 let _permit=state.media_slots.clone().acquire_owned().await.map_err(err)?;
 let db=state.db.clone();let cache=state.cache.clone();tauri::async_runtime::spawn_blocking(move||{
  let conn=db::connect(&db)?;let path:String=conn.query_row("SELECT thumbnail FROM items WHERE id=? AND source='Websites' AND archived=0",[id],|r|r.get(0)).map_err(err)?;
  use sha2::{Digest,Sha256};let key=format!("{:x}",Sha256::digest(path.as_bytes()));let folder=cache.join("website-previews");std::fs::create_dir_all(&folder).map_err(err)?;let target=folder.join(format!("{key}.png"));
  if !target.is_file(){let img=image::open(&path).map_err(err)?;let height=img.height().min(img.width()*3/4).max(1);img.crop_imm(0,0,img.width(),height).thumbnail(600,450).save(&target).map_err(err)?;}
  Ok(target.to_string_lossy().into_owned())
 }).await.map_err(err)?
}
#[tauri::command]
fn open_website_screenshot(id:i64,state:tauri::State<'_,State>)->Result<()>{let db=db::connect(&state.db)?;let path:String=db.query_row("SELECT thumbnail FROM items WHERE id=? AND source='Websites' AND archived=0",[id],|r|r.get(0)).map_err(err)?;tauri_plugin_opener::open_path(path,None::<&str>).map_err(err)}
#[tauri::command]
async fn library_overview(state:tauri::State<'_,State>)->Result<managed_library::Overview>{let db=state.db.clone();tauri::async_runtime::spawn_blocking(move||managed_library::overview(&db)).await.map_err(err)?}
#[tauri::command]
async fn library_preferences(app:tauri::AppHandle)->Result<Option<serde_json::Value>>{if let Some(error)=&app.state::<LibraryLocation>().error{return Err(error.clone());}let db=app.state::<State>().db.clone();tauri::async_runtime::spawn_blocking(move||managed_library::preferences(&db)).await.map_err(err)?}
#[tauri::command]
async fn save_library_preferences(preferences:serde_json::Value,state:tauri::State<'_,State>)->Result<()>{let s=state.inner().clone();tauri::async_runtime::spawn_blocking(move||{let _guard=s.content_lock.lock().map_err(err)?;managed_library::save_preferences(&s.db,&preferences)}).await.map_err(err)?}
#[tauri::command]
async fn prepare_library(path:String,preferences:serde_json::Value,on_progress:tauri::ipc::Channel<library_export::Progress>,state:tauri::State<'_,State>)->Result<library_export::ExportResult>{
    let s=state.inner().clone();
    if s.exporting.compare_exchange(false,true,Ordering::SeqCst,Ordering::SeqCst).is_err(){return Err("A backup or migration is already running.".into());}
    s.export_cancel.store(false,Ordering::SeqCst);let active=s.exporting.clone();
    let result=tauri::async_runtime::spawn_blocking(move||{
        let _guard=s.content_lock.lock().map_err(err)?;
        let result=library_export::export_with_preferences(&s.db,std::path::Path::new(&path),"Bit Clever Library",preferences,&s.export_cancel,&mut |p|{let _=on_progress.send(p);})?;
        if !result.cancelled&&result.missing.is_empty(){managed_library::open(std::path::Path::new(&result.path))?;managed_library::verify_live(std::path::Path::new(&result.path))?;}
        Ok(result)
    }).await.map_err(err);active.store(false,Ordering::SeqCst);result?
}
#[tauri::command]
async fn open_library(path:String,app:tauri::AppHandle)->Result<()>{
    let config=app.state::<LibraryLocation>().config.clone();
    let lock=app.try_state::<State>().map(|s|s.content_lock.clone());
    tauri::async_runtime::spawn_blocking(move||{let _guard=lock.as_ref().map(|l|l.lock().map_err(err)).transpose()?;managed_library::activate(&config,std::path::Path::new(&path))}).await.map_err(err)??;
    app.restart();
}
#[tauri::command]
fn open_library_location(name:String,state:tauri::State<'_,State>)->Result<()>{
    let root=managed_library::root(&state.db)?.ok_or("Create your managed library first.")?;
    let folder=match name.as_str(){""=>root,"Design Inspo"|"App Components"|"General"|"Appearance"|"Library Data"=>root.join(name),_=>return Err("Unknown library location".into())};
    tauri_plugin_opener::open_path(folder.to_string_lossy().into_owned(),None::<&str>).map_err(err)
}
#[tauri::command]
async fn storage_usage(diagnostic_operation:Option<String>,state:tauri::State<'_,State>)->Result<storage::Usage>{
 let s=state.inner().clone();
 tauri::async_runtime::spawn_blocking(move||{let mut app_files=vec![s.ffmpeg,s.downloader];if let Ok(exe)=std::env::current_exe(){app_files.push(exe);}storage::usage_traced(&s.db,app_files,&diagnostic_operation.unwrap_or_default())}).await.map_err(err)?
}
#[tauri::command]
fn open_data_folder(state:tauri::State<'_,State>)->Result<()>{
 let folder=state.db.parent().ok_or("Data folder unavailable")?;
 tauri_plugin_opener::open_path(folder.to_string_lossy().into_owned(),None::<&str>).map_err(err)
}
#[tauri::command]
fn open_storage_folder(name:String,state:tauri::State<'_,State>)->Result<()>{
    let db=db::connect(&state.db)?;
    let (_,folder)=sources::roots(&db).into_iter().find(|(label,_)|label==&name).ok_or("Storage folder is not configured")?;
    tauri_plugin_opener::open_path(folder.to_string_lossy().into_owned(),None::<&str>).map_err(err)
}
#[tauri::command]
async fn save_home_cover(bytes:Vec<u8>,app:tauri::AppHandle,state:tauri::State<'_,State>)->Result<home_covers::Cover>{
    let data=state.db.parent().ok_or("Library folder unavailable")?.to_path_buf();
    let cover=tauri::async_runtime::spawn_blocking(move||home_covers::save(&data,&bytes)).await.map_err(err)??;
    app.asset_protocol_scope().allow_file(&cover.path).map_err(err)?;Ok(cover)
}
#[tauri::command]
fn app_version() -> &'static str { env!("CARGO_PKG_VERSION") }
#[tauri::command]
async fn export_library(path: String, name: String, preferences: Option<serde_json::Value>, on_progress: tauri::ipc::Channel<library_export::Progress>, state: tauri::State<'_, State>) -> Result<library_export::ExportResult> {
    let s=state.inner().clone();
    if s.exporting.compare_exchange(false,true,Ordering::SeqCst,Ordering::SeqCst).is_err() {return Err("A library export is already running.".into());}
    s.export_cancel.store(false,Ordering::SeqCst);
    let active=s.exporting.clone();
    let result=tauri::async_runtime::spawn_blocking(move || {let _guard=s.content_lock.lock().map_err(err)?;library_export::export_with_preferences(&s.db,std::path::Path::new(&path),&name,preferences.unwrap_or(serde_json::json!({})),&s.export_cancel,&mut |progress|{let _=on_progress.send(progress);})}).await.map_err(err);
    active.store(false,Ordering::SeqCst);
    let result=result??;
    if !result.cancelled&&result.missing.is_empty(){db::set_setting(&db::connect(&state.db)?,"last_backup",&db::now().to_string())?;}
    Ok(result)
}
#[tauri::command]
async fn verify_library_backup(path:String)->Result<library_export::Verification>{
    tauri::async_runtime::spawn_blocking(move||{let folder=std::path::Path::new(&path);if folder.join("Library Data/Library.sqlite").exists(){managed_library::verify_live(folder)}else{library_export::verify(folder)}}).await.map_err(err)?
}
#[tauri::command]
async fn backup_preferences(path:String, app:tauri::AppHandle,state:tauri::State<'_,State>)->Result<serde_json::Value>{
    let folder=PathBuf::from(path);let db=state.db.clone();let assets=managed_library::appearance(db.parent().unwrap());
    std::fs::create_dir_all(&assets).map_err(err)?;
    if assets.is_dir(){app.asset_protocol_scope().allow_directory(&assets,true).map_err(err)?;}
    let lock=state.content_lock.clone();
    tauri::async_runtime::spawn_blocking(move||{let _guard=lock.lock().map_err(err)?;let restored=library_export::restore_preferences(&folder,&db)?;if let Some(mut saved)=managed_library::preferences(&db)?{if let (Some(saved),Some(restored))=(saved.as_object_mut(),restored.as_object()){saved.extend(restored.clone());}managed_library::save_preferences(&db,&saved)?;}Ok(restored)}).await.map_err(err)?
}
#[tauri::command]
fn cancel_library_export(state: tauri::State<'_, State>) {state.export_cancel.store(true,Ordering::SeqCst);}
#[tauri::command]
async fn get_library(diagnostic_operation:Option<String>,state: tauri::State<'_, State>) -> Result<db::Library> {
    let s = state.inner().clone();
    {let queued=std::time::Instant::now();tauri::async_runtime::spawn_blocking(move || {let op=diagnostic_operation.unwrap_or_default();diagnostics::phase_event(&op,"native.library_worker_wait","success",queued.elapsed().as_secs_f64()*1000.,serde_json::json!({}));diagnostics::phase(&op,"native.library_read",||db::load(&s.db, s.scanning.load(Ordering::SeqCst)))})}
        .await
        .map_err(err)?
}
#[tauri::command]
async fn update(change: db::Change, diagnostic_operation:Option<String>, state: tauri::State<'_, State>) -> Result<()> {
    let s=state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let start=std::time::Instant::now();let operation=diagnostic_operation.unwrap_or_default();let diagnostic_action=change.action.clone();let organise_files=!matches!(change.action.as_str(),"update_studio"|"update_client_records"|"update_project_overview");
        let log=|name:&str,status:&str,duration:f64|diagnostics::record(diagnostics::Event{time:0,name:name.into(),operation:operation.clone(),status:status.into(),duration,fields:serde_json::json!({"action":diagnostic_action})});
        let _guard=s.content_lock.lock().map_err(err)?;log("native.lock_wait","success",start.elapsed().as_secs_f64()*1000.);
        diagnostics::phase(&operation,"native.database_change",||db::change(&s.db,change))?;
        if !organise_files {log("native.organise_files_skipped","success",0.);return Ok(());}
        diagnostics::phase(&operation,"native.organise_files",||managed_library::organise(&s.db))
    })
        .await
        .map_err(err)?
}
#[tauri::command]
async fn get_media(id: i64, mode: String, diagnostic_operation:Option<String>, state: tauri::State<'_, State>) -> Result<String> {
    let s = state.inner().clone();
    let operation=diagnostic_operation.unwrap_or_default();let queued=std::time::Instant::now();
    let _permit = s.media_slots.clone().acquire_owned().await.map_err(err)?;
    diagnostics::phase_event(&operation,"native.media_queue","success",queued.elapsed().as_secs_f64()*1000.,serde_json::json!({"id":id,"mode":mode}));
    tauri::async_runtime::spawn_blocking(move || {
        diagnostics::phase(&operation,"native.media_generate",||library::media(&s.db, &s.cache, &s.ffmpeg, id, &mode))
    })
    .await
    .map_err(err)?
}

#[tauri::command]
async fn project_file_details(project:i64,state:tauri::State<'_,State>)->Result<Vec<project_files::FileInfo>> {
    let db=state.db.clone();tauri::async_runtime::spawn_blocking(move||project_files::details(&db,project)).await.map_err(err)?
}
#[tauri::command]
async fn project_file_preview(id:i64,app:tauri::AppHandle,state:tauri::State<'_,State>)->Result<project_files::Preview> {
    let db=state.db.clone();let result=tauri::async_runtime::spawn_blocking(move||project_files::preview(&db,id)).await.map_err(err)??;
    if ["image","video","audio","pdf"].contains(&result.kind){app.asset_protocol_scope().allow_file(&result.path).map_err(err)?;}Ok(result)
}
#[tauri::command]
async fn open_project_file(id:i64,state:tauri::State<'_,State>)->Result<()> {
    let db=state.db.clone();tauri::async_runtime::spawn_blocking(move||project_files::open(&db,id)).await.map_err(err)?
}

fn scan_background(app: tauri::AppHandle, s: State) {
    if s.scanning.swap(true, Ordering::SeqCst) {
        return;
    }
    let scan_start=std::time::Instant::now();let operation=format!("scan-{}",diagnostics::now());
    diagnostics::phase_event(&operation,"native.scan","started",0.,serde_json::json!({}));
    let _ = app.emit("scan-started", ());
    tauri::async_runtime::spawn_blocking(move || {
        let result = (|| {let _guard=diagnostics::phase(&operation,"native.scan_lock_wait",||s.content_lock.lock().map_err(err))?;diagnostics::phase(&operation,"native.scan_files",||library::scan_all(&s.db))?;diagnostics::phase(&operation,"native.scan_organise",||managed_library::organise(&s.db))})();
        diagnostics::phase_event(&operation,"native.scan",if result.is_ok(){"success"}else{"error"},scan_start.elapsed().as_secs_f64()*1000.,serde_json::json!({}));
        s.scanning.store(false, Ordering::SeqCst);
        match result {
            Ok(_) => {
                let _ = app.emit("library-changed", ());
                let Ok(_guard) = diagnostics::phase(&operation,"native.index_lock_wait",||s.content_lock.lock().map_err(err)) else {return;};
                let index_start=std::time::Instant::now();diagnostics::phase_event(&operation,"native.fingerprint_index","started",0.,serde_json::json!({}));
                let indexed = content::index_with_progress(&s.db, &mut |mut progress| {
                    progress.phase = "indexing";
                    if let Ok(mut current) = s.index_progress.lock() {
                        *current = Some(progress);
                    }
                });
                diagnostics::phase_event(&operation,"native.fingerprint_index",if indexed.is_ok(){"success"}else{"error"},index_start.elapsed().as_secs_f64()*1000.,serde_json::json!({}));
                if let Ok(mut current) = s.index_progress.lock() {
                    *current = None;
                }
            }
            Err(e) => {
                let _ = app.emit("scan-error", e);
            }
        }
    });
}
#[tauri::command]
fn rescan(app: tauri::AppHandle, state: tauri::State<'_, State>) {
    scan_background(app, state.inner().clone());
}
#[tauri::command]
fn set_root(path: String, app: tauri::AppHandle, state: tauri::State<'_, State>) -> Result<()> {
    if managed_library::root(&state.db)?.is_some(){return Err("Use Storage & Backup to open or create a library.".into());}
    if state.scanning.load(Ordering::SeqCst) {
        return Err("Wait for the current scan to finish.".into());
    }
    let root = PathBuf::from(path).canonicalize().map_err(err)?;
    if !root.is_dir() {
        return Err("Choose a folder".into());
    }
    app.asset_protocol_scope()
        .allow_directory(&root, true)
        .map_err(err)?;
    let db = db::connect(&state.db)?;
    db::set_setting(&db, "root", &root.to_string_lossy())?;
    sources::ensure(&db)?;
    for (_, path) in sources::roots(&db) {
        app.asset_protocol_scope()
            .allow_directory(path, true)
            .map_err(err)?;
    }
    scan_background(app, state.inner().clone());
    Ok(())
}
#[tauri::command]
async fn backup(
    path: String,
    restore: bool,
    app: tauri::AppHandle,
    state: tauri::State<'_, State>,
) -> Result<()> {
    let db = state.db.clone();
    let db_path = db.clone();
    let lock=state.content_lock.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard=lock.lock().map_err(err)?;
        if restore {
            let source=PathBuf::from(path);
            if let Some(parent)=source.parent(){let folder=if parent.file_name().is_some_and(|n|n=="Library Data"){parent.parent().unwrap()}else{parent};if library_export::manifest_path(folder).exists(){library_export::verify(folder)?;}}
            db::import(&db, source)?;managed_library::organise(&db)
        } else {
            db::export(&db, PathBuf::from(path))
        }
    })
    .await
    .map_err(err)??;
    if restore {
        for item in db::load(&db_path, false)?.items {
            if !item.thumbnail.is_empty() {let _=app.asset_protocol_scope().allow_file(&item.thumbnail);}
            if item.kind != "link" {
                app.asset_protocol_scope()
                    .allow_file(&item.path)
                    .map_err(err)?;
            }
        }
    }
    Ok(())
}
#[tauri::command]
fn data_folder(state: tauri::State<'_, State>) -> String {
    state.db.parent().unwrap().to_string_lossy().into_owned()
}
#[tauri::command]
fn removed_items(state: tauri::State<'_, State>) -> Result<Vec<db::RemovedItem>> {
    db::removed_items(&state.db)
}
#[tauri::command]
async fn capture_items(input:content::Capture,state:tauri::State<'_,State>)->Result<content::CaptureResult>{
    perform_capture(input,None,state.inner().clone()).await
}
#[tauri::command]
async fn capture_items_progress(input:content::Capture,on_progress:tauri::ipc::Channel<content::DuplicateProgress>,state:tauri::State<'_,State>)->Result<content::CaptureResult>{
    perform_capture(input,Some(on_progress),state.inner().clone()).await
}
async fn perform_capture(input:content::Capture,on_progress:Option<tauri::ipc::Channel<content::DuplicateProgress>>,s:State)->Result<content::CaptureResult>{
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = s.content_lock.lock().map_err(err)?;
        let mut send=|p|{if let Some(channel)=&on_progress{let _=channel.send(p);}};
        let result=content::capture_with_progress(&s.db, input,&mut send)?;
        let mut finishing=content::DuplicateProgress::waiting();finishing.phase="finishing";send(finishing);
        managed_library::organise(&s.db)?;Ok(result)
    })
    .await
    .map_err(err)?
}
#[tauri::command]
async fn capture_screen(ratio: f64, window: tauri::WebviewWindow, app: tauri::AppHandle, state: tauri::State<'_, State>) -> Result<Option<content::CaptureFile>> {
    if !ratio.is_finite() || !(ratio == 0.0 || (0.2..=5.0).contains(&ratio)) { return Err("Invalid capture ratio".into()); }
    let data = state.db.parent().unwrap().to_path_buf();
    window.hide().map_err(err)?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        std::thread::sleep(Duration::from_millis(250));
        #[cfg(windows)] { thumbnail::capture(&data, ratio) }
        #[cfg(not(windows))] { let _ = data; Err::<Option<content::CaptureFile>,String>("Screen capture currently requires Windows.".into()) }
    }).await.map_err(err);
    let _ = window.show();
    let _ = window.set_focus();
    let file = result??;
    if let Some(file) = &file { app.asset_protocol_scope().allow_file(&file.path).map_err(err)?; }
    Ok(file)
}
#[tauri::command]
async fn crop_thumbnail(path: String, x: u32, y: u32, width: u32, height: u32, app: tauri::AppHandle, state: tauri::State<'_, State>) -> Result<content::CaptureFile> {
    let data = state.db.parent().unwrap().to_path_buf();
    let file = tauri::async_runtime::spawn_blocking(move || thumbnail::crop(&data,&path,x,y,width,height)).await.map_err(err)??;
    app.asset_protocol_scope().allow_file(&file.path).map_err(err)?;
    Ok(file)
}
#[tauri::command]
async fn replace_thumbnail(id: i64, file: content::CaptureFile, state: tauri::State<'_, State>) -> Result<()> {
    let s = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = s.content_lock.lock().map_err(err)?;
        thumbnail::replace(&s.db,id,&file)?;managed_library::refresh_browser(&s.db)
    }).await.map_err(err)?
}
#[tauri::command]
async fn download_video(input: download::Request, on_progress: tauri::ipc::Channel<download::Progress>, app: tauri::AppHandle, state: tauri::State<'_, State>) -> Result<download::Saved> {
    let s=state.inner().clone();
    if s.downloading.compare_exchange(false,true,Ordering::SeqCst,Ordering::SeqCst).is_err() { return Err("A video is already downloading.".into()); }
    s.download_cancel.store(false,Ordering::SeqCst);
    let active=s.downloading.clone();
    let result=tauri::async_runtime::spawn_blocking(move||{let _guard=s.content_lock.lock().map_err(err)?;let saved=download::run(&s.db,&s.downloader,&s.ffmpeg,input,&s.download_cancel,&mut |progress|{let _=on_progress.send(progress);})?;managed_library::organise(&s.db)?;Ok::<_,String>(saved)}).await.map_err(err);
    active.store(false,Ordering::SeqCst);
    let saved=result??;
    let _=app.emit("library-changed",());
    Ok(saved)
}
#[tauri::command]
fn cancel_video_download(state: tauri::State<'_,State>) { state.download_cancel.store(true,Ordering::SeqCst); }
#[tauri::command]
async fn read_clipboard(diagnostic_operation:Option<String>,app: tauri::AppHandle, state: tauri::State<'_, State>) -> Result<content::ClipboardContent> {
    let data = state.db.parent().unwrap().to_path_buf();
    let result = tauri::async_runtime::spawn_blocking(move || diagnostics::phase(&diagnostic_operation.unwrap_or_default(),"native.clipboard_read",||content::clipboard(&data)))
        .await
        .map_err(err)??;
    // Grant preview access only to the files the user explicitly pasted.
    for file in &result.files {
        app.asset_protocol_scope().allow_file(&file.path).map_err(err)?;
    }
    Ok(result)
}
#[tauri::command]
async fn copy_colour(hex:String)->Result<()> {
    if hex.len()!=7 || !hex.starts_with('#') || !hex[1..].bytes().all(|b|b.is_ascii_hexdigit()){return Err("Invalid colour".into());}
    tauri::async_runtime::spawn_blocking(move||arboard::Clipboard::new().map_err(err)?.set_text(hex.to_uppercase()).map_err(err)).await.map_err(err)?
}
#[tauri::command]
async fn pick_colour()->Result<Option<String>> {
    tauri::async_runtime::spawn_blocking(||{
        #[cfg(windows)] {
            use std::os::windows::process::CommandExt;
            let file=tempfile::Builder::new().prefix("bitclever-colour-").suffix(".ps1").tempfile().map_err(err)?;
            std::fs::write(file.path(),include_str!("colour-picker.ps1")).map_err(err)?;
            let output=std::process::Command::new("powershell.exe").args(["-NoLogo","-NoProfile","-NonInteractive","-STA","-ExecutionPolicy","Bypass","-File"]).arg(file.path()).creation_flags(0x08000000).output().map_err(err)?;
            if !output.status.success(){return Err(format!("Colour picker failed: {}",String::from_utf8_lossy(&output.stderr)));}
            let hex=String::from_utf8_lossy(&output.stdout).trim().to_owned();
            if hex.is_empty(){return Ok(None);}
            if hex.len()!=7 || !hex.starts_with('#') || !hex[1..].bytes().all(|b|b.is_ascii_hexdigit()){return Err("Colour picker returned an invalid colour".into());}
            Ok(Some(hex))
        }
        #[cfg(not(windows))] {Err("Screen colour picking is unavailable on this platform.".into())}
    }).await.map_err(err)?
}
#[tauri::command]
async fn copy_image(id: i64, state: tauri::State<'_, State>) -> Result<()> {
    let s = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let image = clipboard::image_data(&s.db, &s.cache, &s.ffmpeg, id)?;
        arboard::Clipboard::new()
            .map_err(err)?
            .set_image(image)
            .map_err(err)
    })
    .await
    .map_err(err)?
}
#[tauri::command]
async fn stage_web_image(url: String, state: tauri::State<'_, State>) -> Result<content::CaptureFile> {
    let data = state.db.parent().unwrap().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || content::stage_web_image(&data, &url)).await.map_err(err)?
}
#[tauri::command]
fn stage_begin(name: String, app: tauri::AppHandle, state: tauri::State<'_, State>) -> Result<content::CaptureFile> {
    let file = content::stage_begin(state.db.parent().unwrap(), &name)?;
    app.asset_protocol_scope().allow_file(&file.path).map_err(err)?;
    Ok(file)
}
#[tauri::command]
fn stage_chunk(request: tauri::ipc::Request<'_>, state: tauri::State<'_, State>) -> Result<()> {
    let token = request
        .headers()
        .get("x-capture-token")
        .and_then(|h| h.to_str().ok())
        .ok_or("Missing capture token")?;
    match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => {
            content::stage_chunk(state.db.parent().unwrap(), token, bytes)
        }
        _ => Err("Expected binary file data".into()),
    }
}
fn write_contact_sheet(path: &std::path::Path, bytes: &[u8]) -> Result<()> {
    use std::io::Write;
    if !path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("png")) {
        return Err("Choose a filename ending in .png.".into());
    }
    let mut temp = tempfile::NamedTempFile::new_in(path.parent().ok_or("Missing destination folder")?).map_err(err)?;
    temp.write_all(bytes).map_err(err)?;
    temp.persist(path).map_err(err)?;
    Ok(())
}

#[tauri::command]
async fn save_contact_sheet(app: tauri::AppHandle, request: tauri::ipc::Request<'_>) -> Result<Option<String>> {
    use tauri_plugin_dialog::DialogExt;
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) if bytes.starts_with(b"\x89PNG\r\n\x1a\n") => bytes.clone(),
        _ => return Err("Expected a PNG image.".into()),
    };
    tauri::async_runtime::spawn_blocking(move || {
        let Some(file) = app.dialog().file().add_filter("PNG image", &["png"])
            .set_file_name("Contact sheet.png").blocking_save_file() else { return Ok(None); };
        let path = file.into_path().map_err(err)?;
        write_contact_sheet(&path, &bytes)?;
        Ok(Some(path.to_string_lossy().into_owned()))
    }).await.map_err(err)?
}
#[tauri::command]
fn discard_capture(paths: Vec<String>, state: tauri::State<'_, State>) -> Result<()> {
    let staging = state.db.parent().unwrap().join("staging");
    let Ok(staging) = staging.canonicalize() else {
        return Ok(());
    };
    for path in paths {
        if let Ok(path) = PathBuf::from(path).canonicalize() {
            if path.parent() == Some(staging.as_path()) && path.is_file() {
                std::fs::remove_file(path).map_err(err)?;
            }
        }
    }
    Ok(())
}
#[tauri::command]
async fn find_duplicates(
    on_progress: tauri::ipc::Channel<content::DuplicateProgress>,
    state: tauri::State<'_, State>,
) -> Result<content::DuplicateScan> {
    let s = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _ = on_progress.send(content::DuplicateProgress::waiting());
        let _guard = loop {
            match s.content_lock.try_lock() {
                Ok(guard) => break guard,
                Err(std::sync::TryLockError::Poisoned(e)) => return Err(err(e)),
                Err(std::sync::TryLockError::WouldBlock) => {
                    if let Some(progress) = s.index_progress.lock().map_err(err)?.clone() {
                        let _ = on_progress.send(progress);
                    }
                    std::thread::sleep(Duration::from_millis(200));
                }
            }
        };
        content::duplicates_with_progress(&s.db, &mut |progress| {
            let _ = on_progress.send(progress);
        })
    })
    .await
    .map_err(err)?
}
#[tauri::command]
async fn remove_duplicates(
    keeper: i64,
    ids: Vec<i64>,
    state: tauri::State<'_, State>,
) -> Result<usize> {
    let s = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = s.content_lock.lock().map_err(err)?;
        content::remove_duplicates(&s.db, s.db.parent().unwrap(), keeper, ids)
    })
    .await
    .map_err(err)?
}
#[tauri::command]
fn duplicate_recovery(state: tauri::State<'_, State>) -> Result<Vec<content::Recovery>> {
    content::recovery(&state.db)
}
#[tauri::command]
async fn restore_duplicate(id: i64, state: tauri::State<'_, State>) -> Result<()> {
    let s = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = s.content_lock.lock().map_err(err)?;
        content::restore(&s.db, id)
    })
    .await
    .map_err(err)?
}

#[tauri::command]
fn open_external_url(url: String) -> Result<()> {
    browser::open(&url)
}

#[tauri::command]
async fn calendar_initialise(app:tauri::AppHandle,state:tauri::State<'_,State>)->Result<calendar_sync::Status>{let s=state.inner().clone();let folder=app.state::<LibraryLocation>().config.clone();tauri::async_runtime::spawn_blocking(move||{let _guard=s.content_lock.lock().map_err(err)?;calendar_sync::initialise(&folder,&s.db)?;calendar_sync::status(&folder,&s.db)}).await.map_err(err)?}
#[tauri::command]
async fn calendar_connect(url:String,app:tauri::AppHandle,state:tauri::State<'_,State>)->Result<calendar_sync::Status>{let s=state.inner().clone();let folder=app.state::<LibraryLocation>().config.clone();tauri::async_runtime::spawn_blocking(move||{let _guard=s.content_lock.lock().map_err(err)?;calendar_sync::connect(&folder,&s.db,&url)?;calendar_sync::status(&folder,&s.db)}).await.map_err(err)?}
#[tauri::command]
async fn calendar_disconnect(app:tauri::AppHandle,state:tauri::State<'_,State>)->Result<calendar_sync::Status>{let s=state.inner().clone();let folder=app.state::<LibraryLocation>().config.clone();tauri::async_runtime::spawn_blocking(move||{let _guard=s.content_lock.lock().map_err(err)?;calendar_sync::disconnect(&folder,&s.db)?;calendar_sync::status(&folder,&s.db)}).await.map_err(err)?}
#[tauri::command]
async fn calendar_feed(app:tauri::AppHandle,state:tauri::State<'_,State>)->Result<calendar_sync::Feed>{let path=state.db.clone();let folder=app.state::<LibraryLocation>().config.clone();tauri::async_runtime::spawn_blocking(move||calendar_sync::fetch(&folder,&path)).await.map_err(err)?}
#[tauri::command]
async fn calendar_apply(meetings:Vec<calendar_sync::Meeting>,generation:String,app:tauri::AppHandle,state:tauri::State<'_,State>)->Result<calendar_sync::Status>{let s=state.inner().clone();let folder=app.state::<LibraryLocation>().config.clone();tauri::async_runtime::spawn_blocking(move||{let _guard=s.content_lock.lock().map_err(err)?;calendar_sync::apply(&folder,&s.db,meetings,&generation)?;let _=app.emit("library-changed",());calendar_sync::status(&folder,&s.db)}).await.map_err(err)?}

fn main() {
    tauri::Builder::default()
        .manage(website_capture::Jobs::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data = app.path().app_local_data_dir()?;
            #[cfg(debug_assertions)]
            let data = std::env::var_os("DESIGN_VIEWER_TEST_DATA")
                .map(PathBuf::from)
                .unwrap_or(data);
            std::fs::create_dir_all(&data)?;
            diagnostics::init(&data);
            let config=data.clone();
            let selected=managed_library::selected_db(&config);
            app.manage(LibraryLocation{config:config.clone(),error:selected.as_ref().err().cloned()});
            let db_path=match selected {Ok(path)=>path,Err(_)=>{diagnostics::event("library.open","error",0.,serde_json::json!({"error_code":"library_unavailable"}));return Ok(())}};
            let library_data=db_path.parent().unwrap().to_path_buf();
            let schema_start=std::time::Instant::now();diagnostics::event("library.schema","started",0.,serde_json::json!({}));
            let schema_result=db::init(&db_path);diagnostics::event("library.schema",if schema_result.is_ok(){"success"}else{"error"},schema_start.elapsed().as_secs_f64()*1000.,serde_json::json!({}));schema_result?;
            let db = db::connect(&db_path)?;
            if managed_library::root(&db_path)?.is_none(){resources::seed(&db)?;}
            if db::setting(&db, "root").is_none() {
                if let Some(root) = library::default_root() {
                    db::set_setting(&db, "root", &root.to_string_lossy())?;
                }
            }
            if db::setting(&db, "root").is_some() {
                sources::ensure(&db)?;
                for (_, root) in sources::roots(&db) {
                    app.asset_protocol_scope().allow_directory(root, true)?;
                }
            }
            // Restored references may live outside the current source folder.
            for item in db::load(&db_path, false)?.items {
                if !item.thumbnail.is_empty() {let _=app.asset_protocol_scope().allow_file(&item.thumbnail);}
                if item.kind != "link" {
                    let _ = app.asset_protocol_scope().allow_file(&item.path);
                }
            }
            let home_covers=managed_library::appearance(&library_data);
            std::fs::create_dir_all(&home_covers)?;
            app.asset_protocol_scope().allow_directory(&home_covers,true)?;
            let thumbnails = library_data.join("link-thumbnails");
            std::fs::create_dir_all(&thumbnails)?;
            app.asset_protocol_scope().allow_directory(&thumbnails, true)?;
            let cache = data.join("cache");
            std::fs::create_dir_all(&cache)?;
            app.asset_protocol_scope().allow_directory(&cache, true)?;
            let ffmpeg = app
                .path()
                .resource_dir()?
                .join("binaries")
                .join("ffmpeg.exe");
            let state = State {
                db: db_path,
                cache,
                downloader: app.path().resource_dir()?.join("binaries").join("yt-dlp.exe"),
                downloading: Arc::new(AtomicBool::new(false)),
                download_cancel: Arc::new(AtomicBool::new(false)),
                ffmpeg,
                scanning: Arc::new(AtomicBool::new(false)),
                media_slots: Arc::new(tokio::sync::Semaphore::new(3)),
                content_lock: Arc::new(std::sync::Mutex::new(())),
                index_progress: Arc::new(std::sync::Mutex::new(None)),
                exporting: Arc::new(AtomicBool::new(false)),
                export_cancel: Arc::new(AtomicBool::new(false)),
            };
            app.manage(state.clone());
            scan_background(app.handle().clone(), state.clone());
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let (tx, rx) = std::sync::mpsc::channel();
                let Ok(mut watcher) =
                    notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
                        if let Ok(e) = event {
                            if matches!(
                                e.kind,
                                notify::EventKind::Create(_)
                                    | notify::EventKind::Modify(_)
                                    | notify::EventKind::Remove(_)
                            ) {
                                let _ = tx.send(());
                            }
                        }
                    })
                else {
                    return;
                };
                let mut watched = Vec::<PathBuf>::new();
                loop {
                    if let Ok(db) = db::connect(&state.db) {
                        let roots: Vec<PathBuf> = sources::roots(&db)
                            .into_iter()
                            .map(|(_, path)| path)
                            .collect();
                        for old in watched.iter().filter(|old| !roots.contains(old)) {
                            let _ = watcher.unwatch(old);
                        }
                        watched.retain(|old| roots.contains(old));
                        for root in roots {
                            if !watched.contains(&root)
                                && watcher
                                    .watch(&root, notify::RecursiveMode::Recursive)
                                    .is_ok()
                            {
                                watched.push(root);
                            }
                        }
                    }
                    if rx.recv_timeout(Duration::from_secs(2)).is_ok() {
                        // Collapse bursts of file-copy events; a quiet interval starts one scan.
                        while rx.recv_timeout(Duration::from_millis(700)).is_ok() {}
                        scan_background(handle.clone(), state.clone());
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            calendar_initialise,calendar_connect,calendar_disconnect,calendar_feed,calendar_apply,diagnostics::diagnostics_record,diagnostics::diagnostics_read,diagnostics::diagnostics_folder,diagnostics::diagnostics_export,
            website_capture_browsers,website_capture_control,capture_website,website_thumbnail,open_website_screenshot,
            client_feed,
            client_meeting_pack,
            library_overview,
            library_preferences,
            save_library_preferences,
            prepare_library,
            open_library,
            open_library_location,
            storage_usage,
            open_storage_folder,
            open_data_folder,
            save_home_cover,
            open_external_url,
            app_version,
            save_contact_sheet,
            export_library,
            verify_library_backup,
            backup_preferences,
            cancel_library_export,
            get_library,
            update,
            get_media,
            project_file_details,
            project_file_preview,
            open_project_file,
            rescan,
            set_root,
            backup,
            data_folder,
            removed_items,
            capture_items,
            capture_items_progress,
            capture_screen,
            crop_thumbnail,
            replace_thumbnail,
            download_video,
            cancel_video_download,
            read_clipboard,copy_colour,pick_colour,
            copy_image,
            stage_begin,
            stage_web_image,
            stage_chunk,
            discard_capture,
            find_duplicates,
            remove_duplicates,
            duplicate_recovery,
            restore_duplicate
        ])
        .build(tauri::generate_context!())
        .expect("Could not start Design")
        .run(|_,event|{if matches!(event,tauri::RunEvent::Exit){diagnostics::shutdown();}});
}

#[cfg(test)]
mod tests;
