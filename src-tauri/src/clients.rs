//! Durable relationship history. SQL triggers share the writer's transaction, including Undo.
use crate::db::{self,err,Result};
use rusqlite::{params,Connection};
use serde::{Serialize,Deserialize};
#[derive(Clone,Serialize,Deserialize)]
pub struct Event {pub id:i64,pub key:String,pub clients:Vec<String>,pub entity:String,pub record:String,pub project:Option<i64>,pub title:String,pub before:Option<serde_json::Value>,pub after:Option<serde_json::Value>,pub action:String,#[serde(default)]pub batch:String,pub at:i64}
pub fn init(db:&Connection)->Result<()> {
 db.execute_batch("CREATE TABLE IF NOT EXISTS client_events(id INTEGER PRIMARY KEY AUTOINCREMENT,event_key TEXT NOT NULL UNIQUE,clients TEXT NOT NULL,entity TEXT NOT NULL,record TEXT NOT NULL,project INTEGER,title TEXT NOT NULL,before_data TEXT,after_data TEXT,action TEXT NOT NULL,at INTEGER NOT NULL);CREATE INDEX IF NOT EXISTS client_events_time ON client_events(at,id);").map_err(err)?;
 let has_batch:bool=db.query_row("SELECT EXISTS(SELECT 1 FROM pragma_table_info('client_events') WHERE name='batch')",[],|r|r.get(0)).map_err(err)?;
 if !has_batch {db.execute("ALTER TABLE client_events ADD COLUMN batch TEXT NOT NULL DEFAULT ''",[]).map_err(err)?;}
 for table in ["studio_records","client_records","client_contacts","project_overviews"] {
  for (op,old,new) in [("INSERT",false,true),("UPDATE",true,true),("DELETE",true,false)] {
   let a=if new{"NEW"}else{"OLD"};
   let entity=if table=="studio_records"{"studio"}else{table};
   let record=if table=="project_overviews"{format!("CAST({a}.project_id AS TEXT)")}else{format!("{a}.id")};
   let project=if table=="studio_records"{"NULL".into()}else{format!("{a}.project_id")};
   let title=format!("COALESCE(json_extract({a}.data,'$.name'),json_extract({a}.data,'$.title'),'Project overview')");
   let matching=if table=="studio_records" {
    let sides=if op=="UPDATE"{vec!["OLD","NEW"]}else{vec![a]};
    sides.iter().map(|s|format!("c.id={s}.id OR c.id=json_extract({s}.data,'$.parent') OR EXISTS(SELECT 1 FROM json_each(c.data,'$.projects') cp JOIN json_each({s}.data,'$.projects') ep ON cp.value=ep.value)")).collect::<Vec<_>>().join(" OR ")
   }else{format!("EXISTS(SELECT 1 FROM json_each(c.data,'$.projects') p WHERE p.value={a}.project_id)")};
   let self_row=if table=="studio_records"&&old{" UNION SELECT OLD.id WHERE OLD.kind='client'"}else{""};
   let clients=format!("(SELECT json_group_array(id) FROM (SELECT c.id FROM studio_records c WHERE c.kind='client' AND ({matching}){self_row}))");
   let compact=|side:&str|if table=="studio_records"{format!("json_set({side}.data,'$.avatar',CASE WHEN length(COALESCE(json_extract({side}.data,'$.avatar'),''))=0 THEN '' ELSE 'Profile picture ('||length(json_extract({side}.data,'$.avatar'))||' bytes)' END)")}else{format!("{side}.data")};
   let before=if old{compact("OLD")}else{"NULL".into()};let after=if new{compact("NEW")}else{"NULL".into()};
   let changed=if op=="UPDATE"{"json_remove(OLD.data,'$.updated')<>json_remove(NEW.data,'$.updated') AND "}else{""};
   db.execute_batch(&format!("DROP TRIGGER IF EXISTS client_feed_{table}_{op};CREATE TRIGGER client_feed_{table}_{op} AFTER {op} ON {table} WHEN COALESCE((SELECT value FROM settings WHERE key='client_event_action'),'update')<>'import_client_backup' AND {changed}json_array_length({clients})>0 BEGIN INSERT INTO client_events(event_key,clients,entity,record,project,title,before_data,after_data,action,batch,at) VALUES(lower(hex(randomblob(16))),{clients},'{entity}',{record},{project},{title},{before},{after},COALESCE((SELECT value FROM settings WHERE key='client_event_action'),'update'),COALESCE(NULLIF((SELECT value FROM settings WHERE key='client_event_batch'),''),lower(hex(randomblob(16)))),CAST(strftime('%s','now') AS INTEGER));END;")).map_err(err)?;
  }
 }

 for (op,a,before,after) in [("INSERT","NEW","NULL","json_object('file',i.name)"),("DELETE","OLD","json_object('file',i.name)","NULL")] {
  db.execute_batch(&format!("DROP TRIGGER IF EXISTS client_feed_membership_{op};CREATE TRIGGER client_feed_membership_{op} AFTER {op} ON item_projects WHEN COALESCE((SELECT value FROM settings WHERE key='client_event_action'),'update')<>'import_client_backup' BEGIN INSERT INTO client_events(event_key,clients,entity,record,project,title,before_data,after_data,action,batch,at) SELECT lower(hex(randomblob(16))),(SELECT json_group_array(c.id) FROM studio_records c WHERE c.kind='client' AND EXISTS(SELECT 1 FROM json_each(c.data,'$.projects') p WHERE p.value={a}.label_id)),'files',CAST(i.id AS TEXT),{a}.label_id,i.name,{before},{after},COALESCE((SELECT value FROM settings WHERE key='client_event_action'),'update'),COALESCE(NULLIF((SELECT value FROM settings WHERE key='client_event_batch'),''),lower(hex(randomblob(16)))),CAST(strftime('%s','now') AS INTEGER) FROM items i WHERE i.id={a}.item_id AND EXISTS(SELECT 1 FROM studio_records c,json_each(c.data,'$.projects') p WHERE c.kind='client' AND p.value={a}.label_id);END;")).map_err(err)?;
 }

 db.execute_batch("DROP TRIGGER IF EXISTS client_feed_item_edit;CREATE TRIGGER client_feed_item_edit AFTER UPDATE OF name,archived,missing ON items WHEN (OLD.name<>NEW.name OR OLD.archived<>NEW.archived OR OLD.missing<>NEW.missing) AND COALESCE((SELECT value FROM settings WHERE key='client_event_action'),'update')<>'import_client_backup' BEGIN INSERT INTO client_events(event_key,clients,entity,record,title,before_data,after_data,action,batch,at) SELECT lower(hex(randomblob(16))),json_group_array(c.id),'files',CAST(NEW.id AS TEXT),NEW.name,json_object('name',OLD.name,'archived',json(CASE OLD.archived WHEN 1 THEN 'true' ELSE 'false' END),'missing',OLD.missing),json_object('name',NEW.name,'archived',json(CASE NEW.archived WHEN 1 THEN 'true' ELSE 'false' END),'missing',NEW.missing),COALESCE((SELECT value FROM settings WHERE key='client_event_action'),'update'),COALESCE(NULLIF((SELECT value FROM settings WHERE key='client_event_batch'),''),lower(hex(randomblob(16)))),CAST(strftime('%s','now') AS INTEGER) FROM studio_records c WHERE c.kind='client' AND (EXISTS(SELECT 1 FROM item_projects ip JOIN json_each(c.data,'$.projects') p ON p.value=ip.label_id WHERE ip.item_id=NEW.id) OR EXISTS(SELECT 1 FROM studio_records r,json_each(r.data,'$.files') f WHERE (r.id=c.id OR json_extract(r.data,'$.parent')=c.id) AND f.value=NEW.id)) HAVING count(*)>0;END;").map_err(err)?;
 Ok(())
}
pub fn seed(db:&Connection)->Result<()> {
 if db::setting(db,"client_profiles_v1").is_none(){
  let tx=db;
  let mut q=tx.prepare("SELECT id,name FROM projects").map_err(err)?;let projects=q.query_map([],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?))).map_err(err)?.collect::<std::result::Result<Vec<_>,_>>().map_err(err)?;drop(q);
  for (id,name) in [("client:aanzpa","AANZPA"),("client:hoea-to-waka","Hoea tō Waka")]{
   if crate::studio::get(&tx,id)?.is_none()&&!crate::studio::load(&tx)?.iter().any(|c|c.kind=="client"&&normal(&c.name)==normal(name)){let e=crate::studio::Entry{id:id.into(),name:name.into(),kind:"client".into(),status:"active".into(),currency:"NZD".into(),projects:projects.iter().filter(|(_,n)|normal(n)==normal(name)).map(|(id,_)|*id).collect(),created:db::now(),updated:db::now(),..Default::default()};crate::studio::put(&tx,&e)?;}
  }
  db::set_setting(&tx,"client_profiles_v1","1")?;
 }
 Ok(())
}
fn normal(s:&str)->String{s.to_lowercase().replace('ō',"o").split_whitespace().collect::<Vec<_>>().join(" ")}
pub fn lead_client(db:&Connection,lead:&crate::studio::Entry,target:Option<i64>)->Result<String>{
 let target=target.or_else(||if lead.projects.len()==1{lead.projects.first().copied()}else{None}).or_else(||db.query_row("SELECT id FROM projects WHERE lower(trim(name))=lower(trim(?))",[&lead.name],|r|r.get::<_,i64>(0)).ok());
 let clients=crate::studio::load(db)?.into_iter().filter(|c|c.kind=="client"&&!c.archived).collect::<Vec<_>>();
 let matches=clients.iter().filter(|c|target.is_some_and(|p|c.projects.contains(&p))||(!lead.organization.is_none()&&c.organization==lead.organization)||normal(&c.name)==normal(&lead.name)).collect::<Vec<_>>();
 if matches.len()>1{return Err("More than one client matches this lead. Link its project to one client before handover.".into());}
 Ok(matches.first().map(|c|c.id.clone()).unwrap_or(format!("client:lead:{}",lead.id)))
}
pub fn handover(db:&Connection,lead:&crate::studio::Entry,pid:i64)->Result<()> {
 let id=lead_client(db,lead,Some(pid))?;let mut c=crate::studio::get(db,&id)?.unwrap_or(crate::studio::Entry{id,name:lead.name.clone(),kind:"client".into(),status:"active".into(),organization:lead.organization.clone(),contacts:lead.contacts.clone(),currency:lead.currency.clone(),created:db::now(),..Default::default()});
 if !c.projects.contains(&pid){c.projects.push(pid);}c.updated=db::now();crate::studio::put(db,&c)
}
pub fn events(db:&Connection,client:Option<&str>,before:Option<i64>,limit:i64)->Result<Vec<Event>> {
 let mut q=db.prepare("SELECT id,event_key,clients,entity,record,project,title,before_data,after_data,action,at,batch FROM client_events WHERE (?1 IS NULL OR EXISTS(SELECT 1 FROM json_each(clients) WHERE value=?1)) AND (?2 IS NULL OR id<?2) ORDER BY id DESC LIMIT ?3").map_err(err)?;
 let rows=q.query_map(params![client,before,limit],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?,r.get::<_,String>(4)?,r.get::<_,Option<i64>>(5)?,r.get::<_,String>(6)?,r.get::<_,Option<String>>(7)?,r.get::<_,Option<String>>(8)?,r.get::<_,String>(9)?,r.get::<_,i64>(10)?,r.get::<_,String>(11)?))).map_err(err)?;
 rows.map(|r|{let(id,key,clients,entity,record,project,title,before,after,action,at,batch)=r.map_err(err)?;Ok(Event{id,key,clients:serde_json::from_str(&clients).map_err(err)?,entity,record,project,title,before:before.map(|s|serde_json::from_str(&s).map_err(err)).transpose()?,after:after.map(|s|serde_json::from_str(&s).map_err(err)).transpose()?,action,batch,at})}).collect()
}
pub fn import(db:&Connection,events:Vec<Event>,projects:&std::collections::HashMap<i64,i64>,items:&std::collections::HashMap<i64,i64>)->Result<()> {
 for mut e in events {
  for value in [&mut e.before,&mut e.after].into_iter().flatten(){
   for (key,map) in [("files",items),("projects",projects)] {if let Some(ids)=value.get_mut(key).and_then(serde_json::Value::as_array_mut){for id in ids {if let Some(old)=id.as_i64(){*id=map.get(&old).map(|v|serde_json::json!(v)).unwrap_or(serde_json::json!("Unavailable historical reference"));}}}}
   if let Some(id)=value.get("project_id").and_then(serde_json::Value::as_i64){value["project_id"]=projects.get(&id).map(|v|serde_json::json!(v)).unwrap_or(serde_json::Value::Null);}
  }
  db.execute("INSERT OR IGNORE INTO client_events(event_key,clients,entity,record,project,title,before_data,after_data,action,batch,at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",params![e.key,serde_json::to_string(&e.clients).map_err(err)?,e.entity,e.record,e.project.and_then(|p|projects.get(&p).copied()),e.title,e.before.map(|v|v.to_string()),e.after.map(|v|v.to_string()),e.action,e.batch,e.at]).map_err(err)?;}Ok(())
}

#[cfg(test)]mod tests{
 use super::*;use serde_json::json;use std::path::Path;
 fn edit(path:&Path,id:&str,patch:serde_json::Value)->Result<()>{db::change(path,serde_json::from_value(json!({"action":"update_studio","value":json!({"id":id,"patch":patch}).to_string()})).unwrap())}
 fn command(path:&Path,action:&str){db::change(path,serde_json::from_value(json!({"action":action})).unwrap()).unwrap();}
 #[test]fn profile_seed_feed_undo_backup_and_remap(){
  let tmp=tempfile::tempdir().unwrap();let path=tmp.path().join("source.sqlite");db::init(&path).unwrap();let c=db::connect(&path).unwrap();c.execute("INSERT INTO projects(id,name) VALUES(7,'AANZPA'),(8,'Hoea to Waka')",[]).unwrap();
  command(&path,"setup_clients");command(&path,"setup_clients");assert_eq!(crate::studio::load(&c).unwrap().iter().filter(|e|e.kind=="client").count(),2);assert_eq!(crate::studio::get(&c,"client:aanzpa").unwrap().unwrap().projects,vec![7]);assert_eq!(crate::studio::get(&c,"client:hoea-to-waka").unwrap().unwrap().projects,vec![8]);
  edit(&path,"quote",json!({"kind":"client_entry","parent":"client:aanzpa","name":"Brand quote","service":"quote","value":1000,"currency":"NZD"})).unwrap();edit(&path,"quote",json!({"value":1250})).unwrap();let rows=events(&c,Some("client:aanzpa"),None,100).unwrap();assert_eq!(rows[0].before.as_ref().unwrap()["value"],json!(1000.0));assert_eq!(rows[0].after.as_ref().unwrap()["value"],json!(1250.0));
  let count=events(&c,None,None,-1).unwrap().len();assert!(edit(&path,"quote",json!({"value":-1})).is_err());assert_eq!(events(&c,None,None,-1).unwrap().len(),count);
  command(&path,"undo_organisation");assert_eq!(crate::studio::get(&c,"quote").unwrap().unwrap().value,Some(1000.));assert_eq!(events(&c,Some("client:aanzpa"),None,1).unwrap()[0].action,"undo_organisation");command(&path,"redo_organisation");assert_eq!(crate::studio::get(&c,"quote").unwrap().unwrap().value,Some(1250.));
  db::change(&path,serde_json::from_value(json!({"action":"update_project_overview","target":7,"value":json!({"field":"action","id":"a","text":"Prepare","done":false}).to_string()})).unwrap()).unwrap();assert_eq!(events(&c,Some("client:aanzpa"),None,1).unwrap()[0].entity,"project_overviews");
  let backup=tmp.path().join("backup.json");db::export(&path,backup.clone()).unwrap();let target=tmp.path().join("target.sqlite");db::init(&target).unwrap();db::connect(&target).unwrap().execute("INSERT INTO projects(id,name) VALUES(99,'AANZPA')",[]).unwrap();db::import(&target,backup.clone()).unwrap();let restored=db::connect(&target).unwrap();assert_eq!(crate::studio::get(&restored,"client:aanzpa").unwrap().unwrap().projects,vec![99]);let before=events(&restored,None,None,-1).unwrap();assert!(before.iter().any(|e|e.entity=="project_overviews"&&e.project==Some(99)));db::import(&target,backup).unwrap();assert_eq!(events(&restored,None,None,-1).unwrap().len(),before.len());
 }

 #[test]fn meeting_pack_copies_originals_escapes_notes_and_never_overwrites(){
  let tmp=tempfile::tempdir().unwrap();let path=tmp.path().join("db.sqlite");db::init(&path).unwrap();command(&path,"setup_clients");let c=db::connect(&path).unwrap();let file=tmp.path().join("brief.txt");std::fs::write(&file,"Original brief").unwrap();c.execute("INSERT INTO items(id,path,name,kind,added) VALUES(1,?,'Brief','file',1)",[file.to_str().unwrap()]).unwrap();
  edit(&path,"meeting",json!({"kind":"client_entry","parent":"client:aanzpa","name":"Review <concepts>","service":"meeting","body":"<script>alert(1)</script>","files":[1],"actions":[{"id":"a","text":"Read brief","deadline":"","done":false}]})).unwrap();
  let first=meeting_pack(&c,"meeting",tmp.path()).unwrap();let second=meeting_pack(&c,"meeting",tmp.path()).unwrap();assert_ne!(first,second);let html=std::fs::read_to_string(&first).unwrap();assert!(html.contains("&lt;script&gt;"));assert!(!html.contains("<script>"));assert!(html.contains("Read brief"));let folder=std::path::Path::new(&first).parent().unwrap();assert_eq!(std::fs::read_to_string(folder.join("1-Brief.txt")).unwrap(),"Original brief");assert!(!folder.join("INCOMPLETE.txt").exists());
 }
 #[test]fn won_lead_creates_client_atomically_and_undoes(){let tmp=tempfile::tempdir().unwrap();let path=tmp.path().join("db.sqlite");db::init(&path).unwrap();edit(&path,"lead",json!({"kind":"lead","name":"New customer","status":"new"})).unwrap();db::change(&path,serde_json::from_value(json!({"action":"win_studio_lead","value":"lead"})).unwrap()).unwrap();let c=db::connect(&path).unwrap();let client=crate::studio::get(&c,"client:lead:lead").unwrap().unwrap();assert_eq!(client.projects.len(),1);command(&path,"undo_organisation");assert!(crate::studio::get(&c,"client:lead:lead").unwrap().is_none());command(&path,"redo_organisation");assert_eq!(crate::studio::get(&c,"client:lead:lead").unwrap().unwrap().projects,client.projects);}
}

/// Offline, printable meeting document plus original attachments. No remote content executes.
pub fn meeting_pack(db:&Connection,id:&str,destination:&std::path::Path)->Result<String>{
 let e=crate::studio::get(db,id)?.filter(|e|e.kind=="client_entry"&&e.service=="meeting").ok_or("Meeting no longer exists")?;
 let root=destination.canonicalize().map_err(err)?;if !root.is_dir(){return Err("Choose a folder for the meeting pack.".into());}
 let safe=|s:&str|s.chars().map(|c|if c.is_alphanumeric()||c==' '||c=='-'||c=='_' {c}else{'_'}).take(80).collect::<String>();
 let mut folder=root.join(format!("{} - {}",if e.date.is_empty(){"Meeting"}else{&e.date},safe(&e.name)));let mut n=2;while folder.exists(){folder=root.join(format!("{} ({n})",safe(&e.name)));n+=1;}
 std::fs::create_dir(&folder).map_err(err)?;std::fs::write(folder.join("INCOMPLETE.txt"),"This meeting pack did not finish exporting. Retry before relying on it.").map_err(err)?;
 let esc=|s:&str|s.replace('&',"&amp;").replace('<',"&lt;").replace('>',"&gt;").replace('"',"&quot;");
 let mut attachments=String::new();for id in &e.files {let (name,path,kind):(String,String,String)=db.query_row("SELECT name,path,kind FROM items WHERE id=?",[id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).map_err(err)?;if kind=="link"{attachments.push_str(&format!("<li>{}: {}</li>",esc(&name),esc(&path)));continue;}let source=std::path::Path::new(&path);let ext=source.extension().and_then(|s|s.to_str()).unwrap_or("file");let file=format!("{id}-{}.{}",safe(&name),safe(ext));std::fs::copy(source,folder.join(&file)).map_err(|error|format!("Could not copy {}: {error}. Incomplete pack: {}",name,folder.display()))?;attachments.push_str(&format!("<li>{}</li>",esc(&file)));}
 let agenda=e.milestones.iter().map(|a|format!("<li>{}</li>",esc(&a.text))).collect::<String>();
 let checklist=e.actions.iter().map(|a|format!("<li>{} {}</li>",if a.done{"✓"}else{"□"},esc(&a.text))).collect::<String>();
 let html=format!("<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width'><meta http-equiv='Content-Security-Policy' content=\"default-src 'none'; style-src 'unsafe-inline'\"><title>{}</title><style>body{{font:16px/1.6 system-ui;max-width:800px;margin:40px auto;padding:24px;color:#18252c}}p{{white-space:pre-wrap}}h1{{line-height:1.2}}h2{{font-size:18px;margin-top:28px}}small{{color:#65716b}}@media print{{body{{margin:0;padding:0}}small{{display:none}}}}</style><h1>{}</h1><p>{} {} · {}</p><p>{}</p><p>{}</p><h2>Agenda</h2><p>{}</p><ol>{}</ol><h2>Review beforehand</h2><ul>{}</ul><h2>Notes & decisions</h2><p>{}</p><h2>Take with me</h2><p>{}</p><ul>{}</ul><small>Open this file in your browser and Print → Save as PDF. Attachments are beside this document. Web links require an internet connection.</small></html>",esc(&e.name),esc(&e.name),esc(&e.date),esc(&e.channel),esc(&e.audience),esc(&e.source),esc(&e.website),esc(&e.body),agenda,checklist,esc(&e.message),esc(&e.results),attachments);
 std::fs::write(folder.join("Meeting.html"),html).map_err(err)?;std::fs::remove_file(folder.join("INCOMPLETE.txt")).map_err(err)?;Ok(folder.join("Meeting.html").to_string_lossy().into_owned())
}

pub fn begin(db:&Connection,action:&str)->Result<()>{let id:String=db.query_row("SELECT lower(hex(randomblob(16)))",[],|r|r.get(0)).map_err(err)?;db::set_setting(db,"client_event_batch",&id)?;db::set_setting(db,"client_event_action",action)}
pub fn end(db:&Connection)->Result<()>{db::set_setting(db,"client_event_batch","")?;db::set_setting(db,"client_event_action","update")}
