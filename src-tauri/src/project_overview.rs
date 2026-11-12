use crate::db::{err,Result};
use rusqlite::{Connection,params,OptionalExtension};
use serde::{Serialize,Deserialize};
#[derive(Clone,Debug,Serialize,Deserialize,Default)]
pub struct Action {#[serde(default)] pub source_record:Option<String>,pub id:String,pub text:String,pub deadline:String,pub done:bool}
#[derive(Clone,Debug,Serialize,Deserialize)]
pub struct Overview {pub project_id:i64,pub brief:String,pub status:String,pub deadline:String,pub actions:Vec<Action>}
impl Overview {fn empty(id:i64)->Self{Self{project_id:id,brief:String::new(),status:"planned".into(),deadline:String::new(),actions:vec![]}}}
pub fn init(db:&Connection)->Result<()>{db.execute_batch("CREATE TABLE IF NOT EXISTS project_overviews(project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,data TEXT NOT NULL);").map_err(err)}
pub fn load(db:&Connection)->Result<Vec<Overview>>{let mut q=db.prepare("SELECT project_id,data FROM project_overviews ORDER BY project_id").map_err(err)?;let rows=q.query_map([],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?))).map_err(err)?.map(|row|{let(id,text)=row.map_err(err)?;let mut o:Overview=serde_json::from_str(&text).map_err(err)?;o.project_id=id;Ok(o)}).collect();rows}
pub fn date(s:&str)->bool{if s.is_empty(){return true;}let b=s.as_bytes();if b.len()!=10||b[4]!=b'-'||b[7]!=b'-'||!b.iter().enumerate().all(|(i,b)|i==4||i==7||b.is_ascii_digit()){return false;}let y=s[..4].parse::<u32>().unwrap();let m=s[5..7].parse::<u32>().unwrap();let d=s[8..].parse::<u32>().unwrap();let days=match m{1|3|5|7|8|10|12=>31,4|6|9|11=>30,2=>if y%4==0&&(y%100!=0||y%400==0){29}else{28},_=>0};y>0&&d>0&&d<=days}
pub fn save(db:&Connection,o:&Overview)->Result<()>{
 if !["planned","active","waiting","paused","complete"].contains(&o.status.as_str())||o.brief.len()>20000||!date(&o.deadline)||o.actions.len()>500{return Err("Invalid project overview.".into());}
 let mut ids=std::collections::HashSet::new();for a in &o.actions{if a.id.is_empty()||a.id.len()>100||!ids.insert(&a.id)||a.text.trim().is_empty()||a.text.len()>1000||!date(&a.deadline){return Err("Check the action text and deadline.".into());}}
 db.execute("INSERT INTO project_overviews VALUES(?,?) ON CONFLICT(project_id) DO UPDATE SET data=excluded.data",params![o.project_id,serde_json::to_string(o).map_err(err)?]).map_err(err)?;Ok(())
}
pub fn change(db:&Connection,id:i64,value:&str)->Result<()>{
 let exists:bool=db.query_row("SELECT EXISTS(SELECT 1 FROM projects WHERE id=?)",[id],|r|r.get(0)).map_err(err)?;if !exists{return Err("Project no longer exists.".into());}
 let text:Option<String>=db.query_row("SELECT data FROM project_overviews WHERE project_id=?",[id],|r|r.get(0)).optional().map_err(err)?;
 let mut o=match text{Some(t)=>serde_json::from_str(&t).map_err(err)?,None=>Overview::empty(id)};
 let v:serde_json::Value=serde_json::from_str(value).map_err(err)?;let string=|key:&str|v[key].as_str().ok_or_else(||format!("Missing {key}"));
 match string("field")?{
 "brief"=>o.brief=string("value")?.trim().into(),"status"=>o.status=string("value")?.into(),"deadline"=>o.deadline=string("value")?.into(),
 "action"=>{let aid=string("id")?;if v["remove"]==true{o.actions.retain(|a|a.id!=aid);}else{
 if !o.actions.iter().any(|a|a.id==aid){o.actions.push(Action{id:aid.into(),..Default::default()});}
 let a=o.actions.iter_mut().find(|a|a.id==aid).unwrap();if let Some(source)=v["source_record"].as_str(){a.source_record=Some(source.into());}if let Some(t)=v["text"].as_str(){a.text=t.trim().into();}if let Some(d)=v["deadline"].as_str(){a.deadline=d.into();}if let Some(d)=v["done"].as_bool(){a.done=d;}
 }},_=>return Err("Unknown overview field.".into())}
 save(db,&o)
}

#[cfg(test)]
mod tests {
 use super::*;use crate::{db,library_export,managed_library};use serde_json::json;use std::sync::atomic::AtomicBool;
 fn edit(path:&std::path::Path,patch:serde_json::Value){db::change(path,serde_json::from_value(json!({"action":"update_project_overview","target":7,"value":patch.to_string()})).unwrap()).unwrap();}
 fn command(path:&std::path::Path,action:&str){db::change(path,serde_json::from_value(json!({"action":action,"target":7})).unwrap()).unwrap();}
 #[test] fn overview_survives_history_delete_and_portable_backup(){
  let temp=tempfile::tempdir().unwrap();let data=temp.path().join("data");std::fs::create_dir(&data).unwrap();let path=data.join("library.sqlite");db::init(&path).unwrap();let root=temp.path().join("Design");std::fs::create_dir(&root).unwrap();let conn=db::connect(&path).unwrap();conn.execute("INSERT INTO projects VALUES(7,'Client')",[]).unwrap();db::set_setting(&conn,"root",root.to_str().unwrap()).unwrap();drop(conn);
  edit(&path,json!({"field":"brief","value":"Brand refresh and website"}));edit(&path,json!({"field":"status","value":"waiting"}));edit(&path,json!({"field":"deadline","value":"2028-02-29"}));edit(&path,json!({"field":"action","id":"one","text":"Review first concepts","deadline":"2027-01-15"}));edit(&path,json!({"field":"action","id":"one","done":true}));
  command(&path,"undo_organisation");assert!(!db::load(&path,false).unwrap().project_overviews[0].actions[0].done);command(&path,"redo_organisation");assert!(db::load(&path,false).unwrap().project_overviews[0].actions[0].done);
  command(&path,"delete_project");assert!(db::load(&path,false).unwrap().project_overviews.is_empty());command(&path,"undo_organisation");assert_eq!(db::load(&path,false).unwrap().project_overviews[0].brief,"Brand refresh and website");
  let backupdir=temp.path().join("backups");std::fs::create_dir(&backupdir).unwrap();let backup=library_export::export(&path,&backupdir,"Overview",&AtomicBool::new(false),&mut |_|{}).unwrap();let restored=managed_library::open(std::path::Path::new(&backup.path)).unwrap();let lib=db::load(&restored,false).unwrap();let o=&lib.project_overviews[0];assert_eq!(o.status,"waiting");assert_eq!(o.deadline,"2028-02-29");assert_eq!(o.actions[0].deadline,"2027-01-15");assert!(o.actions[0].done);assert_eq!(o.project_id,lib.projects[0].id);
  let export=temp.path().join("metadata.json");db::export(&path,export.clone()).unwrap();let target=data.join("other.sqlite");db::init(&target).unwrap();db::connect(&target).unwrap().execute_batch("INSERT INTO projects VALUES(7,'Other'),(42,'Client');").unwrap();db::import(&target,export.clone()).unwrap();assert_eq!(db::load(&target,false).unwrap().project_overviews[0].project_id,42);
  // Older backups without this optional field must not erase newer project details.
  let mut old:serde_json::Value=serde_json::from_slice(&std::fs::read(&export).unwrap()).unwrap();old["library"].as_object_mut().unwrap().remove("project_overviews");std::fs::write(&export,old.to_string()).unwrap();db::import(&target,export).unwrap();assert_eq!(db::load(&target,false).unwrap().project_overviews[0].status,"waiting");
 }
 #[test] fn validates_dates_and_rejects_bad_edits_atomically(){
  assert!(date(""));assert!(date("2028-02-29"));for d in ["2027-02-29","2026-04-31","2026-13-01","0000-01-01","bad"]{assert!(!date(d));}
  let temp=tempfile::tempdir().unwrap();let path=temp.path().join("db.sqlite");db::init(&path).unwrap();db::connect(&path).unwrap().execute("INSERT INTO projects VALUES(7,'Client')",[]).unwrap();edit(&path,json!({"field":"brief","value":"Keep me"}));
  for patch in [json!({"field":"status","value":"unknown"}),json!({"field":"deadline","value":"2027-02-29"}),json!({"field":"action","id":"a","text":" "})]{assert!(db::change(&path,serde_json::from_value(json!({"action":"update_project_overview","target":7,"value":patch.to_string()})).unwrap()).is_err());}
  assert_eq!(db::load(&path,false).unwrap().project_overviews[0].brief,"Keep me");
 }
}
