use crate::db::{self, err, Backup, Result};
use serde::{Serialize, Deserialize};
use sha2::{Digest, Sha256};
use std::{fs, io::{Read, Write}, path::{Path, PathBuf}, sync::atomic::{AtomicBool, Ordering}, time::{Duration, Instant}};

#[derive(Clone, Serialize)]
pub struct Progress {
    pub phase: &'static str,
    pub copied_bytes: u64,
    pub total_bytes: u64,
    pub completed_files: usize,
    pub total_files: usize,
    pub current: String,
}
#[derive(Debug, Serialize)]
pub struct ExportResult {
    pub path: String,
    pub files: usize,
    pub links: usize,
    pub missing: Vec<String>,
    pub cancelled: bool,
}
#[derive(Serialize, Deserialize)]
struct Entry { path: String, bytes: u64, sha256: String }
struct CopyJob { source: PathBuf, relative: String, size: u64 }

pub fn metadata_path(folder:&Path)->PathBuf {let path=folder.join("Library Data/library.json");if path.exists(){path}else{folder.join("library.json")}}
pub fn manifest_path(folder:&Path)->PathBuf {let path=folder.join("Library Data/manifest.json");if path.exists(){path}else{folder.join("manifest.json")}}
pub fn preferences_path(folder:&Path)->PathBuf {let path=folder.join("Library Data/preferences.json");if path.exists(){path}else{folder.join("preferences.json")}}
pub fn collection(item:&db::Item)->&'static str {
    if item.project_only{return "General";}
    if item.category.as_deref().is_some_and(|c|c.starts_with("Components / ")) || !item.component_folders.is_empty(){"App Components"}
    else if item.kind=="link" || item.source=="Videos" || item.source.starts_with("Videos/") || item.source=="General" || item.source.starts_with("General/"){"General"}
    else {"Design Inspo"}
}
pub fn allocate_filename(title:&str,source:&Path,group:&str,used:&mut std::collections::HashSet<String>)->String {
    let extension=source.extension().and_then(|x|x.to_str()).unwrap_or("bin").to_ascii_lowercase();
    let mut stem=title.trim().to_owned();
    if stem.is_empty(){stem=source.file_stem().unwrap_or_default().to_string_lossy().into_owned();}
    if stem.to_lowercase().starts_with("clipboard-") || stem.to_lowercase().starts_with("web image-"){stem="Saved Image".into();}
    let mut stem=safe_name(&stem);
    if ["CON","PRN","AUX","NUL","COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9","LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9"].contains(&stem.split('.').next().unwrap_or("").to_ascii_uppercase().as_str()){stem=format!("Saved {stem}");}
    let mut candidate=format!("{stem}.{extension}");let mut n=2;
    while !used.insert(format!("{group}/{candidate}").to_lowercase()){candidate=format!("{stem} ({n}).{extension}");n+=1;}
    candidate
}
fn display_folder(name:&str,preferences:&serde_json::Value)->String{
    if let Some(label)=preferences["folder-labels"][name].as_str(){return label.to_owned();}
    if ["Components / Headers","Components / Header","Components / Heroes","Components / Hero"].contains(&name){return "Header".into();}
    name.trim_start_matches("Components / ").replace('_'," ").split_whitespace().map(|w|{
        if ["ui","ux","ai","3d","2d","html","css","faqs"].contains(&w.to_lowercase().as_str()){if w.eq_ignore_ascii_case("faqs"){"FAQs".into()}else{w.to_uppercase()}}
        else {let mut chars=w.chars();match chars.next(){Some(c)=>c.to_uppercase().collect::<String>()+chars.as_str(),None=>String::new()}}
    }).collect::<Vec<_>>().join(" ")
}
pub fn write_browser(output:&Path,library:&db::Library,preferences:&serde_json::Value)->Result<()> {
    let mut html=String::from(r#"<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Bit Clever Library</title><style>body{margin:32px;background:#f6f7f3;color:#26352b;font:15px system-ui}header{display:flex;gap:16px;align-items:center;flex-wrap:wrap}h1{font-size:24px;margin-right:auto}input,select{padding:10px;border:1px solid #d3d9ce;border-radius:8px;background:white}main{columns:280px;column-gap:16px;margin-top:24px}article{break-inside:avoid;background:white;border-radius:10px;margin-bottom:16px;padding:12px}article[hidden]{display:none}img,video{width:100%;max-height:500px;object-fit:contain;border-radius:6px}a{color:inherit;overflow-wrap:anywhere}small{display:block;color:#657263;margin-top:6px}button{border:0;border-radius:5px;margin:4px 4px 0 0;padding:5px;background:#e7ecdf;cursor:pointer}</style><header><h1>Bit Clever Library</h1><input id="search" aria-label="Search library" placeholder="Search library"><select id="section" aria-label="Collection"><option value="">All Collections</option><option>Design Inspo</option><option>App Components</option><option>General</option></select><select id="folder" aria-label="Folder"><option value="">All Folders</option></select></header><main>"#);
    for item in &library.items {
        let mut sections=vec![collection(item)];
        if !item.project_only&&item.kind!="link"&&(!item.design_folders.is_empty()||item.category.as_deref().is_some_and(|c|!c.starts_with("Components / ")))&& !sections.contains(&"Design Inspo"){sections.push("Design Inspo");}
        for section in sections {
        let mut folders=if section=="App Components"{item.component_folders.clone()}else{item.design_folders.clone()};
        if let Some(c)=&item.category {if (c.starts_with("Components / ")== (section=="App Components"))&&c!="Components / Uncategorised"&&!folders.contains(c){folders.push(c.clone());}}
        if folders.iter().any(|f|!f.is_empty()&&f!="Components / Uncategorised"){folders.retain(|f|!f.is_empty()&&f!="Components / Uncategorised");}
        if folders.is_empty(){folders.push(String::new());}
        let mut labels:Vec<String>=folders.iter().map(|f|if f.is_empty()||f=="Components / Uncategorised"{"Uncategorised".into()}else{display_folder(f,preferences)}).collect();
        labels.sort();labels.dedup();
        let names=serde_json::to_string(&labels).map_err(err)?;
        let url=if item.kind=="link" {if db::valid_url(&item.path).is_err(){continue;}item.path.clone()}else{item.path.split('/').map(|s|url::form_urlencoded::byte_serialize(s.as_bytes()).collect::<String>().replace('+',"%20")).collect::<Vec<_>>().join("/")};
        html.push_str(&format!("<article data-section=\"{}\" data-folders=\"{}\"><a href=\"{}\">",section,escape(&names),escape(&url)));
        if item.kind=="video"{html.push_str(&format!("<video controls preload=\"none\" src=\"{}\"></video>",escape(&url)));}
        else if item.kind!="link"&&!item.missing{html.push_str(&format!("<img loading=\"lazy\" src=\"{}\" alt=\"{}\">",escape(&url),escape(&item.name)));}
        html.push_str(&format!("<div>{}</div></a><small>{}</small>",escape(&item.name),section));
        for label in labels{html.push_str(&format!("<button type=\"button\">{}</button>",escape(&label)));}
        html.push_str("</article>");
        }
    }
    html.push_str(r#"</main><script>const cards=[...document.querySelectorAll('article')],search=document.getElementById('search'),section=document.getElementById('section'),folder=document.getElementById('folder');function folders(){const previous=folder.value;folder.replaceChildren(new Option('All Folders',''));[...new Set(cards.filter(c=>!section.value||c.dataset.section===section.value).flatMap(c=>JSON.parse(c.dataset.folders)))].sort((a,b)=>a.localeCompare(b)).forEach(f=>folder.add(new Option(f,f)));folder.value=[...folder.options].some(o=>o.value===previous)?previous:'';}function filter(){cards.forEach(c=>c.hidden=!!((section.value&&c.dataset.section!==section.value)||(folder.value&&!JSON.parse(c.dataset.folders).includes(folder.value))||!c.textContent.toLowerCase().includes(search.value.toLowerCase())));}section.onchange=()=>{folders();filter()};folder.onchange=filter;search.oninput=filter;document.querySelectorAll('article button').forEach(b=>b.onclick=()=>{section.value=b.closest('article').dataset.section;folders();folder.value=b.textContent;filter()});folders();</script></html>"#);
    fs::write(output.join("Browse Library.html"),html).map_err(err)
}

pub(crate) fn checksum(path: &Path) -> Result<String> {
    let mut file=fs::File::open(path).map_err(err)?;
    let mut hash=Sha256::new();let mut buffer=[0u8;65536];
    loop {let n=file.read(&mut buffer).map_err(err)?;if n==0 {break;}hash.update(&buffer[..n]);}
    Ok(format!("{:x}",hash.finalize()))
}

// Only app-owned appearance files are followed; preferences cannot select arbitrary files.
fn pack_assets(value: &mut serde_json::Value, data: &Path, jobs: &mut Vec<CopyJob>, missing: &mut Vec<String>) -> Result<()> {
    match value {
        serde_json::Value::String(text) if Path::new(text).is_absolute()=>{
            let source=PathBuf::from(&*text);
            let owned=crate::managed_library::appearance(data);
            if !source.starts_with(&owned) {return Err("An appearance setting references a file outside the app-owned appearance folder.".into());}
            let relative=format!("Appearance/{}",safe_name(source.file_name().and_then(|s|s.to_str()).unwrap_or("cover.png")));
            if let Ok(meta)=fs::metadata(&source) {
                if !source.canonicalize().map_err(err)?.starts_with(owned.canonicalize().map_err(err)?) {return Err("Appearance file points outside app data.".into());}
                if !jobs.iter().any(|j|j.relative==relative) {jobs.push(CopyJob{source,relative:relative.clone(),size:meta.len()});}
            } else {missing.push(format!("{} — appearance image unavailable",source.display()));}
            *text=relative;
        },
        serde_json::Value::Array(values)=>for v in values {pack_assets(v,data,jobs,missing)?;},
        serde_json::Value::Object(values)=>for v in values.values_mut(){pack_assets(v,data,jobs,missing)?;},
        _=>{}
    }
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct Verification {pub files:usize,pub missing:Vec<String>}
pub fn verify(folder:&Path)->Result<Verification>{
    if folder.join("INCOMPLETE.txt").exists(){return Err("This backup is incomplete. Keep your originals and create a new backup.".into());}
    let manifest:serde_json::Value=serde_json::from_slice(&fs::read(manifest_path(folder)).map_err(err)?).map_err(err)?;
    let entries:Vec<Entry>=serde_json::from_value(manifest["files"].clone()).map_err(err)?;
    if !metadata_path(folder).is_file(){return Err("The library metadata is missing.".into());}
    for entry in &entries {
        let path=PathBuf::from(resolve_relative(folder,&entry.path)?);
        if !path.is_file() || fs::metadata(&path).map_err(err)?.len()!=entry.bytes || checksum(&path)?!=entry.sha256 {
            return Err(format!("Backup file is missing or changed: {}",entry.path));
        }
    }
    Ok(Verification{files:entries.len(),missing:serde_json::from_value(manifest["missing"].clone()).map_err(err)?})
}

pub fn restore_preferences(folder:&Path, db_path:&Path)->Result<serde_json::Value>{
    let file=preferences_path(folder);
    if !file.exists(){return Ok(serde_json::json!({}));}
    let mut value:serde_json::Value=serde_json::from_slice(&fs::read(file).map_err(err)?).map_err(err)?;
    let backup:Backup=serde_json::from_slice(&fs::read(metadata_path(folder)).map_err(err)?).map_err(err)?;
    let current=db::load(db_path,false)?;
    let projects:std::collections::HashMap<String,String>=backup.library.projects.iter().filter_map(|old|current.projects.iter().find(|p|p.name==old.name).map(|new|(old.id.to_string(),new.id.to_string()))).collect();
    fn rewrite(value:&mut serde_json::Value,folder:&Path,data:&Path,projects:&std::collections::HashMap<String,String>)->Result<()> {
        match value {
            serde_json::Value::String(s) if s.starts_with("Appearance/")=>{
                let source=PathBuf::from(resolve_relative(folder,s)?);
                if source.is_file(){
                    let assets=crate::managed_library::appearance(data);
                    let target=if source.starts_with(&assets){source.clone()}else{assets.join(format!("restored-{}.{}",checksum(&source)?,source.extension().and_then(|s|s.to_str()).unwrap_or("png")))};
                    fs::create_dir_all(target.parent().unwrap()).map_err(err)?;
                    if !target.exists(){fs::copy(&source,&target).map_err(err)?;}
                    if checksum(&source)?!=checksum(&target)?{return Err("Restored appearance image failed verification.".into());}
                    *s=target.to_string_lossy().into_owned();
                } else {*s=source.to_string_lossy().into_owned();}
            },
            serde_json::Value::String(s) if s.starts_with("project:")=>{if let Some(id)=projects.get(&s[8..]){*s=format!("project:{id}");}},
            serde_json::Value::Array(values)=>for v in values{rewrite(v,folder,data,projects)?;},
            serde_json::Value::Object(values)=>{
                if values.get("kind").and_then(|v|v.as_str())==Some("project") {
                    if let Some(id)=values.get("value").and_then(|v|v.as_str()).and_then(|id|projects.get(id)).cloned(){values.insert("value".into(),id.into());}
                }
                let old=std::mem::take(values);
                for (mut key,mut v) in old {if let Some(id)=key.strip_prefix("project:").and_then(|id|projects.get(id)){key=format!("project:{id}");}rewrite(&mut v,folder,data,projects)?;values.insert(key,v);}
            },_=>{}
        }Ok(())
    }
    // A deleted project's old ID must never attach a colour to an unrelated project on restore.
    if let Some(colours)=value.get_mut("colour-history").and_then(|v|v.as_array_mut()) {
        for colour in colours {if let Some(ids)=colour.get_mut("projects").and_then(|v|v.as_array_mut()) {
            ids.retain(|id|id.as_str().and_then(|s|s.strip_prefix("project:")).is_some_and(|id|projects.contains_key(id)));
        }}
    }
    rewrite(&mut value,folder,db_path.parent().ok_or("Missing app data folder")?,&projects)?;
    Ok(value)
}

pub(crate) fn safe_name(name: &str) -> String {
    let value: String = name.chars().map(|c| if c.is_control() || "<>:\"/\\|?*".contains(c) {'_'} else {c}).take(110).collect();
    let value=value.trim().trim_matches('.');
    if value.is_empty() { "file".into() } else {value.to_owned()}
}
pub(crate) fn escape(value: &str) -> String { value.replace('&',"&amp;").replace('<',"&lt;").replace('>',"&gt;").replace('"',"&quot;").replace('\'',"&#39;") }
fn csv(value: &str) -> String {
    let value=if value.starts_with(['=', '+', '-', '@', '\t', '\r', '\n']) {format!("'{value}")} else {value.to_owned()};
    format!("\"{}\"",value.replace('"',"\"\""))
}

// Portable backups resolve relative paths against the JSON's own directory,
// never the working directory. Reject traversal and links outside the bundle.
pub fn resolve_relative(base: &Path, value: &str) -> Result<String> {
    let path=Path::new(value);
    if path.is_absolute() || path.components().any(|p| !matches!(p,std::path::Component::Normal(_))) {
        return Err("Invalid path in portable backup.".into());
    }
    let joined=base.join(path);
    if joined.exists() && !joined.canonicalize().map_err(err)?.starts_with(base.canonicalize().map_err(err)?) {
        return Err("A portable backup file points outside its folder.".into());
    }
    Ok(joined.to_string_lossy().into_owned())
}

#[cfg(test)]
pub fn export(db_path: &Path, destination: &Path, name: &str, cancel: &AtomicBool, progress: &mut impl FnMut(Progress)) -> Result<ExportResult> {
    export_with_preferences(db_path,destination,name,serde_json::json!({}),cancel,progress)
}

pub fn export_with_preferences(db_path: &Path, destination: &Path, name: &str, mut preferences: serde_json::Value, cancel: &AtomicBool, progress: &mut impl FnMut(Progress)) -> Result<ExportResult> {
    let destination=destination.canonicalize().map_err(err)?;
    if !destination.is_dir() {return Err("Choose a backup folder.".into());}
    let conn=db::connect(db_path)?;
    for (_,root) in crate::sources::roots(&conn) {
        if let Ok(root)=root.canonicalize() {if destination.starts_with(root) {return Err("Choose a backup location outside your media folders.".into());}}
    }
    if destination.starts_with(db_path.parent().ok_or("Missing data folder")?.canonicalize().map_err(err)?) {
        return Err("Choose a backup location outside Design's app data.".into());
    }
    let mut output=destination.join(safe_name(name));
    let mut number=2;while output.exists(){output=destination.join(format!("{} ({number})",safe_name(name)));number+=1;}
    fs::create_dir(&output).map_err(err)?;
    fs::write(output.join("INCOMPLETE.txt"),"This backup did not finish. Keep your originals. A complete backup has library.json and manifest.json.\n").map_err(err)?;
    let result=run(&conn,&output,db_path.parent().unwrap(),&mut preferences,cancel,progress);
    result.map_err(|e|format!("{e}\nPartial backup: {}",output.display()))
}

fn run(conn: &rusqlite::Connection, output: &Path, data: &Path, preferences: &mut serde_json::Value, cancel: &AtomicBool, progress: &mut impl FnMut(Progress)) -> Result<ExportResult> {
    let mut status=Progress{phase:"preparing",copied_bytes:0,total_bytes:0,completed_files:0,total_files:0,current:String::new()};
    progress(status.clone());
    // SQLite's backup API takes a consistent snapshot, including live WAL data.
    let snapshot=output.join("metadata.snapshot.sqlite");
    conn.backup("main",&snapshot,None).map_err(err)?;
    let mut library=db::load(&snapshot,false)?;
    for suffix in ["", "-wal", "-shm"] {let path=output.join(format!("metadata.snapshot.sqlite{suffix}"));if path.exists(){fs::remove_file(path).map_err(err)?;}}
    fs::create_dir_all(output.join("Library Data")).map_err(err)?;
    let mut used=std::collections::HashSet::new();
    let mut jobs=vec![];
    let mut missing=vec![];
    let mut links=0;
    pack_assets(preferences,data,&mut jobs,&mut missing)?;
    for item in &mut library.items {
        if cancel.load(Ordering::SeqCst) {return Ok(ExportResult{path:output.to_string_lossy().into_owned(),files:0,links,missing,cancelled:true});}
        if item.kind=="link" {links+=1;} else {
            let source=PathBuf::from(&item.path);
            let group=collection(item);
            let file_name=allocate_filename(&item.name,&source,group,&mut used);
            let relative=format!("{group}/{file_name}");
            match fs::metadata(&source) {
                Ok(meta) if meta.is_file()=>{jobs.push(CopyJob{source,relative:relative.clone(),size:meta.len()});item.missing=false;},
                _=>{missing.push(format!("{} — original unavailable",item.name));item.missing=true;}
            }
            item.path=relative;
        }
        if !item.thumbnail.is_empty() {
            let source=PathBuf::from(&item.thumbnail);
            let file_name=safe_name(source.file_name().and_then(|s|s.to_str()).unwrap_or("thumbnail.png"));
            let relative=format!("Library Data/Thumbnails/{:08}-{file_name}",item.id);
            match fs::metadata(&source) {
                Ok(meta) if meta.is_file()=>jobs.push(CopyJob{source,relative:relative.clone(),size:meta.len()}),
                _=>missing.push(format!("{} — thumbnail unavailable",item.name)),
            }
            item.thumbnail=relative;
        }
    }
    for group in ["Design Inspo","App Components","General","Appearance"] {fs::create_dir_all(output.join(group)).map_err(err)?;}
    library.root="Design Inspo".into();
    library.source_paths=[("Design","Design Inspo"),("App Components","App Components"),("General","General")].into_iter().map(|(key,name)|(key.to_owned(),name.to_owned())).collect();
    library.undo_label=None;library.undo_count=0;library.redo_label=None;library.redo_count=0;library.scanning=false;
    status.total_files=jobs.len();status.total_bytes=jobs.iter().map(|job|job.size).sum();status.phase="copying";
    progress(status.clone());
    let mut entries=vec![];
    let mut last=Instant::now();
    let mut buffer=vec![0u8;1024*1024];
    for job in jobs {
        status.current=job.source.file_name().unwrap_or_default().to_string_lossy().into_owned();
        let target=output.join(&job.relative);
        fs::create_dir_all(target.parent().unwrap()).map_err(err)?;
        let temporary=target.with_extension("part");
        let mut source=fs::File::open(&job.source).map_err(|e|format!("Could not read {}: {e}",status.current))?;
        let before=source.metadata().map_err(err)?;
        let mut writer=fs::OpenOptions::new().write(true).create_new(true).open(&temporary).map_err(err)?;
        let mut hash=Sha256::new();
        let mut bytes=0;
        loop {
            if cancel.load(Ordering::SeqCst) {
                drop(writer);fs::remove_file(&temporary).map_err(err)?;
                status.phase="cancelled";progress(status.clone());
                return Ok(ExportResult{path:output.to_string_lossy().into_owned(),files:status.completed_files,links,missing,cancelled:true});
            }
            let read=source.read(&mut buffer).map_err(err)?;
            if read==0 {break;}
            writer.write_all(&buffer[..read]).map_err(err)?;hash.update(&buffer[..read]);
            bytes+=read as u64;status.copied_bytes+=read as u64;
            if last.elapsed()>=Duration::from_millis(100) {progress(status.clone());last=Instant::now();}
        }
        let after=source.metadata().map_err(err)?;
        if bytes!=job.size || before.len()!=after.len() || before.modified().ok()!=after.modified().ok() {return Err(format!("{} changed during export. Try again.",status.current));}
        writer.sync_all().map_err(err)?;drop(writer);
        fs::rename(&temporary,&target).map_err(err)?;
        let expected=format!("{:x}",hash.finalize());
        if checksum(&target)? != expected {return Err(format!("Backup verification failed: {}",job.relative));}
        entries.push(Entry{path:job.relative,bytes,sha256:expected});
        status.completed_files+=1;progress(status.clone());
    }
    if cancel.load(Ordering::SeqCst) {
        status.phase="cancelled";progress(status.clone());
        return Ok(ExportResult{path:output.to_string_lossy().into_owned(),files:status.completed_files,links,missing,cancelled:true});
    }
    status.phase="finishing";status.current.clear();progress(status.clone());
    let mut html=String::from("<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><title>Design saved links</title><style>body{max-width:900px;margin:40px auto;padding:0 20px;font:16px system-ui;line-height:1.6}li{margin:14px 0}small{color:#666}</style><h1>Saved links</h1><p>All saved links from your Design library.</p><ul>");
    let mut table=String::from("Name,Collection,URL,Source URL\r\n");
    for item in library.items.iter().filter(|i|i.kind=="link") {
        let name=escape(&item.name);let url=escape(&item.path);let collection=escape(&item.source);
        if db::valid_url(&item.path).is_ok() {html.push_str(&format!("<li><a href=\"{url}\">{name}</a><br><small>{collection} · {url}</small></li>"));}
        else {html.push_str(&format!("<li>{name}<br><small>{url}</small></li>"));}
        table.push_str(&format!("{},{},{},{}\r\n",csv(&item.name),csv(&item.source),csv(&item.path),csv(&item.source_url)));
    }
    html.push_str("</ul></html>");
    fs::write(output.join("Library Data/links.html"),html).map_err(err)?;
    fs::write(output.join("Library Data/links.csv"),table).map_err(err)?;

    write_browser(output,&library,preferences)?;
    fs::write(output.join("Read Me.txt"),"BIT CLEVER LIBRARY BACKUP\n\nDesign Inspo/ and App Components/ contain originals, stored once per item. General/ holds other collections. Appearance/ holds custom images. Library Data/ preserves every folder membership, project, tag, saved link and setting.\n\nOpen Browse Library.html to browse offline. In Bit Clever, choose Storage > Open Existing Library to use this folder separately, or Merge Backup to add it to your current library.\n\nCopy this ENTIRE folder to an external drive and Verify Backup on that copy. INCOMPLETE.txt means the backup did not finish. Review unavailable files before relying on a backup. Removed items, undo history, browser sessions and caches are excluded. Keep another copy on a separate drive or location.\n").map_err(err)?;
    fs::write(output.join("Library Data/library.json.part"),serde_json::to_vec_pretty(&Backup{version:1,portable:true,library}).map_err(err)?).map_err(err)?;
    fs::rename(output.join("Library Data/library.json.part"),output.join("Library Data/library.json")).map_err(err)?;
    fs::write(output.join("Library Data/preferences.json"),serde_json::to_vec_pretty(preferences).map_err(err)?).map_err(err)?;
    for name in ["Library Data/library.json","Library Data/preferences.json","Library Data/links.html","Library Data/links.csv","Read Me.txt","Browse Library.html"] {
        let path=output.join(name);
        fs::OpenOptions::new().write(true).open(&path).map_err(err)?.sync_all().map_err(err)?;
        entries.push(Entry{path:name.into(),bytes:fs::metadata(&path).map_err(err)?.len(),sha256:checksum(&path)?});
    }
    fs::write(output.join("Library Data/manifest.json"),serde_json::to_vec_pretty(&serde_json::json!({"version":3,"files":entries,"missing":missing,"links":links})).map_err(err)?).map_err(err)?;
    fs::OpenOptions::new().write(true).open(output.join("Library Data/manifest.json")).map_err(err)?.sync_all().map_err(err)?;
    fs::remove_file(output.join("INCOMPLETE.txt")).map_err(err)?;
    status.phase="complete";progress(status.clone());
    Ok(ExportResult{path:output.to_string_lossy().into_owned(),files:status.completed_files,links,missing,cancelled:false})
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    fn fixture() -> (tempfile::TempDir,PathBuf,PathBuf) {
        let temp=tempfile::tempdir().unwrap();
        let data=temp.path().join("data");fs::create_dir(&data).unwrap();
        let media=temp.path().join("media");fs::create_dir_all(media.join("Design")).unwrap();
        let destination=temp.path().join("exports");fs::create_dir(&destination).unwrap();
        let path=data.join("library.sqlite");db::init(&path).unwrap();let conn=db::connect(&path).unwrap();
        db::set_setting(&conn,"root",media.join("Design").to_str().unwrap()).unwrap();crate::sources::ensure(&conn).unwrap();
        for (id,group,kind) in [(1,"Design","image"),(2,"Photography","animation"),(3,"Videos","video")] {
            let source=media.join(group).join("same-name.dat");fs::write(&source,format!("original bytes {id}")).unwrap();
            conn.execute("INSERT INTO items(id,path,name,kind,source,added) VALUES(?,?,?,?,?,?)",params![id,source.to_str().unwrap(),format!("Reference {id}"),kind,group,id]).unwrap();
        }
        let thumbnail=data.join("link-thumbnail.png");fs::write(&thumbnail,b"thumbnail bytes").unwrap();
        conn.execute("INSERT INTO items(id,path,name,kind,source,added,thumbnail) VALUES(4,'https://example.com/?a=1&b=2','=SUM(1,2) <script>','link','Resources/Photography',4,?)",[thumbnail.to_str().unwrap()]).unwrap();
        conn.execute("INSERT INTO items(id,path,name,kind,source,added,missing) VALUES(5,?,'Missing reference','image','Design',5,1)",[media.join("Design/missing.png").to_str().unwrap()]).unwrap();
        conn.execute_batch("INSERT INTO projects(id,name) VALUES(7,'Keep project');INSERT INTO item_projects(item_id,label_id,favourite) VALUES(1,7,1);INSERT INTO item_tags(item_id,label_id) VALUES(1,1);INSERT INTO categories(name) VALUES('My category');INSERT INTO item_categories(item_id,name) VALUES(1,'My category');").unwrap();
        (temp,path,destination)
    }
    #[test]
    fn library_export_is_portable_verified_and_restores_after_folder_moves() {
        let (temp,path,destination)=fixture();let mut events=vec![];
        let result=export(&path,&destination,"Design Backup",&AtomicBool::new(false),&mut |p|events.push(p)).unwrap();
        assert_eq!(result.files,4);assert_eq!(result.links,1);assert_eq!(result.missing.len(),1);assert!(!result.cancelled);
        let root=PathBuf::from(&result.path);assert!(!root.join("INCOMPLETE.txt").exists());
        let manifest:serde_json::Value=serde_json::from_slice(&fs::read(manifest_path(&root)).unwrap()).unwrap();
        for entry in manifest["files"].as_array().unwrap() {
            let data=fs::read(root.join(entry["path"].as_str().unwrap())).unwrap();
            assert_eq!(format!("{:x}",Sha256::digest(&data)),entry["sha256"].as_str().unwrap());
        }
        assert!(fs::read_to_string(root.join("Library Data/links.html")).unwrap().contains("&lt;script&gt;"));
        assert!(!fs::read_to_string(root.join("Library Data/links.html")).unwrap().contains("<script>"));
        assert!(fs::read_to_string(root.join("Library Data/links.csv")).unwrap().contains("\"'=SUM"));
        assert_eq!(events.last().unwrap().phase,"complete");assert_eq!(events.last().unwrap().copied_bytes,events.last().unwrap().total_bytes);
        let moved=temp.path().join("moved backup");fs::rename(&root,&moved).unwrap();
        let restored=temp.path().join("restore");fs::create_dir(&restored).unwrap();let restored=restored.join("library.sqlite");db::init(&restored).unwrap();
        db::connect(&restored).unwrap().execute("INSERT INTO items(path,name,kind,source,added) VALUES('https://example.com/?a=1&b=2','Pre-seeded name','link','Resources',0)",[]).unwrap();
        db::import(&restored,metadata_path(&moved)).unwrap();
        let lib=db::load(&restored,false).unwrap();assert_eq!(lib.items.len(),5);
        let first=lib.items.iter().find(|i|i.name=="Reference 1").unwrap();
        assert_eq!(fs::read(&first.path).unwrap(),b"original bytes 1");assert!(Path::new(&first.path).starts_with(moved.canonicalize().unwrap()));
        assert_eq!(first.category.as_deref(),Some("My category"));assert_eq!(first.projects.len(),1);assert_eq!(first.tags.len(),1);assert_eq!(first.favourites.len(),1);
        let link=lib.items.iter().find(|i|i.kind=="link").unwrap();assert_eq!(link.name,"=SUM(1,2) <script>");assert_eq!(link.source,"Resources/Photography");assert!(Path::new(&link.thumbnail).is_file());
        assert!(lib.items.iter().find(|i|i.name=="Missing reference").unwrap().missing);
        assert!(Path::new(&lib.root).starts_with(moved.canonicalize().unwrap()));
        let another=export(&path,&destination,"Design Backup",&AtomicBool::new(false),&mut |_|{}).unwrap();let collision=export(&path,&destination,"Design Backup",&AtomicBool::new(false),&mut |_|{}).unwrap();assert_ne!(another.path,collision.path);
    }
    #[test]
    fn library_export_cancel_keeps_originals_and_marks_partial_folder() {
        let (_temp,path,destination)=fixture();let cancel=AtomicBool::new(false);
        let result=export(&path,&destination,"Cancelled",&cancel,&mut |p|{if p.phase=="copying" {cancel.store(true,Ordering::SeqCst);}}).unwrap();
        assert!(result.cancelled);assert!(Path::new(&result.path).join("INCOMPLETE.txt").exists());assert!(!Path::new(&result.path).join("library.json").exists());
        for item in db::load(&path,false).unwrap().items.iter().filter(|i|i.kind!="link"&&!i.missing) {assert!(Path::new(&item.path).exists());}
    }

    #[test]
    fn portable_backup_restores_all_memberships_and_appearance_and_detects_corruption() {
        let (temp,path,destination)=fixture();
        let conn=db::connect(&path).unwrap();
        conn.execute("UPDATE item_categories SET name='Components / Uncategorised' WHERE item_id=1",[]).unwrap();
        conn.execute_batch("INSERT INTO item_component_folders VALUES(1,'Components / Headers');INSERT INTO item_component_folders VALUES(1,'Components / Navbars');").unwrap();
        conn.execute_batch("INSERT INTO project_folders VALUES(1,7,NULL,'Research',NULL),(2,7,1,'Psychodrama',0);INSERT INTO item_project_folders VALUES(1,2);UPDATE items SET rating=5 WHERE kind='link';").unwrap();
        db::change(&path,serde_json::from_value(serde_json::json!({"action":"set_category","ids":[2],"value":"Social Media"})).unwrap()).unwrap();
        let cover=path.parent().unwrap().join("home-covers/cover.png");fs::create_dir_all(cover.parent().unwrap()).unwrap();fs::write(&cover,b"cover bytes").unwrap();
        let prefs=serde_json::json!({"colour-history":[{"hex":"#ABCDEF","projects":["project:7","project:999"]}],"home-tiles":[{"id":"project:7","cover":{"path":cover,"width":10,"height":10}}],"app-icons":{"overrides":{"project:7":{"kind":"asset","value":cover}}},"folder-labels":{"Mobile":"iOS & Android"},"collection-shortcuts":[{"target":{"kind":"project","value":"7"}}]});
        let result=export_with_preferences(&path,&destination,"Complete",prefs,&AtomicBool::new(false),&mut |_|{}).unwrap();
        let moved=temp.path().join("external drive copy");fs::rename(result.path,&moved).unwrap();
        let checked=verify(&moved).unwrap();assert_eq!(checked.missing.len(),1);
        let restored=temp.path().join("new app");fs::create_dir(&restored).unwrap();let restored=restored.join("library.sqlite");db::init(&restored).unwrap();
        let db2=db::connect(&restored).unwrap();db2.execute("INSERT INTO projects(id,name) VALUES(7,'Unrelated project')",[]).unwrap();
        db::import(&restored,metadata_path(&moved)).unwrap();
        let lib=db::load(&restored,false).unwrap();let item=lib.items.iter().find(|i|i.name=="Reference 1").unwrap();
        assert_eq!(item.component_folders,vec!["Components / Headers","Components / Navbars"]);
        let child=lib.project_folders.iter().find(|f|f.name=="Psychodrama").unwrap();assert_eq!(item.project_folders,vec![child.id]);assert!(child.parent_id.is_some());assert!(item.projects.contains(&child.project_id));assert_eq!(lib.items.iter().find(|i|i.kind=="link").unwrap().rating,Some(5));
        let design=lib.items.iter().find(|i|i.name=="Reference 2").unwrap();assert!(design.design_folders.contains(&"Social Media".to_string()));assert!(design.design_folders.len()>1);
        assert!(fs::read_to_string(moved.join("Browse Library.html")).unwrap().contains("Social Media"));
        let settings=restore_preferences(&moved,&restored).unwrap();let project=lib.projects.iter().find(|p|p.name=="Keep project").unwrap();
        assert_eq!(settings["home-tiles"][0]["id"],format!("project:{}",project.id));
        assert_eq!(settings["colour-history"][0]["projects"].as_array().unwrap().len(),1);assert_eq!(settings["colour-history"][0]["hex"],"#ABCDEF");assert_eq!(settings["colour-history"][0]["projects"][0],format!("project:{}",project.id));
        assert_eq!(settings["collection-shortcuts"][0]["target"]["value"],project.id.to_string());
        assert_eq!(fs::read(settings["home-tiles"][0]["cover"]["path"].as_str().unwrap()).unwrap(),b"cover bytes");
        let again=export_with_preferences(&restored,&destination,"Again",settings,&AtomicBool::new(false),&mut |_|{}).unwrap();
        assert!(Path::new(&again.path).join("Appearance").is_dir());
        fs::write(preferences_path(&moved),b"{}").unwrap();assert!(verify(&moved).unwrap_err().contains("preferences.json"));
    }
    #[test]
    fn library_export_rejects_nested_destinations_and_portable_path_traversal() {
        let (temp,path,_destination)=fixture();
        assert!(export(&path,&temp.path().join("media/Design"),"Bad",&AtomicBool::new(false),&mut |_|{}).is_err());
        assert!(resolve_relative(temp.path(),"../escape.png").is_err());assert!(resolve_relative(temp.path(),temp.path().to_str().unwrap()).is_err());
    }
    #[test]
    fn library_export_detects_source_changes_and_never_marks_failed_copy_complete() {
        let (temp,path,destination)=fixture();let source=temp.path().join("media/Design/same-name.dat");let mut changed=false;
        let result=export(&path,&destination,"Changed",&AtomicBool::new(false),&mut |p| {if p.phase=="copying"&&!changed {changed=true;fs::write(&source,b"new bytes of a different length").unwrap();}});
        assert!(result.unwrap_err().contains("changed during export"));
        let root=fs::read_dir(&destination).unwrap().next().unwrap().unwrap().path();assert!(root.join("INCOMPLETE.txt").exists());assert!(!root.join("library.json").exists());
    }
    #[test]
    fn managed_library_moves_reopens_and_verifies_every_membership() {
        let (temp,path,destination)=fixture();let conn=db::connect(&path).unwrap();
        conn.execute("DELETE FROM items WHERE missing=1",[]).unwrap();
        conn.execute("UPDATE item_categories SET name='Components / Uncategorised' WHERE item_id=1",[]).unwrap();
        conn.execute_batch("INSERT INTO item_component_folders VALUES(1,'Components / Headers');INSERT INTO item_component_folders VALUES(1,'Components / Navbars');").unwrap();
        conn.execute_batch("INSERT INTO project_folders VALUES(1,7,NULL,'Research',NULL),(2,7,1,'Psychodrama',0);INSERT INTO item_project_folders VALUES(1,2);UPDATE items SET rating=5 WHERE kind='link';").unwrap();drop(conn);
        let result=export(&path,&destination,"Bit Clever Library",&AtomicBool::new(false),&mut |_|{}).unwrap();
        let folder=PathBuf::from(result.path);let managed=crate::managed_library::open(&folder).unwrap();
        crate::managed_library::verify_live(&folder).unwrap();
        let lib=db::load(&managed,false).unwrap();let item=lib.items.iter().find(|i|i.name=="Reference 1").unwrap();
        assert_eq!(item.component_folders.len(),2);assert!(item.path.contains("App Components"));assert!(folder.join("Browse Library.html").exists());
        for item in db::load(&path,false).unwrap().items.iter().filter(|i|i.kind!="link"){assert!(Path::new(&item.path).is_file());}
        let id=item.id;db::change(&managed,serde_json::from_value(serde_json::json!({"action":"set_category","ids":[id],"value":"Branding"})).unwrap()).unwrap();crate::managed_library::organise(&managed).unwrap();
        assert!(db::load(&managed,false).unwrap().items.iter().find(|i|i.id==id).unwrap().path.contains("App Components"));
        let shared=db::load(&managed,false).unwrap();assert_eq!(shared.items.iter().find(|i|i.id==id).unwrap().component_folders.len(),2);assert!(shared.items.iter().find(|i|i.id==id).unwrap().design_folders.contains(&"Branding".into()));
        write_browser(&folder,&shared,&serde_json::json!({})).unwrap();let browser=fs::read_to_string(folder.join("Browse Library.html")).unwrap();assert!(browser.contains("data-section=\"Design Inspo\" data-folders=\"[&quot;Branding&quot;]\""));
        db::change(&managed,serde_json::from_value(serde_json::json!({"action":"undo_organisation"})).unwrap()).unwrap();crate::managed_library::organise(&managed).unwrap();
        assert_eq!(db::load(&managed,false).unwrap().items.iter().find(|i|i.id==id).unwrap().component_folders.len(),2);
        let moved=temp.path().join("External Drive Library");fs::rename(&folder,&moved).unwrap();
        let reopened=crate::managed_library::open(&moved).unwrap();crate::managed_library::verify_live(&moved).unwrap();
        let config=temp.path().join("config");fs::create_dir(&config).unwrap();crate::managed_library::activate(&config,&moved).unwrap();assert_eq!(crate::managed_library::selected_db(&config).unwrap(),reopened);
        let next=export(&reopened,&destination,"Fresh Backup",&AtomicBool::new(false),&mut |_|{}).unwrap();verify(Path::new(&next.path)).unwrap();
        let file=db::load(&reopened,false).unwrap().items.into_iter().find(|i|i.kind!="link").unwrap();fs::write(&file.path,b"corrupted").unwrap();assert!(crate::managed_library::verify_live(&moved).is_err());assert!(crate::managed_library::activate(&config,&moved).is_err());
    }
    #[test]
    fn managed_merge_owns_files_and_settings_survive_relocation() {
        let (temp,path,destination)=fixture();db::connect(&path).unwrap().execute("DELETE FROM items WHERE missing=1",[]).unwrap();
        let cover=path.parent().unwrap().join("home-covers/portrait.png");fs::create_dir_all(cover.parent().unwrap()).unwrap();fs::write(&cover,b"portrait").unwrap();
        let prefs=serde_json::json!({"home-tiles":[{"id":"project:7","cover":{"path":cover}}],"folder-labels":{"Components / Headers":"Navigation"}});
        let first=export_with_preferences(&path,&destination,"One",prefs,&AtomicBool::new(false),&mut |_|{}).unwrap();
        let folder=PathBuf::from(first.path);let managed=crate::managed_library::open(&folder).unwrap();
        let imported=temp.path().join("new-photo.png");fs::write(&imported,b"new unique photo").unwrap();db::connect(&path).unwrap().execute("INSERT INTO items(path,name,kind,source,added) VALUES(?,'A New Photo','image','Design',10)",[imported.to_str().unwrap()]).unwrap();
        let second=export(&path,&destination,"Two",&AtomicBool::new(false),&mut |_|{}).unwrap();db::import(&managed,metadata_path(Path::new(&second.path))).unwrap();crate::managed_library::organise(&managed).unwrap();
        let lib=db::load(&managed,false).unwrap();assert_eq!(lib.items.len(),5);for item in lib.items.iter().filter(|i|i.kind!="link"){assert!(Path::new(&item.path).starts_with(folder.canonicalize().unwrap()));}
        let moved=temp.path().join("Moved");fs::rename(&folder,&moved).unwrap();let reopened=crate::managed_library::open(&moved).unwrap();crate::managed_library::verify_live(&moved).unwrap();
        let prefs=crate::managed_library::preferences(&reopened).unwrap().unwrap();let asset=Path::new(prefs["home-tiles"][0]["cover"]["path"].as_str().unwrap());assert!(asset.starts_with(moved.canonicalize().unwrap()));assert_eq!(fs::read(asset).unwrap(),b"portrait");
    }

}
