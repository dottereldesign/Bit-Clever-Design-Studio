//! One transaction for the reviewed lead-to-client handover.
use crate::{db::{err,Result},studio,history::Patch};
use rusqlite::Connection;
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Contact {pub id:String,pub name:String,pub email:String,pub phone:String,pub updated:i64}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Meeting {pub name:String,pub date:String,pub time:String}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CloseLead {pub id:String,pub updated:i64,pub outcome:String,pub reason:String,pub organization:Option<String>,pub organization_name:String,pub contacts:Vec<Contact>,pub project:Option<i64>,pub project_name:String,pub deadline:Option<String>,pub meeting:Option<Meeting>,pub value:Option<f64>,pub currency:String}
pub fn parse(input:&str)->Result<CloseLead>{serde_json::from_str(input).map_err(err)}
fn organization_id(c:&CloseLead)->String{c.organization.clone().unwrap_or(format!("client:lead:{}",c.id))}
fn meeting_id(c:&CloseLead)->String{format!("lead-kickoff:{}",c.id)}
pub fn snapshot(db:&Connection,input:&str)->Result<Vec<Patch>>{
 let c=parse(input)?;
 let mut ids=vec![c.id.clone(),organization_id(&c),meeting_id(&c)];
 ids.extend(c.contacts.iter().map(|p|p.id.clone()));
 ids.extend(studio::load(db)?.into_iter().filter(|e|e.kind=="contact").map(|e|e.id));
 ids.sort();ids.dedup();
 let mut patches=vec![Patch::ProjectOrganisation(crate::project_folders::snapshot_with_clients(db)?)];
 for id in ids {patches.push(Patch::Studio(studio::snapshot(db,&id)?));}
 Ok(patches)
}
pub fn close(db:&Connection,input:&str)->Result<()> {
 let c=parse(input)?;let lead=studio::get(db,&c.id)?.ok_or("Lead no longer exists")?;
 if lead.kind!="lead"||lead.archived{return Err("Choose an available lead.".into());}
 if lead.updated!=c.updated{return Err("This lead changed. Close this window and review the latest details.".into());}
 if lead.handover_project.is_some(){return Err("This lead already has a handover project. Open that project to continue.".into());}
 if c.reason.len()>5000{return Err("Keep the close note under 5,000 characters.".into());}
 if c.outcome=="lost" {
  let results=if c.reason.trim().is_empty(){lead.results}else if lead.results.is_empty(){c.reason.trim().into()}else{format!("{}\n\nClose note: {}",lead.results,c.reason.trim())};
  return studio::change(db,&json!({"id":c.id,"patch":{"status":"lost","results":results}}).to_string());
 }
 if c.outcome!="won"{return Err("Choose Won or Lost.".into());}
 if c.currency.len()!=3||!c.currency.bytes().all(|b|b.is_ascii_uppercase())||c.value.is_some_and(|v|!v.is_finite()||v<0.){return Err("Check the lead value and three-letter currency.".into());}
 if c.contacts.is_empty()||c.contacts.len()>100{return Err("Confirm at least one contact.".into());}
 if c.deadline.as_ref().is_some_and(|d|!crate::project_overview::date(d)){return Err("Choose a valid project deadline.".into());}
 let org_id=organization_id(&c);
 if c.organization.is_some(){let org=studio::get(db,&org_id)?.ok_or("Organisation is unavailable")?;if !["client","organization"].contains(&org.kind.as_str())||org.archived{return Err("Choose an active organisation.".into());}}
 else {
  if c.organization_name.trim().is_empty()||c.organization_name.len()>300{return Err("Enter an organisation name.".into());}
  if studio::get(db,&org_id)?.is_some()||studio::load(db)?.iter().any(|e|["client","organization"].contains(&e.kind.as_str())&&e.name.trim().to_lowercase()==c.organization_name.trim().to_lowercase()){return Err("An organisation with this name already exists. Choose it from the list.".into());}
  studio::change(db,&json!({"id":org_id,"patch":{"kind":"client","name":c.organization_name.trim(),"status":"active","currency":c.currency}}).to_string())?;
 }
 let mut contact_ids=std::collections::HashSet::new();
 for contact in &c.contacts {
  if contact.id.is_empty()||contact.id.len()>100||!contact_ids.insert(contact.id.clone())||contact.name.trim().is_empty()||contact.name.len()>300||contact.email.len()>500||contact.phone.len()>100{return Err("Check each contact’s name and details.".into());}
  if !contact.email.trim().is_empty()&&(!contact.email.contains('@')||contact.email.chars().any(char::is_whitespace)){return Err("Check the contact email address.".into());}
  let existing=studio::get(db,&contact.id)?;
  if existing.as_ref().is_some_and(|e|e.kind!="contact"||e.archived||e.updated!=contact.updated)||existing.is_none()&&contact.updated!=0{return Err("A contact changed or is unavailable. Review the latest details.".into());}
  let mut patch=json!({"name":contact.name.trim(),"email":contact.email.trim(),"phone":contact.phone.trim(),"organization":org_id});
  if existing.is_none(){patch["kind"]=json!("contact");}
  studio::change(db,&json!({"id":contact.id,"patch":patch}).to_string())?;
 }
 let pid=if let Some(pid)=c.project {
  if !db.query_row("SELECT EXISTS(SELECT 1 FROM projects WHERE id=?)",[pid],|r|r.get::<_,bool>(0)).map_err(err)?{return Err("Project is unavailable.".into());}
  if studio::load(db)?.iter().any(|e|["client","organization"].contains(&e.kind.as_str())&&e.id!=org_id&&e.projects.contains(&pid)){return Err("This project belongs to another organisation. Choose a different project.".into());}
  pid
 }else{
  if c.project_name.trim().is_empty()||c.project_name.len()>300{return Err("Enter a project name.".into());}
  if db.query_row("SELECT EXISTS(SELECT 1 FROM projects WHERE lower(trim(name))=lower(trim(?)))",[&c.project_name],|r|r.get::<_,bool>(0)).map_err(err)?{return Err("A project with this name already exists. Choose it from the list.".into());}
  db.execute("INSERT INTO projects(name) VALUES(?)",[c.project_name.trim()]).map_err(err)?;db.last_insert_rowid()
 };
 studio::change(db,&json!({"id":c.id,"patch":{"organization":org_id,"contacts":c.contacts.iter().map(|v|&v.id).collect::<Vec<_>>(),"value":c.value,"currency":c.currency}}).to_string())?;
 studio::win(db,&c.id,Some(pid))?;
 let mut overview=crate::project_overview::load(db)?.into_iter().find(|o|o.project_id==pid).ok_or("Project overview is unavailable")?;
 if overview.status=="planned"{overview.status="active".into();}
 if let Some(deadline)=&c.deadline{overview.deadline=deadline.clone();}
 crate::project_overview::save(db,&overview)?;
 if let Some(meeting)=&c.meeting {
  let valid_time=meeting.time.is_ascii()&&meeting.time.len()==5&&meeting.time.as_bytes()[2]==b':'&&meeting.time[..2].parse::<u8>().is_ok_and(|h|h<24)&&meeting.time[3..].parse::<u8>().is_ok_and(|m|m<60);
  if meeting.name.trim().is_empty()||meeting.name.len()>300||meeting.date.is_empty()||!crate::project_overview::date(&meeting.date)||!valid_time{return Err("Enter the first meeting title, date and time.".into());}
  if studio::get(db,&meeting_id(&c))?.is_some(){return Err("A kickoff meeting already exists for this lead.".into());}
  studio::change(db,&json!({"id":meeting_id(&c),"patch":{"kind":"client_entry","service":"meeting","name":meeting.name.trim(),"parent":org_id,"projects":[pid],"contacts":c.contacts.iter().map(|v|&v.id).collect::<Vec<_>>(),"date":meeting.date,"channel":meeting.time,"status":"open"}}).to_string())?;
 }
 Ok(())
}

#[cfg(test)]
mod tests {
 use super::*;
 use crate::db;
 use std::path::Path;
 fn command(path:&Path,action:&str,value:serde_json::Value)->Result<()>{db::change(path,serde_json::from_value(json!({"action":action,"value":if value.is_null(){None}else{Some(value.to_string())}})).unwrap())}
 fn setup(path:&Path){db::init(path).unwrap();command(path,"update_studio",json!({"id":"lead","patch":{"kind":"lead","name":"Website lead","status":"proposal","body":"Keep the brief"}})).unwrap();}
 fn request(path:&Path)->serde_json::Value{let conn=db::connect(path).unwrap();let lead=studio::get(&conn,"lead").unwrap().unwrap();json!({"id":"lead","updated":lead.updated,"outcome":"won","reason":"","organization":null,"organization_name":"Example organisation","contacts":[{"id":"person","name":"Alex","email":"alex@example.com","phone":"123","updated":0}],"project":null,"project_name":"Website delivery","deadline":"2027-02-15","meeting":{"name":"Kickoff","date":"2027-01-10","time":"09:30"},"value":2500.0,"currency":"NZD"})}
 #[test]fn reviewed_handover_is_atomic_and_undoable(){
  let dir=tempfile::tempdir().unwrap();let path=dir.path().join("library.sqlite");setup(&path);let c=request(&path);command(&path,"close_studio_lead",c.clone()).unwrap();
  let conn=db::connect(&path).unwrap();let lead=studio::get(&conn,"lead").unwrap().unwrap();let pid=lead.handover_project.unwrap();assert_eq!(lead.status,"won");assert!(lead.closed_at.is_some());assert_eq!(lead.organization.as_deref(),Some("client:lead:lead"));
  let org=studio::get(&conn,"client:lead:lead").unwrap().unwrap();assert_eq!(org.name,"Example organisation");assert!(org.projects.contains(&pid));
  let project=crate::project_overview::load(&conn).unwrap().into_iter().find(|o|o.project_id==pid).unwrap();assert_eq!(project.status,"active");assert_eq!(project.deadline,"2027-02-15");assert_eq!(project.brief,"Keep the brief");
  let meeting=studio::get(&conn,"lead-kickoff:lead").unwrap().unwrap();assert_eq!(meeting.projects,vec![pid]);assert_eq!(meeting.channel,"09:30");assert_eq!(meeting.parent.as_deref(),Some(org.id.as_str()));
  assert_eq!(crate::client_records::load(&conn).unwrap().contacts[0].email,"alex@example.com");
  assert!(command(&path,"close_studio_lead",c).is_err());assert_eq!(db::load(&path,false).unwrap().projects.len(),1);
  command(&path,"undo_organisation",json!(null)).unwrap();assert_eq!(studio::get(&conn,"lead").unwrap().unwrap().status,"proposal");assert!(studio::get(&conn,"person").unwrap().is_none());assert!(studio::get(&conn,"client:lead:lead").unwrap().is_none());assert!(studio::get(&conn,"lead-kickoff:lead").unwrap().is_none());assert!(db::load(&path,false).unwrap().projects.is_empty());
  command(&path,"redo_organisation",json!(null)).unwrap();assert_eq!(studio::get(&conn,"lead").unwrap().unwrap().handover_project,Some(pid));assert!(studio::get(&conn,"lead-kickoff:lead").unwrap().is_some());assert_eq!(crate::client_records::load(&conn).unwrap().contacts[0].email,"alex@example.com");
 }
 #[test]fn existing_organisation_project_and_contact_are_reused(){
  let dir=tempfile::tempdir().unwrap();let path=dir.path().join("library.sqlite");setup(&path);
  let conn=db::connect(&path).unwrap();conn.execute("INSERT INTO projects(name) VALUES('Existing delivery')",[]).unwrap();let pid=conn.last_insert_rowid();
  command(&path,"update_studio",json!({"id":"org","patch":{"kind":"client","name":"Existing client","projects":[pid]}})).unwrap();
  command(&path,"update_studio",json!({"id":"person","patch":{"kind":"contact","name":"Alex","email":"old@example.com","organization":"org"}})).unwrap();
  let mut c=request(&path);c["organization"]=json!("org");c["project"]=json!(pid);c["contacts"][0]["updated"]=json!(studio::get(&conn,"person").unwrap().unwrap().updated);
  command(&path,"close_studio_lead",c).unwrap();assert_eq!(db::load(&path,false).unwrap().projects.len(),1);assert_eq!(studio::load(&conn).unwrap().iter().filter(|e|e.kind=="client").count(),1);assert_eq!(studio::get(&conn,"person").unwrap().unwrap().email,"alex@example.com");
  command(&path,"undo_organisation",json!(null)).unwrap();assert_eq!(db::load(&path,false).unwrap().projects.len(),1);assert_eq!(studio::get(&conn,"person").unwrap().unwrap().email,"old@example.com");assert!(studio::get(&conn,"org").unwrap().is_some());
 }
 #[test]fn invalid_meeting_rolls_back_every_part(){
  let dir=tempfile::tempdir().unwrap();let path=dir.path().join("library.sqlite");setup(&path);let mut c=request(&path);c["meeting"]["time"]=json!("99:99");assert!(command(&path,"close_studio_lead",c).is_err());
  let conn=db::connect(&path).unwrap();assert_eq!(studio::get(&conn,"lead").unwrap().unwrap().status,"proposal");assert!(studio::get(&conn,"person").unwrap().is_none());assert!(studio::get(&conn,"client:lead:lead").unwrap().is_none());assert!(db::load(&path,false).unwrap().projects.is_empty());
 }
 #[test]fn lost_and_stale_leads_do_not_create_projects(){
  let dir=tempfile::tempdir().unwrap();let path=dir.path().join("library.sqlite");setup(&path);let mut c=request(&path);c["updated"]=json!(0);assert!(command(&path,"close_studio_lead",c).is_err());let mut c=request(&path);c["outcome"]=json!("lost");c["reason"]=json!("Timing changed");command(&path,"close_studio_lead",c).unwrap();
  let conn=db::connect(&path).unwrap();let lead=studio::get(&conn,"lead").unwrap().unwrap();assert_eq!(lead.status,"lost");assert!(lead.closed_at.is_some());assert_eq!(lead.results,"Timing changed");assert!(db::load(&path,false).unwrap().projects.is_empty());assert_eq!(studio::load(&conn).unwrap().iter().filter(|e|e.kind=="client").count(),0);
 }
}
