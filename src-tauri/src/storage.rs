use crate::db::{self,err,Result};
use std::{collections::HashSet,path::{Path,PathBuf}};
use serde::Serialize;

#[derive(Serialize)]
pub struct Usage {pub bytes:u64,pub data_bytes:u64,pub library_bytes:u64,pub app_bytes:u64,pub partial:bool}

fn measure(paths:Vec<PathBuf>,seen:&mut HashSet<PathBuf>,partial:&mut bool)->u64 {
 let mut bytes=0u64;
 for root in paths {
  if !root.exists(){continue;}
  for entry in walkdir::WalkDir::new(root).follow_links(false) {
   let entry=match entry {Ok(e)=>e,Err(_)=>{*partial=true;continue;}};
   if !entry.file_type().is_file(){continue;}
   let key=match entry.path().canonicalize(){Ok(p)=>p,Err(_)=>{*partial=true;continue;}};
   if !seen.insert(key){continue;}
   match entry.metadata(){Ok(m)=>bytes=bytes.saturating_add(m.len()),Err(_)=>*partial=true}
  }
 }
 bytes
}

pub fn usage(db_path:&Path,app_files:Vec<PathBuf>)->Result<Usage>{
 let data=db_path.parent().ok_or("Data folder unavailable")?;
 let db=db::connect(db_path)?;
 let mut library:Vec<PathBuf>=crate::sources::roots(&db).into_iter().map(|(_,p)|p).collect();
 let mut statement=db.prepare("SELECT path,thumbnail,kind FROM items").map_err(err)?;
 let rows=statement.query_map([],|row|Ok((row.get::<_,String>(0)?,row.get::<_,String>(1)?,row.get::<_,String>(2)?))).map_err(err)?;
 for row in rows {let (path,thumbnail,kind)=row.map_err(err)?;if kind!="link"{library.push(path.into());}if !thumbnail.is_empty(){library.push(thumbnail.into());}}
 let mut seen=HashSet::new();let mut partial=false;
 let data_bytes=measure(vec![data.into(),crate::managed_library::appearance(data)],&mut seen,&mut partial);
 let library_bytes=measure(library,&mut seen,&mut partial);
 let app_bytes=measure(app_files,&mut seen,&mut partial);
 Ok(Usage{bytes:data_bytes.saturating_add(library_bytes).saturating_add(app_bytes),data_bytes,library_bytes,app_bytes,partial})
}

#[cfg(test)] mod tests{
 use super::*;
 #[test] fn includes_app_data_and_external_media_once_and_updates(){
  let temp=tempfile::tempdir().unwrap();let data=temp.path().join("data");std::fs::create_dir(&data).unwrap();let db_path=data.join("library.sqlite");db::init(&db_path).unwrap();
  let library=temp.path().join("media");std::fs::create_dir(&library).unwrap();let media=library.join("image.png");std::fs::write(&media,vec![0;100]).unwrap();let app=temp.path().join("app.exe");std::fs::write(&app,vec![0;30]).unwrap();
  let db=db::connect(&db_path).unwrap();db::set_setting(&db,"root",library.to_str().unwrap()).unwrap();db.execute("INSERT INTO items(path,name,kind,source,added) VALUES(?,'Image','image','Design',1)",[media.to_str().unwrap()]).unwrap();
  let a=usage(&db_path,vec![app.clone(),app.clone()]).unwrap();assert_eq!(a.library_bytes,100);assert_eq!(a.app_bytes,30);assert!(a.data_bytes>0);assert_eq!(a.bytes,a.data_bytes+130);assert!(!a.partial);
  std::fs::write(&media,vec![0;240]).unwrap();assert_eq!(usage(&db_path,vec![app]).unwrap().library_bytes,240);
 }
}
