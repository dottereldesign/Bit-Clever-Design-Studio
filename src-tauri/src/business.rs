//! Device-private business data, intentionally separate from library/export databases.
use crate::db::{err, Result};
use rusqlite::{Connection, OptionalExtension, TransactionBehavior};
use serde::{Serialize, Deserialize};
use serde_json::{json, Value};
use std::path::Path;
#[derive(Serialize, Deserialize)]
pub struct Snapshot { pub revision:i64, pub data:Value }
fn validate(data:&Value)->Result<()> {
 if data.to_string().len()>1_000_000 || data["version"]!=1 || !data["profile"].is_object() {return Err("Invalid business workspace".into());}
 for key in ["name","email","website","country","structure","registration","currency","budget","notes"] {if !data["profile"][key].is_string(){return Err("Invalid business details".into());}}
 let records=data["records"].as_array().ok_or("Invalid business records")?;
 if records.len()>5000{return Err("Business workspace is full".into());}
 let mut ids=std::collections::HashSet::new();
 for r in records {
  for key in ["id","kind","name","status","due","amount","frequency","currency","provider","url","notes"] {if !r[key].is_string(){return Err("Invalid business record".into());}}
  if !ids.insert(r["id"].as_str().unwrap()) || !["setup","tax","domain","hosting","subscription","purchase"].contains(&r["kind"].as_str().unwrap()) || !["planned","active","done","paused"].contains(&r["status"].as_str().unwrap()) || !["once","monthly","yearly"].contains(&r["frequency"].as_str().unwrap()){return Err("Invalid business record options".into());}
  let amount=r["amount"].as_str().unwrap();if !amount.is_empty() && !amount.parse::<f64>().map(|v|v.is_finite()&&v>=0.0).unwrap_or(false){return Err("Enter a valid non-negative cost".into());}
 }
 Ok(())
}
fn connect(folder:&Path)->Result<Connection>{
 let conn=Connection::open(folder.join("my-business.sqlite")).map_err(err)?;
 conn.busy_timeout(std::time::Duration::from_secs(5)).map_err(err)?;
 conn.execute_batch("CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, data TEXT NOT NULL)").map_err(err)?;Ok(conn)
}
pub fn load(folder:&Path)->Result<Snapshot>{
 let mut conn=connect(folder)?;let tx=conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(err)?;
 let saved=tx.query_row("SELECT revision,data FROM workspace WHERE id=1",[],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?))).optional().map_err(err)?;
 let result=if let Some((revision,data))=saved {Snapshot{revision,data:serde_json::from_str(&data).map_err(|_|"Cannot read private business data")?}}else{
  let seed=folder.join("my-business-seed.json");
  let data=if seed.is_file(){serde_json::from_slice(&std::fs::read(seed).map_err(|_|"Cannot read private business setup")?).map_err(|_|"Invalid private business setup")?}else{json!({"version":1,"profile":{"name":"","email":"","website":"","country":"","structure":"Undecided","registration":"","currency":"NZD","budget":"","notes":""},"records":[]})};
  validate(&data)?;tx.execute("INSERT INTO workspace VALUES(1,0,?)",[data.to_string()]).map_err(err)?;Snapshot{revision:0,data}
 };tx.commit().map_err(err)?;Ok(result)
}
pub fn save(folder:&Path,revision:i64,data:Value)->Result<Snapshot>{
 validate(&data)?;let conn=connect(folder)?;
 let n=conn.execute("UPDATE workspace SET revision=revision+1,data=? WHERE id=1 AND revision=?",rusqlite::params![data.to_string(),revision]).map_err(err)?;
 if n!=1{return Err("Business information changed. Reload before saving; your draft is still open.".into());}Ok(Snapshot{revision:revision+1,data})
}
#[cfg(test)]mod tests{
 use super::*;
 #[test]fn private_roundtrip_and_conflict(){let dir=tempfile::tempdir().unwrap();let initial=load(dir.path()).unwrap();let mut data=initial.data;data["profile"]["name"]=json!("Example business");assert_eq!(save(dir.path(),0,data.clone()).unwrap().revision,1);assert!(save(dir.path(),0,data).is_err());assert_eq!(load(dir.path()).unwrap().data["profile"]["name"],"Example business");assert!(!dir.path().join("library.sqlite").exists());}
 #[test]fn seed_only_initializes_once(){let dir=tempfile::tempdir().unwrap();let mut data=load(dir.path()).unwrap().data;data["profile"]["name"]=json!("Example seed");let other=tempfile::tempdir().unwrap();std::fs::write(other.path().join("my-business-seed.json"),data.to_string()).unwrap();assert_eq!(load(other.path()).unwrap().data["profile"]["name"],"Example seed");data["profile"]["name"]=json!("Changed");save(other.path(),0,data).unwrap();assert_eq!(load(other.path()).unwrap().data["profile"]["name"],"Changed");}
 #[test]fn rejects_invalid_shape(){let dir=tempfile::tempdir().unwrap();load(dir.path()).unwrap();assert!(save(dir.path(),0,json!({"version":1,"profile":{},"records":[]})).is_err());}
}
