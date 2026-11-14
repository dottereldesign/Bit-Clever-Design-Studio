use crate::db::{self, err, Result};
use serde::Serialize;
use std::{fs, io::Read, path::{Path, PathBuf}};

#[derive(Serialize)]
pub struct FileInfo { pub id:i64, pub bytes:Option<u64>, pub modified:Option<u64> }
pub fn details(db_path:&Path, project:i64)->Result<Vec<FileInfo>> {
    let db=db::connect(db_path)?;
    let mut query=db.prepare("SELECT i.id,i.path FROM items i JOIN item_projects p ON p.item_id=i.id WHERE p.label_id=? AND i.archived=0 AND i.kind!='link'").map_err(err)?;
    let rows=query.query_map([project],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?))).map_err(err)?;
    rows.map(|row|{let (id,path)=row.map_err(err)?;let meta=fs::metadata(path).ok();Ok(FileInfo{id,bytes:meta.as_ref().map(|m|m.len()),modified:meta.and_then(|m|m.modified().ok()).and_then(|t|t.duration_since(std::time::UNIX_EPOCH).ok()).map(|t|t.as_millis() as u64)})}).collect()
}
pub fn path(db_path:&Path,id:i64)->Result<PathBuf> {
    let db=db::connect(db_path)?;
    let path:String=db.query_row("SELECT path FROM items WHERE id=? AND archived=0 AND kind!='link' AND (EXISTS(SELECT 1 FROM item_projects WHERE item_id=items.id) OR EXISTS(SELECT 1 FROM studio_records s,json_each(s.data,'$.files') f WHERE f.value=items.id))",[id],|r|r.get(0)).map_err(err)?;
    let path=PathBuf::from(path).canonicalize().map_err(err)?;
    if !path.is_file(){return Err("This file is unavailable. Reconnect its drive or restore a backup.".into());}Ok(path)
}
#[derive(Serialize)]
pub struct Preview { pub kind:&'static str, pub path:String, pub text:Option<String>, pub truncated:bool }
pub fn preview(db_path:&Path,id:i64)->Result<Preview> {
    let path=path(db_path,id)?;
    let ext=path.extension().and_then(|s|s.to_str()).unwrap_or("").to_ascii_lowercase();
    let kind=match ext.as_str(){
        "pdf"=>"pdf", "png"|"jpg"|"jpeg"|"gif"|"webp"|"svg"|"bmp"|"avif"=>"image",
        "mp4"|"webm"|"mov"|"m4v"=>"video", "mp3"|"wav"|"ogg"|"m4a"|"flac"|"aac"=>"audio",
        "txt"|"md"|"csv"|"json"|"xml"|"html"|"css"|"js"|"ts"|"tsx"|"jsx"|"yaml"|"yml"|"log"=>"text",
        _=>"unsupported"
    };
    let mut text=None;let mut truncated=false;
    if kind=="text" {let mut bytes=vec![];fs::File::open(&path).map_err(err)?.take(1024*1024+1).read_to_end(&mut bytes).map_err(err)?;truncated=bytes.len()>1024*1024;bytes.truncate(1024*1024);text=Some(String::from_utf8_lossy(&bytes).into_owned());}
    Ok(Preview{kind,path:path.to_string_lossy().into_owned(),text,truncated})
}
pub fn open(db_path:&Path,id:i64)->Result<()> {
    let path=path(db_path,id)?;
    let extension=path.extension().and_then(|s|s.to_str()).unwrap_or("").to_ascii_lowercase();
    if ["exe","com","bat","cmd","ps1","vbs","vbe","js","jse","wsf","wsh","msi","msp","scr","lnk","url","reg","hta"].contains(&extension.as_str()) {
        return Err("This file can be stored here. Use Reveal in Explorer to open executable files or shortcuts yourself.".into());
    }
    tauri_plugin_opener::open_path(path.to_string_lossy().into_owned(),None::<&str>).map_err(err)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{content,library_export,managed_library};
    use std::sync::atomic::AtomicBool;
    #[test]
    fn project_attachments_round_trip_without_decoding_or_leaking_into_designs() {
        let temp=tempfile::tempdir().unwrap();let data=temp.path().join("data");fs::create_dir(&data).unwrap();let database=data.join("library.sqlite");db::init(&database).unwrap();
        let root=temp.path().join("Design");fs::create_dir(&root).unwrap();let conn=db::connect(&database).unwrap();db::set_setting(&conn,"root",root.to_str().unwrap()).unwrap();
        conn.execute_batch("INSERT INTO projects(id,name) VALUES(7,'Client');INSERT INTO project_folders(id,project_id,parent_id,name) VALUES(10,7,NULL,'Documents');").unwrap();drop(conn);
        for (position,name) in ["Brief.txt","Presentation.pdf","Source.fig","Contract.docx","Archive.zip","LICENSE","Tool.exe"].iter().enumerate() {
            let stage=content::stage_begin(temp.path(),name).unwrap();let original=format!("exact original bytes {position}");fs::write(&stage.path,&original).unwrap();
            let input:content::Capture=serde_json::from_value(serde_json::json!({"files":[stage],"projects":[7],"project_only":true})).unwrap();
            let result=content::capture(&database,input).unwrap();assert_eq!(result.added,1);
            db::change(&database,serde_json::from_value(serde_json::json!({"action":"add_project_folder","target":10,"ids":result.ids})).unwrap()).unwrap();
        }
        // Reimport reuses the owned file rather than creating another attachment.
        let again=content::stage_begin(temp.path(),"Brief.txt").unwrap();fs::write(&again.path,"exact original bytes 0").unwrap();
        let repeated=content::capture(&database,serde_json::from_value(serde_json::json!({"files":[again],"projects":[7],"project_only":true})).unwrap()).unwrap();assert_eq!(repeated.reused,1);assert_eq!(repeated.added,0);
        let rejected=content::stage_begin(temp.path(),"Private.docx").unwrap();fs::write(&rejected.path,"private").unwrap();
        assert!(content::capture(&database,serde_json::from_value(serde_json::json!({"files":[rejected]})).unwrap()).is_err());
        let library=db::load(&database,false).unwrap();assert_eq!(library.items.len(),7);
        for item in &library.items{assert_eq!(item.kind,"file");assert!(item.project_only);assert_eq!(item.project_folders,vec![10]);assert_eq!(item.projects,vec![7]);}
        let text=library.items.iter().find(|item|item.name=="Brief").unwrap();assert_eq!(preview(&database,text.id).unwrap().text.as_deref(),Some("exact original bytes 0"));
        let executable=library.items.iter().find(|item|item.name=="Tool").unwrap();assert!(open(&database,executable.id).unwrap_err().contains("Explorer"));
        assert_eq!(details(&database,7).unwrap().len(),7);
        let destination=temp.path().join("backups");fs::create_dir(&destination).unwrap();
        let backup=library_export::export(&database,&destination,"Project backup",&AtomicBool::new(false),&mut |_|{}).unwrap();assert!(backup.missing.is_empty());
        let restored=managed_library::open(Path::new(&backup.path)).unwrap();managed_library::verify_live(Path::new(&backup.path)).unwrap();
        let restored=db::load(&restored,false).unwrap();assert_eq!(restored.items.len(),7);
        for item in restored.items{let original=library.items.iter().find(|old|old.name==item.name).unwrap();assert_eq!(fs::read(item.path).unwrap(),fs::read(&original.path).unwrap());assert!(item.project_only);assert_eq!(item.project_folders.len(),1);}
        assert!(!Path::new(&backup.path).join("Browse Library.html").exists()||!fs::read_to_string(Path::new(&backup.path).join("Browse Library.html")).unwrap().contains("<img"));
    }
    #[test]
    fn document_preview_is_bounded_and_html_is_only_text() {
        let temp=tempfile::tempdir().unwrap();let data=temp.path().join("data");fs::create_dir(&data).unwrap();let database=data.join("library.sqlite");db::init(&database).unwrap();
        let source=temp.path().join("Page.html");fs::write(&source,vec![b'x';2*1024*1024]).unwrap();let conn=db::connect(&database).unwrap();
        conn.execute_batch("INSERT INTO projects VALUES(7,'Client');").unwrap();conn.execute("INSERT INTO items(id,path,name,kind,added,project_only) VALUES(1,?,'Page','file',1,1)",[source.to_str().unwrap()]).unwrap();conn.execute_batch("INSERT INTO item_projects VALUES(1,7,0);").unwrap();
        let result=preview(&database,1).unwrap();assert_eq!(result.kind,"text");assert!(result.truncated);assert_eq!(result.text.unwrap().len(),1024*1024);
        conn.execute("DELETE FROM item_projects",[]).unwrap();assert!(preview(&database,1).is_err());
    }
}
