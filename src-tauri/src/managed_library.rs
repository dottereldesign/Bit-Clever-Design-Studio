use crate::{db::{self,err,Result},library_export};
use serde::Serialize;
use std::{path::{Path,PathBuf},fs,io::Write,collections::HashSet};

pub fn root(path:&Path)->Result<Option<PathBuf>>{Ok(db::setting(&db::connect(path)?,"managed_root").map(PathBuf::from))}
pub fn appearance(data:&Path)->PathBuf{if data.file_name().is_some_and(|n|n=="Library Data"){data.parent().unwrap().join("Appearance")}else{data.join("home-covers")}}
pub fn atomic_write(path:&Path,bytes:&[u8])->Result<()>{
    let mut file=tempfile::NamedTempFile::new_in(path.parent().ok_or("Missing parent folder")?).map_err(err)?;
    file.write_all(bytes).map_err(err)?;file.as_file().sync_all().map_err(err)?;file.persist(path).map_err(err)?;Ok(())
}
pub fn selected_db(config:&Path)->Result<PathBuf>{
    let pointer=config.join("active-library.json");if !pointer.exists(){return Ok(config.join("library.sqlite"));}
    let folder:PathBuf=serde_json::from_slice(&fs::read(pointer).map_err(err)?).map_err(err)?;
    let db=folder.join("Library Data/Library.sqlite");
    if !db.is_file(){return Err(format!("Your library is unavailable at {}. Reconnect its drive before opening Bit Clever.",folder.display()));}
    rebase(&db,&folder)?;Ok(db)
}
fn configure(db:&rusqlite::Connection,folder:&Path)->Result<()>{
    for name in ["Design Inspo","App Components","General","Appearance","Library Data"]{fs::create_dir_all(folder.join(name)).map_err(err)?;}
    for (key,value) in [("managed_root",folder.to_path_buf()),("root",folder.join("Design Inspo")),("root_components",folder.join("App Components")),("root_general",folder.join("General"))]{db::set_setting(db,key,&value.to_string_lossy())?;}
    db::set_setting(db,"source_layout","1")
}
pub fn open(folder:&Path)->Result<PathBuf>{
    let folder=folder.canonicalize().map_err(err)?;
    let path=folder.join("Library Data/Library.sqlite");
    if path.is_file(){rebase(&path,&folder)?;return Ok(path);}
    let report=library_export::verify(&folder)?;
    if !report.missing.is_empty(){return Err(format!("This backup has {} unavailable files. Repair the source library before using it as a complete library.",report.missing.len()));}
    let temporary=folder.join("Library Data/Creating.sqlite");
    if temporary.exists(){return Err("An unfinished library setup exists. Keep this folder and create a fresh backup.".into());}
    fs::create_dir_all(temporary.parent().unwrap()).map_err(err)?;
    db::init(&temporary)?;
    db::import(&temporary,library_export::metadata_path(&folder))?;
    let preferences=library_export::restore_preferences(&folder,&temporary)?;
    let conn=db::connect(&temporary)?;configure(&conn,&folder)?;
    db::set_setting(&conn,"appearance_preferences",&serde_json::to_string(&preferences).map_err(err)?)?;
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);").map_err(err)?;drop(conn);
    fs::rename(&temporary,&path).map_err(err)?;
    organise(&path)?;Ok(path)
}
pub fn activate(config:&Path,folder:&Path)->Result<()> {
    let path=open(folder)?;verify_live(folder)?;let conn=db::connect(&path)?;
    let check:String=conn.query_row("PRAGMA quick_check",[],|r|r.get(0)).map_err(err)?;
    if check!="ok"{return Err("The library database failed its integrity check.".into());}
    atomic_write(&config.join("active-library.json"),&serde_json::to_vec(&folder.canonicalize().map_err(err)?).map_err(err)?)
}
fn rewrite_paths(value:&mut serde_json::Value,old:&Path,new:&Path){match value{
    serde_json::Value::String(s)=>{if let Ok(relative)=Path::new(s).strip_prefix(old){*s=new.join(relative).to_string_lossy().into_owned();}},
    serde_json::Value::Array(a)=>for v in a {rewrite_paths(v,old,new)},
    serde_json::Value::Object(a)=>for v in a.values_mut(){rewrite_paths(v,old,new)},_=>{}
}}
pub fn rebase(path:&Path,folder:&Path)->Result<()> {
    let mut conn=db::connect(path)?;let old=PathBuf::from(db::setting(&conn,"managed_root").ok_or("This is not a managed Bit Clever library")?);
    let folder=folder.canonicalize().map_err(err)?;if old==folder{return Ok(());}
    let rows={let mut q=conn.prepare("SELECT id,path,thumbnail,kind FROM items").map_err(err)?;let rows=q.query_map([],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?))).map_err(err)?;rows.collect::<std::result::Result<Vec<_>,_>>().map_err(err)?};
    let tx=conn.transaction().map_err(err)?;
    for (id,mut media,mut thumb,kind) in rows {
        if kind!="link"{let relative=Path::new(&media).strip_prefix(&old).map_err(|_|"A library file points outside its library folder.")?;media=library_export::resolve_relative(&folder,&relative.to_string_lossy())?;}
        if !thumb.is_empty(){let relative=Path::new(&thumb).strip_prefix(&old).map_err(|_|"A thumbnail points outside its library folder.")?;thumb=library_export::resolve_relative(&folder,&relative.to_string_lossy())?;}
        tx.execute("UPDATE items SET path=?,thumbnail=? WHERE id=?",rusqlite::params![media,thumb,id]).map_err(err)?;
    }
    if let Some(saved)=db::setting(&tx,"appearance_preferences"){let mut prefs:serde_json::Value=serde_json::from_str(&saved).map_err(err)?;rewrite_paths(&mut prefs,&old,&folder);db::set_setting(&tx,"appearance_preferences",&serde_json::to_string(&prefs).map_err(err)?)?;}
    configure(&tx,&folder)?;tx.commit().map_err(err)
}
pub fn preferences(path:&Path)->Result<Option<serde_json::Value>>{let db=db::connect(path)?;if db::setting(&db,"managed_root").is_none(){return Ok(None);}Ok(Some(serde_json::from_str(&db::setting(&db,"appearance_preferences").unwrap_or_else(||"{}".into())).map_err(err)?))}
pub fn save_preferences(path:&Path,value:&serde_json::Value)->Result<()>{if root(path)?.is_none(){return Ok(());}db::set_setting(&db::connect(path)?,"appearance_preferences",&serde_json::to_string(value).map_err(err)?)?;refresh_browser(path)}
pub fn refresh_browser(path:&Path)->Result<()>{
    let Some(folder)=root(path)? else{return Ok(())};let mut lib=db::load(path,false)?;
    update_inventory(path,&folder,&lib)?;
    for item in &mut lib.items {if item.kind!="link"{item.path=Path::new(&item.path).strip_prefix(&folder).map_err(|_|"Library file is outside its folder")?.to_string_lossy().replace('\\',"/");}}
    library_export::write_browser(&folder,&lib,&preferences(path)?.unwrap_or(serde_json::json!({})))
}
fn owned_files(folder:&Path,lib:&db::Library,prefs:&serde_json::Value)->Result<HashSet<PathBuf>>{
    let mut files=HashSet::new();
    for item in &lib.items{if item.kind!="link"{files.insert(PathBuf::from(&item.path));}if !item.thumbnail.is_empty(){files.insert(PathBuf::from(&item.thumbnail));}}
    fn assets(v:&serde_json::Value,files:&mut HashSet<PathBuf>){match v{serde_json::Value::String(s) if Path::new(s).is_absolute()=>{files.insert(PathBuf::from(s));},serde_json::Value::Array(vs)=>for v in vs{assets(v,files)},serde_json::Value::Object(vs)=>for v in vs.values(){assets(v,files)},_=>{}}}
    assets(prefs,&mut files);
    for file in &files{if !file.starts_with(folder){return Err("The library still references a file outside its folder.".into());}}
    Ok(files)
}
fn update_inventory(path:&Path,folder:&Path,lib:&db::Library)->Result<()>{
    let mut conn=db::connect(path)?;
    conn.execute_batch("CREATE TABLE IF NOT EXISTS managed_checksums(path TEXT PRIMARY KEY,sha256 TEXT NOT NULL);").map_err(err)?;
    let files=owned_files(folder,lib,&preferences(path)?.unwrap_or(serde_json::json!({})))?;
    let tx=conn.transaction().map_err(err)?;
    let relative_files:HashSet<String>=files.iter().map(|f|f.strip_prefix(folder).unwrap().to_string_lossy().replace('\\',"/")).collect();
    let previous={let mut q=tx.prepare("SELECT path FROM managed_checksums").map_err(err)?;let rows=q.query_map([],|r|r.get::<_,String>(0)).map_err(err)?;rows.collect::<std::result::Result<Vec<_>,_>>().map_err(err)?};
    for relative in previous{if !relative_files.contains(&relative){tx.execute("DELETE FROM managed_checksums WHERE path=?",[relative]).map_err(err)?;}}
    for file in files{let relative=file.strip_prefix(folder).map_err(err)?.to_string_lossy().replace('\\',"/");
        let exists:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM managed_checksums WHERE path=?)",[&relative],|r|r.get(0)).map_err(err)?;
        if !exists&&file.is_file(){tx.execute("INSERT INTO managed_checksums VALUES(?,?)",rusqlite::params![relative,library_export::checksum(&file)?]).map_err(err)?;}
    }tx.commit().map_err(err)
}
pub fn verify_live(folder:&Path)->Result<library_export::Verification>{
    let folder=folder.canonicalize().map_err(err)?;let path=folder.join("Library Data/Library.sqlite");rebase(&path,&folder)?;
    let conn=db::connect(&path)?;let check:String=conn.query_row("PRAGMA integrity_check",[],|r|r.get(0)).map_err(err)?;
    if check!="ok"{return Err("Library database integrity check failed.".into());}
    let violations:i64=conn.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check",[],|r|r.get(0)).map_err(err)?;
    if violations>0{return Err("Library folder relationships failed their integrity check.".into());}
    let files=owned_files(&folder,&db::load(&path,false)?,&preferences(&path)?.unwrap_or(serde_json::json!({})))?;
    for file in &files{let relative=file.strip_prefix(&folder).map_err(err)?.to_string_lossy().replace('\\',"/");
        let expected:String=conn.query_row("SELECT sha256 FROM managed_checksums WHERE path=?",[&relative],|r|r.get(0)).map_err(|_|format!("No verified checksum for {relative}"))?;
        if !file.is_file()||library_export::checksum(file)?!=expected{return Err(format!("Library file is missing or changed: {relative}"));}
    }
    Ok(library_export::Verification{files:files.len(),missing:vec![]})
}
// Folder memberships identify the section. Refiling moves only the owned copy.
pub fn organise(path:&Path)->Result<()> {
    let Some(folder)=root(path)? else{return Ok(())};let lib=db::load(path,false)?;let db=db::connect(path)?;
    for item in lib.items.iter().filter(|i|i.kind!="link") {
        let source=Path::new(&item.path);let destination=folder.join(library_export::collection(item));
        if source.parent()==Some(destination.as_path())||!source.is_file(){continue;}
        if !source.starts_with(&folder){return Err("A file must be imported into the managed library before it can be organised.".into());}
        fs::create_dir_all(&destination).map_err(err)?;
        let mut used:HashSet<String>=fs::read_dir(&destination).map_err(err)?.filter_map(|e|e.ok()).map(|e|format!("{}/{}",library_export::collection(item),e.file_name().to_string_lossy()).to_lowercase()).collect();
        let name=library_export::allocate_filename(&item.name,source,library_export::collection(item),&mut used);let target=destination.join(name);
        fs::rename(source,&target).map_err(err)?;
        let old_relative=source.strip_prefix(&folder).map_err(err)?.to_string_lossy().replace('\\',"/");
        let new_relative=target.strip_prefix(&folder).map_err(err)?.to_string_lossy().replace('\\',"/");
        let result=(||->Result<()>{
            let tx=db.unchecked_transaction().map_err(err)?;
            tx.execute("UPDATE items SET path=? WHERE id=?",rusqlite::params![target.to_string_lossy(),item.id]).map_err(err)?;
            tx.execute_batch("CREATE TABLE IF NOT EXISTS managed_checksums(path TEXT PRIMARY KEY,sha256 TEXT NOT NULL);").map_err(err)?;
            tx.execute("UPDATE OR REPLACE managed_checksums SET path=? WHERE path=?",rusqlite::params![new_relative,old_relative]).map_err(err)?;
            tx.commit().map_err(err)
        })();
        if let Err(error)=result{let _=fs::rename(&target,source);return Err(error);}
    }
    refresh_browser(path)
}
// Copy imports before committing their records. Existing originals remain untouched.
pub fn own_import(folder:&Path,items:&mut [db::Item])->Result<()> {
    for item in items.iter(){for file in [if item.kind!="link"{item.path.as_str()}else{""},item.thumbnail.as_str()] {if !file.is_empty()&&!Path::new(file).is_file(){return Err(format!("Cannot merge a missing file: {file}"));}}}
    for item in items {
        if item.kind!="link"{item.path=copy_owned(folder,&item.path,library_export::collection(item),&item.name)?;}
        if !item.thumbnail.is_empty(){item.thumbnail=copy_owned(folder,&item.thumbnail,"Library Data/Thumbnails","Thumbnail")?;}
    }Ok(())
}
fn copy_owned(folder:&Path,source:&str,group:&str,title:&str)->Result<String>{
    let source=Path::new(source).canonicalize().map_err(err)?;if source.starts_with(folder){return Ok(source.to_string_lossy().into_owned());}
    let destination=folder.join(group);fs::create_dir_all(&destination).map_err(err)?;
    let expected=library_export::checksum(&source)?;
    let entries:Vec<_>=fs::read_dir(&destination).map_err(err)?.filter_map(|e|e.ok()).collect();
    for entry in &entries {let path=entry.path();if path.is_file()&&fs::metadata(&path).map_err(err)?.len()==fs::metadata(&source).map_err(err)?.len()&&library_export::checksum(&path)?==expected{return Ok(path.to_string_lossy().into_owned());}}
    let mut used=entries.iter().map(|e|format!("{group}/{}",e.file_name().to_string_lossy()).to_lowercase()).collect();
    let target=destination.join(library_export::allocate_filename(title,&source,group,&mut used));
    let temp=tempfile::NamedTempFile::new_in(&destination).map_err(err)?;fs::copy(&source,temp.path()).map_err(err)?;
    if library_export::checksum(temp.path())?!=expected||library_export::checksum(&source)?!=expected{return Err("An imported file changed while being copied.".into());}
    temp.as_file().sync_all().map_err(err)?;temp.persist_noclobber(&target).map_err(err)?;Ok(target.to_string_lossy().into_owned())
}
#[derive(Serialize)]
pub struct CollectionStorage{pub name:String,pub count:usize,pub bytes:u64,pub path:Option<String>}
#[derive(Serialize)]
pub struct Overview{pub root:Option<String>,pub collections:Vec<CollectionStorage>,pub last_backup:Option<String>}
pub fn overview(path:&Path)->Result<Overview>{
    let folder=root(path)?;let lib=db::load(path,false)?;
    let collections=["Design Inspo","App Components","General"].into_iter().map(|name|{
        let items:Vec<_>=lib.items.iter().filter(|i|library_export::collection(i)==name).collect();let mut seen=HashSet::new();
        let bytes=items.iter().filter(|i|i.kind!="link"&&seen.insert(&i.path)).map(|i|fs::metadata(&i.path).map(|m|m.len()).unwrap_or(0)).sum();
        CollectionStorage{name:name.into(),count:items.len(),bytes,path:folder.as_ref().map(|f|f.join(name).to_string_lossy().into_owned())}
    }).collect();
    Ok(Overview{root:folder.map(|f|f.to_string_lossy().into_owned()),collections,last_backup:db::setting(&db::connect(path)?,"last_backup")})
}
