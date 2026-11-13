use crate::{db::{self,err,Result},studio};
use serde::{Deserialize,Serialize};
use sha2::{Digest,Sha256};
use std::{path::{Path,PathBuf},io::{Read,Write}};

#[derive(Clone,Debug,Serialize,Deserialize)]
pub struct Meeting {
 pub source_id:String, pub uid:String, pub name:String, pub project_name:String,
 pub start:String, pub end:String, pub location:String, pub join_url:String,
 pub source_url:String, pub cancelled:bool,
}
#[derive(Clone,Debug,Serialize,Deserialize)]
pub struct Config {pub library:String,pub meetings:Vec<Meeting>,#[serde(default)]pub generation:String}
#[derive(Serialize)]
pub struct Status {pub initialised:bool,pub connected:bool,pub last_sync:i64,pub meetings:Vec<Meeting>}
pub fn config_path(folder:&Path)->PathBuf{folder.join("calendar-settings.json")}
fn secret_path(folder:&Path)->PathBuf{folder.join("calendar-feed.protected")}
pub fn config(folder:&Path,path:&Path)->Result<Config>{
 let file=config_path(folder);let db=db::connect(path)?;
 let saved=studio::load(&db)?.into_iter().filter_map(|e|e.meeting).collect::<Vec<_>>();
 if !file.exists(){return Ok(Config{library:path.to_string_lossy().into_owned(),meetings:saved,generation:String::new()});}
 let mut c:Config=serde_json::from_slice(&std::fs::read(file).map_err(err)?).map_err(|_|"Calendar configuration could not be read.")?;
 if Path::new(&c.library)!=path{return Ok(Config{library:path.to_string_lossy().into_owned(),meetings:saved,generation:String::new()});}
 for m in &mut c.meetings{if let Some(current)=saved.iter().find(|e|e.source_id==m.source_id){*m=current.clone();}}
 Ok(c)
}
fn write_config(folder:&Path,c:&Config)->Result<()>{atomic(&config_path(folder),&serde_json::to_vec(c).map_err(err)?)}
fn atomic(path:&Path,bytes:&[u8])->Result<()>{let mut file=tempfile::NamedTempFile::new_in(path.parent().ok_or("Calendar folder missing")?).map_err(err)?;file.write_all(bytes).map_err(err)?;file.persist(path).map_err(|_|"Could not save calendar settings.")?;Ok(())}
fn identity(id:&str)->String{format!("calendar:{:x}",Sha256::digest(id.as_bytes()))}
pub fn status(folder:&Path,path:&Path)->Result<Status>{let c=config(folder,path)?;let db=db::connect(path)?;Ok(Status{initialised:false,connected:!c.generation.is_empty()&&secret_path(folder).exists(),last_sync:db::setting(&db,"calendar_last_sync").and_then(|v|v.parse().ok()).unwrap_or(0),meetings:c.meetings})}
pub fn needs_initialise(folder:&Path,path:&Path)->Result<bool>{
 let c=config(folder,path)?;let db=db::connect(path)?;
 for meeting in c.meetings{if studio::get(&db,&identity(&meeting.source_id))?.is_none(){return Ok(true);}}
 Ok(false)
}
pub fn initialise(folder:&Path,path:&Path)->Result<bool>{
 let c=config(folder,path)?;let db=db::connect(path)?;let tx=db.unchecked_transaction().map_err(err)?;let mut changed=false;
 for meeting in &c.meetings {if studio::get(&tx,&identity(&meeting.source_id))?.is_none(){save(&tx,meeting)?;changed=true;}}
 tx.commit().map_err(err)?;Ok(changed)
}
pub fn validate_url(value:&str)->Result<String>{
 let u=url::Url::parse(value.trim()).map_err(|_|"Paste Google's Secret address in iCal format.")?;
 if u.scheme()!="https"||u.host_str()!=Some("calendar.google.com")||u.port().is_some()||!u.username().is_empty()||u.password().is_some()||!u.path().starts_with("/calendar/ical/")||!u.path().contains("/private-")||!u.path().ends_with("/basic.ics")||u.query().is_some()||u.fragment().is_some(){return Err("Use the Secret address in iCal format from Google Calendar settings.".into());}Ok(u.to_string())
}
// Windows protects the feed credential for the current user. It never enters SQLite,
// backups, command-line arguments, diagnostic fields or source files.
#[cfg(windows)]
fn protect(input:&[u8],decrypt:bool)->Result<Vec<u8>>{
 use std::os::windows::process::CommandExt;use std::process::{Command,Stdio};use base64::Engine;
 let operation=if decrypt{"Unprotect"}else{"Protect"};
 let script=format!("Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $r=[System.Security.Cryptography.ProtectedData]::{operation}($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))");
 let mut child=Command::new("powershell.exe").args(["-NoProfile","-NonInteractive","-Command",&script]).creation_flags(0x08000000).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().map_err(|_|"Windows credential protection is unavailable.")?;
 child.stdin.take().ok_or("Credential input unavailable")?.write_all(base64::engine::general_purpose::STANDARD.encode(input).as_bytes()).map_err(|_|"Could not protect calendar credentials.")?;
 let output=child.wait_with_output().map_err(|_|"Could not protect calendar credentials.")?;
 if !output.status.success(){return Err("Calendar credentials need reconnecting on this Windows account.".into());}
 base64::engine::general_purpose::STANDARD.decode(String::from_utf8_lossy(&output.stdout).trim()).map_err(|_|"Calendar credential protection failed.".into())
}
#[cfg(not(windows))]
fn protect(_: &[u8],_:bool)->Result<Vec<u8>>{Err("Calendar credential storage currently requires Windows.".into())}
pub fn connect(folder:&Path,path:&Path,url:&str)->Result<()> {
 let url=validate_url(url)?;let mut c=config(folder,path)?;
 if c.meetings.is_empty(){return Err("Choose the meetings to sync before connecting a calendar.".into());}
 let encrypted=protect(url.as_bytes(),false)?;atomic(&secret_path(folder),&encrypted)?;
 c.generation=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(err)?.as_nanos().to_string();write_config(folder,&c)
}
pub fn disconnect(folder:&Path,path:&Path)->Result<()> {let mut c=config(folder,path)?;if secret_path(folder).exists(){std::fs::remove_file(secret_path(folder)).map_err(|_|"Could not remove calendar credentials.")?;}c.generation.clear();write_config(folder,&c)}
#[derive(Serialize)]
pub struct Feed {pub text:String,pub rules:Vec<Meeting>,pub generation:String}
pub fn fetch(folder:&Path,path:&Path)->Result<Feed>{
 let c=config(folder,path)?;
 if c.generation.is_empty(){return Err("Connect this library to Google Calendar first.".into());}
 let encrypted=std::fs::read(secret_path(folder)).map_err(|_|"Connect your Google Calendar in Settings first.")?;
 let secret=protect(&encrypted,true)?;let url=validate_url(std::str::from_utf8(&secret).map_err(|_|"Reconnect the calendar.")?)?;
 let client=reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(30)).redirect(reqwest::redirect::Policy::none()).build().map_err(|_|"Calendar connection unavailable.")?;
 let response=client.get(url).send().map_err(|_|"Calendar could not be reached. Saved meetings are unchanged.")?;
 if !response.status().is_success(){return Err("Google did not provide the calendar. Check or reconnect the private feed.".into());}
 let mut bytes=Vec::new();response.take(10_000_001).read_to_end(&mut bytes).map_err(|_|"Calendar download was interrupted.")?;
 if bytes.len()>10_000_000{return Err("Calendar feed exceeds the 10 MB limit. Saved meetings are unchanged.".into());}
 let text=String::from_utf8(bytes).map_err(|_|"Calendar feed is not readable.")?;
 if !text.trim_start().starts_with("BEGIN:VCALENDAR")||!text.contains("END:VCALENDAR"){return Err("Google returned an incomplete calendar. Saved meetings are unchanged.".into());}
 Ok(Feed{text,rules:c.meetings,generation:c.generation})
}
fn save(db:&rusqlite::Connection,m:&Meeting)->Result<()> {
 if m.source_id.is_empty()||m.name.trim().is_empty()||m.name.len()>500||m.start.len()<10||m.end.len()<10||!m.start.get(..10).is_some_and(crate::project_overview::date)||!m.end.get(..10).is_some_and(crate::project_overview::date){return Err("Meeting dates or identity are invalid.".into());}
 for link in [&m.source_url,&m.join_url]{if !link.is_empty(){let url=url::Url::parse(link).map_err(|_|"Meeting link is invalid.")?;if !["https","http"].contains(&url.scheme()){return Err("Meeting link is invalid.".into());}}}
 let id=identity(&m.source_id);let old=studio::get(db,&id)?;
 let project=if let Some(pid)=old.as_ref().and_then(|e|e.projects.first()).copied(){pid}else{db.query_row("SELECT id FROM projects WHERE name=?",[&m.project_name],|r|r.get::<_,i64>(0)).map_err(|_|"A meeting's project is unavailable. Saved meetings are unchanged.")?};
 if !db.query_row("SELECT EXISTS(SELECT 1 FROM projects WHERE id=?)",[project],|r|r.get::<_,bool>(0)).map_err(err)?{return Err("A meeting's project is unavailable.".into());}
 let mut entry=old.unwrap_or_default();entry.id=id;entry.kind="meeting".into();entry.name=m.name.clone();entry.date=m.start[..10].into();entry.end_date=m.end[..10].into();entry.projects=vec![project];entry.archived=m.cancelled;entry.meeting=Some(m.clone());entry.updated=db::now();if entry.created==0{entry.created=entry.updated;}studio::put(db,&entry)
}
pub fn apply(folder:&Path,path:&Path,meetings:Vec<Meeting>,generation:&str)->Result<()> {
 let c=config(folder,path)?;
 if generation.is_empty()||c.generation!=generation||!secret_path(folder).exists(){return Err("Calendar connection changed. Sync again.".into());}
 if meetings.len()!=c.meetings.len()||meetings.iter().any(|m|!c.meetings.iter().any(|old|old.source_id==m.source_id&&old.project_name==m.project_name)) {return Err("Calendar update does not match the selected meetings.".into());}
 let db=db::connect(path)?;let tx=db.unchecked_transaction().map_err(err)?;
 for m in &meetings{save(&tx,m)?;}db::set_setting(&tx,"calendar_last_sync",&db::now().to_string())?;tx.commit().map_err(err)?;
 Ok(())
}

#[cfg(test)]
mod tests {
 use super::*;
 fn sample()->Meeting{Meeting{source_id:"sample".into(),uid:"sample@example.test".into(),name:"Project meeting".into(),project_name:"Example".into(),start:"2026-11-27T11:00:00+13:00".into(),end:"2026-11-27T12:00:00+13:00".into(),location:"Room".into(),join_url:"".into(),source_url:"https://calendar.google.com/".into(),cancelled:false}}
 #[test]fn private_feed_validation_rejects_other_hosts_and_public_feeds(){
  assert!(validate_url("https://calendar.google.com/calendar/ical/example/private-test/basic.ics").is_ok());
  for url in ["http://calendar.google.com/calendar/ical/a/private-test/basic.ics","https://example.com/calendar/ical/a/private-test/basic.ics","https://calendar.google.com/calendar/ical/a/public/basic.ics","https://calendar.google.com/calendar/ical/a/private-test/basic.ics?secret=x"]{assert!(validate_url(url).is_err());}
 }
 #[test]fn selected_meetings_seed_once_sync_atomically_and_survive_metadata_restore(){
  let dir=tempfile::tempdir().unwrap();let path=dir.path().join("library.sqlite");db::init(&path).unwrap();db::connect(&path).unwrap().execute("INSERT INTO projects VALUES(1,'Example')",[]).unwrap();
  let config=Config{library:path.to_string_lossy().into_owned(),meetings:vec![sample()],generation:"test-generation".into()};write_config(dir.path(),&config).unwrap();assert!(needs_initialise(dir.path(),&path).unwrap());assert!(initialise(dir.path(),&path).unwrap());assert!(!needs_initialise(dir.path(),&path).unwrap());assert!(!initialise(dir.path(),&path).unwrap());
  std::fs::write(secret_path(dir.path()),b"test-placeholder").unwrap();
  let mut changed=sample();changed.start="2026-11-27T11:30:00+13:00".into();apply(dir.path(),&path,vec![changed.clone()],"test-generation").unwrap();assert_eq!(studio::get(&db::connect(&path).unwrap(),&identity("sample")).unwrap().unwrap().meeting.unwrap().start,changed.start);
  changed.project_name="Unrelated".into();assert!(apply(dir.path(),&path,vec![changed],"test-generation").is_err());
  assert!(apply(dir.path(),&path,vec![sample()],"stale-generation").is_err());
  let export=dir.path().join("metadata.json");db::export(&path,export.clone()).unwrap();let other=dir.path().join("restored.sqlite");db::init(&other).unwrap();db::connect(&other).unwrap().execute("INSERT INTO projects VALUES(1,'Other')",[]).unwrap();db::import(&other,export).unwrap();let restored=studio::get(&db::connect(&other).unwrap(),&identity("sample")).unwrap().unwrap();assert_ne!(restored.projects[0],1);assert!(restored.meeting.is_some());assert!(!status(dir.path(),&other).unwrap().connected);
  disconnect(dir.path(),&path).unwrap();assert!(!status(dir.path(),&path).unwrap().connected);assert!(studio::get(&db::connect(&path).unwrap(),&identity("sample")).unwrap().is_some());
 }
 #[cfg(windows)]
 #[test]fn credential_protection_roundtrips_without_plaintext(){let value=b"synthetic-calendar-credential";let encrypted=protect(value,false).unwrap();assert!(!encrypted.windows(value.len()).any(|w|w==value));assert_eq!(protect(&encrypted,true).unwrap(),value);}
}
