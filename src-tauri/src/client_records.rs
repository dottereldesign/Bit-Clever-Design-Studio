use crate::db::{err,Result};
use rusqlite::{Connection,params};
use serde::{Serialize,Deserialize};
#[derive(Clone,Debug,Default,Serialize,Deserialize)]
#[serde(default)]
pub struct Contact {pub shared_id:String,pub id:String,pub project_id:i64,pub name:String,pub role:String,pub company:String,pub email:String,pub phone:String,pub notes:String,pub primary:bool,pub archived:bool}
#[derive(Clone,Debug,Default,Serialize,Deserialize)]
#[serde(default)]
pub struct Record {pub id:String,pub project_id:i64,pub kind:String,pub title:String,pub date:String,pub people:Vec<String>,pub body:String,pub status:String,pub files:Vec<i64>,pub related:Vec<String>,pub archived:bool}
#[derive(Clone,Default,Serialize,Deserialize)]
pub struct State {pub contacts:Vec<Contact>,pub records:Vec<Record>}
pub fn init(db:&Connection)->Result<()>{db.execute_batch("CREATE TABLE IF NOT EXISTS client_contacts(project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(project_id,id));CREATE TABLE IF NOT EXISTS client_records(project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(project_id,id));").map_err(err)}
pub fn load(db:&Connection)->Result<State>{
 fn rows<T:serde::de::DeserializeOwned>(db:&Connection,table:&str)->Result<Vec<T>>{let mut q=db.prepare(&format!("SELECT data FROM {table} ORDER BY project_id,id")).map_err(err)?;let rows=q.query_map([],|r|r.get::<_,String>(0)).map_err(err)?;rows.map(|r|serde_json::from_str(&r.map_err(err)?).map_err(err)).collect()}
 Ok(State{contacts:rows(db,"client_contacts")?,records:rows(db,"client_records")?})
}
fn put<T:Serialize>(db:&Connection,table:&str,p:i64,id:&str,value:&T)->Result<()>{db.execute(&format!("INSERT INTO {table} VALUES(?,?,?) ON CONFLICT(project_id,id) DO UPDATE SET data=excluded.data"),params![p,id,serde_json::to_string(value).map_err(err)?]).map_err(err)?;Ok(())}
pub fn save_contact(db:&Connection,c:&Contact)->Result<()>{if c.id.is_empty()||c.id.len()>100||c.name.trim().is_empty()||c.name.len()>300||c.role.len()>300||c.company.len()>300||c.email.len()>500||c.phone.len()>100||c.notes.len()>20000{return Err("Check contact details and enter a name.".into());}let mut saved=c.clone();saved.shared_id=crate::studio::contact_id(c);put(db,"client_contacts",saved.project_id,&saved.id,&saved)?;crate::studio::sync_contact(db,&saved)}
pub fn save_record(db:&Connection,r:&Record)->Result<()>{let statuses=match r.kind.as_str(){"meeting"=>vec![""],"feedback"=>vec!["open","resolved"],"decision"=>vec!["proposed","agreed","superseded"],_=>return Err("Choose a record type.".into())};if r.id.is_empty()||r.id.len()>100||r.title.trim().is_empty()||r.title.len()>500||r.body.len()>100000||!crate::project_overview::date(&r.date)||!statuses.contains(&r.status.as_str())||r.people.len()>100||r.files.len()>500||r.related.len()>100{return Err("Check the record title, date and status.".into());}put(db,"client_records",r.project_id,&r.id,r)}
pub fn restore(db:&Connection,state:State)->Result<()>{for c in state.contacts{save_contact(db,&c)?;}for r in state.records{save_record(db,&r)?;}Ok(())}
pub fn change(db:&Connection,project:i64,input:&str)->Result<()>{
 let exists:bool=db.query_row("SELECT EXISTS(SELECT 1 FROM projects WHERE id=?)",[project],|r|r.get(0)).map_err(err)?;if !exists{return Err("Project no longer exists.".into());}
 let v:serde_json::Value=serde_json::from_str(input).map_err(err)?;let id=v["id"].as_str().ok_or("Missing record ID")?;let state=load(db)?;
 if v["type"]=="action"{let r=state.records.iter().find(|r|r.project_id==project&&r.id==id&&!r.archived).ok_or("Record no longer exists")?;let aid=format!("record:{id}");let exists=crate::project_overview::load(db)?.iter().any(|o|o.project_id==project&&o.actions.iter().any(|a|a.id==aid));if !exists{crate::project_overview::change(db,project,&serde_json::json!({"field":"action","id":aid,"text":r.title,"source_record":id}).to_string())?;}return Ok(());}
 let patch=v["patch"].as_object().ok_or("Missing changes")?;
 if v["type"]=="contact"{
 let current=state.contacts.iter().find(|c|c.project_id==project&&c.id==id).cloned().unwrap_or(Contact{id:id.into(),project_id:project,..Default::default()});let mut data=serde_json::to_value(current).map_err(err)?;for(k,val)in patch{if !["name","role","company","email","phone","notes","primary","archived"].contains(&k.as_str()){return Err("Unknown contact field".into());}data[k]=val.clone();}let c:Contact=serde_json::from_value(data).map_err(err)?;
 if c.primary&&!c.archived{for mut other in state.contacts.into_iter().filter(|o|o.project_id==project&&o.id!=id&&o.primary){other.primary=false;save_contact(db,&other)?;}}save_contact(db,&c)
 }else if v["type"]=="record"{
 let current=state.records.iter().find(|r|r.project_id==project&&r.id==id).cloned().unwrap_or(Record{id:id.into(),project_id:project,..Default::default()});let mut data=serde_json::to_value(current).map_err(err)?;for(k,val)in patch{if !["kind","title","date","people","body","status","files","related","archived"].contains(&k.as_str()){return Err("Unknown record field".into());}data[k]=val.clone();}let r:Record=serde_json::from_value(data).map_err(err)?;
 for p in &r.people{if !state.contacts.iter().any(|c|c.project_id==project&&c.id==*p){return Err("Choose a contact in this project.".into());}}
 for f in r.files.iter().filter(|_|patch.contains_key("files")){let exists:bool=db.query_row("SELECT EXISTS(SELECT 1 FROM item_projects WHERE item_id=? AND label_id=?)",params![f,project],|row|row.get(0)).map_err(err)?;if !exists{return Err("Choose a file in this project.".into());}}
 for other in &r.related{if *other==r.id||!state.records.iter().any(|x|x.project_id==project&&x.id==*other){return Err("Choose another record in this project.".into());}}
 save_record(db,&r)
 }else{Err("Unknown client change".into())}
}

// Ordinary edits retain only the affected record, not every project's notes.
#[derive(Serialize,Deserialize)]
pub enum EditSnapshot { Contact(i64,Vec<Contact>), Record(i64,String,Option<Record>), Action(i64,Option<crate::project_overview::Overview>) }
pub fn snapshot(db:&Connection,project:i64,input:&str)->Result<EditSnapshot>{let v:serde_json::Value=serde_json::from_str(input).map_err(err)?;let id=v["id"].as_str().ok_or("Missing record ID")?;let state=load(db)?;match v["type"].as_str(){Some("contact")=>Ok(EditSnapshot::Contact(project,state.contacts.into_iter().filter(|c|c.project_id==project).collect())),Some("record")=>Ok(EditSnapshot::Record(project,id.into(),state.records.into_iter().find(|r|r.project_id==project&&r.id==id))),Some("action")=>Ok(EditSnapshot::Action(project,crate::project_overview::load(db)?.into_iter().find(|o|o.project_id==project))),_=>Err("Unknown client change".into())}}
pub fn inverse(db:&Connection,s:&EditSnapshot)->Result<EditSnapshot>{let(p,kind,id)=match s{EditSnapshot::Contact(p,_) =>(*p,"contact",""),EditSnapshot::Record(p,id,_) =>(*p,"record",id.as_str()),EditSnapshot::Action(p,_) =>(*p,"action","")};snapshot(db,p,&serde_json::json!({"type":kind,"id":id}).to_string())}
pub fn apply(db:&Connection,s:EditSnapshot)->Result<()>{match s{EditSnapshot::Contact(p,rows)=>{db.execute("DELETE FROM client_contacts WHERE project_id=?",[p]).map_err(err)?;for c in rows{save_contact(db,&c)?;}},EditSnapshot::Record(p,id,row)=>{db.execute("DELETE FROM client_records WHERE project_id=? AND id=?",params![p,id]).map_err(err)?;if let Some(r)=row{save_record(db,&r)?;}},EditSnapshot::Action(p,row)=>{db.execute("DELETE FROM project_overviews WHERE project_id=?",[p]).map_err(err)?;if let Some(o)=row{crate::project_overview::save(db,&o)?;}}}Ok(())}

#[cfg(test)]
mod tests {
 use super::*;use crate::{db,library_export,managed_library};use serde_json::json;use std::sync::atomic::AtomicBool;
 fn change(path:&std::path::Path,p:i64,v:serde_json::Value)->Result<()>{db::change(path,serde_json::from_value(json!({"action":"update_client_records","target":p,"value":v.to_string()})).unwrap())}
 #[test] fn records_links_actions_and_contacts_survive_history_and_backups(){
 let temp=tempfile::tempdir().unwrap();let data=temp.path().join("data");std::fs::create_dir(&data).unwrap();let path=data.join("library.sqlite");db::init(&path).unwrap();let conn=db::connect(&path).unwrap();let root=temp.path().join("Design");std::fs::create_dir(&root).unwrap();db::set_setting(&conn,"root",root.to_str().unwrap()).unwrap();conn.execute_batch("INSERT INTO projects VALUES(7,'Client'),(8,'Other');INSERT INTO items(id,path,name,kind,added) VALUES(100,'https://example.com','Reference','link',1);INSERT INTO item_projects(item_id,label_id) VALUES(100,7);").unwrap();drop(conn);
 change(&path,7,json!({"type":"contact","id":"person","patch":{"name":"Client contact","email":"example@example.com","primary":true}})).unwrap();
 change(&path,7,json!({"type":"record","id":"meeting","patch":{"kind":"meeting","title":"Kickoff","body":"Private meeting notes","date":"2026-11-12","people":["person"],"files":[100]}})).unwrap();
 change(&path,7,json!({"type":"record","id":"feedback","patch":{"kind":"feedback","title":"Revise the header","status":"open","related":["meeting"]}})).unwrap();
 change(&path,7,json!({"type":"record","id":"decision","patch":{"kind":"decision","title":"Use the second direction","status":"agreed","people":["person"],"related":["feedback"]}})).unwrap();
 for _ in 0..2{change(&path,7,json!({"type":"action","id":"feedback"})).unwrap();}
 let lib=db::load(&path,false).unwrap();assert_eq!(lib.project_overviews[0].actions.len(),1);assert_eq!(lib.project_overviews[0].actions[0].source_record.as_deref(),Some("feedback"));
 assert!(change(&path,8,json!({"type":"record","id":"bad","patch":{"kind":"meeting","title":"Bad link","files":[100]}})).is_err());
 change(&path,7,json!({"type":"contact","id":"person","patch":{"archived":true}})).unwrap();assert!(db::load(&path,false).unwrap().client_records.contacts[0].archived);
 db::change(&path,serde_json::from_value(json!({"action":"undo_organisation"})).unwrap()).unwrap();assert!(!db::load(&path,false).unwrap().client_records.contacts[0].archived);
 db::change(&path,serde_json::from_value(json!({"action":"delete_project","target":7})).unwrap()).unwrap();assert!(db::load(&path,false).unwrap().client_records.records.is_empty());db::change(&path,serde_json::from_value(json!({"action":"undo_organisation"})).unwrap()).unwrap();assert_eq!(db::load(&path,false).unwrap().client_records.records.len(),3);
 let dest=temp.path().join("backup");std::fs::create_dir(&dest).unwrap();let exported=library_export::export(&path,&dest,"Client records",&AtomicBool::new(false),&mut |_|{}).unwrap();let reopened=managed_library::open(std::path::Path::new(&exported.path)).unwrap();let restored=db::load(&reopened,false).unwrap();assert_eq!(restored.client_records.records.len(),3);let meeting=restored.client_records.records.iter().find(|r|r.id=="meeting").unwrap();assert_eq!(meeting.body,"Private meeting notes");assert_eq!(meeting.people,vec!["person"]);assert!(restored.items.iter().any(|i|i.id==meeting.files[0]));
 let metadata=temp.path().join("metadata.json");db::export(&path,metadata.clone()).unwrap();let other=data.join("other.sqlite");db::init(&other).unwrap();db::connect(&other).unwrap().execute_batch("INSERT INTO projects VALUES(42,'Client');INSERT INTO items(id,path,name,kind,added) VALUES(100,'https://other.example.com','Other','link',1);").unwrap();db::import(&other,metadata).unwrap();let merged=db::load(&other,false).unwrap();let meeting=merged.client_records.records.iter().find(|r|r.id=="meeting").unwrap();assert_eq!(meeting.project_id,42);assert_ne!(meeting.files[0],100);assert!(merged.items.iter().any(|i|i.id==meeting.files[0]&&i.path=="https://example.com"));
 change(&path,8,json!({"type":"record","id":"large","patch":{"kind":"meeting","title":"Other project","body":"x".repeat(50000)}})).unwrap();change(&path,7,json!({"type":"record","id":"feedback","patch":{"title":"Small edit"}})).unwrap();let history:String=db::connect(&path).unwrap().query_row("SELECT patches FROM organisation_history ORDER BY id DESC LIMIT 1",[],|r|r.get(0)).unwrap();assert!(history.len()<5000,"A record edit must not snapshot unrelated notes");
 }
}
