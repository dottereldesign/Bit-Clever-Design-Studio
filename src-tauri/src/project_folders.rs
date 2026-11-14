use crate::db::{err, Change, Result};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder { pub id:i64, pub project_id:i64, pub parent_id:Option<i64>, pub name:String, pub position:Option<i64> }

pub fn init(db:&Connection)->Result<()> {
    db.execute_batch("CREATE TABLE IF NOT EXISTS project_folders(id INTEGER PRIMARY KEY,project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,parent_id INTEGER REFERENCES project_folders(id) ON DELETE CASCADE,name TEXT NOT NULL,position INTEGER);
      CREATE UNIQUE INDEX IF NOT EXISTS project_folder_name ON project_folders(project_id,COALESCE(parent_id,0),name COLLATE NOCASE);
      CREATE TABLE IF NOT EXISTS item_project_folders(item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,folder_id INTEGER NOT NULL REFERENCES project_folders(id) ON DELETE CASCADE,PRIMARY KEY(item_id,folder_id));
      CREATE INDEX IF NOT EXISTS project_folder_members ON item_project_folders(folder_id);
      CREATE TRIGGER IF NOT EXISTS remove_project_filing AFTER DELETE ON item_projects BEGIN DELETE FROM item_project_folders WHERE item_id=OLD.item_id AND folder_id IN (SELECT id FROM project_folders WHERE project_id=OLD.label_id); END;") .map_err(err)
}
pub fn folders(db:&Connection)->Result<Vec<Folder>> {
    let mut s=db.prepare("SELECT id,project_id,parent_id,name,position FROM project_folders ORDER BY id").map_err(err)?;
    let rows=s.query_map([],|r|Ok(Folder{id:r.get(0)?,project_id:r.get(1)?,parent_id:r.get(2)?,name:r.get(3)?,position:r.get(4)?})).map_err(err)?;
    rows.collect::<std::result::Result<Vec<_>,_>>().map_err(err)
}
pub fn memberships(db:&Connection)->Result<Vec<(i64,i64)>> {
    let mut s=db.prepare("SELECT item_id,folder_id FROM item_project_folders").map_err(err)?;
    let rows=s.query_map([],|r|Ok((r.get(0)?,r.get(1)?))).map_err(err)?;
    rows.collect::<std::result::Result<Vec<_>,_>>().map_err(err)
}
// Organisation snapshots stay in the same transaction as the edit. Media is never copied.
#[derive(Serialize,Deserialize)]
pub struct State { #[serde(default)] clients:Option<crate::client_records::State>, #[serde(default)] overviews:Option<Vec<crate::project_overview::Overview>>, projects:Vec<(i64,String)>, members:Vec<(i64,i64,i64)>, folders:Vec<Folder>, filing:Vec<(i64,i64)> }
pub fn snapshot(db:&Connection)->Result<State> {
    let mut p=db.prepare("SELECT id,name FROM projects").map_err(err)?;
    let projects=p.query_map([],|r|Ok((r.get(0)?,r.get(1)?))).map_err(err)?.collect::<std::result::Result<Vec<_>,_>>().map_err(err)?;
    let mut m=db.prepare("SELECT item_id,label_id,favourite FROM item_projects").map_err(err)?;
    let members=m.query_map([],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).map_err(err)?.collect::<std::result::Result<Vec<_>,_>>().map_err(err)?;
    Ok(State{clients:None,overviews:Some(crate::project_overview::load(db)?),projects,members,folders:folders(db)?,filing:memberships(db)?})
}
pub fn snapshot_with_clients(db:&Connection)->Result<State>{let mut s=snapshot(db)?;s.clients=Some(crate::client_records::load(db)?);Ok(s)}
impl State {pub fn includes_clients(&self)->bool{self.clients.is_some()}}
pub fn restore(db:&Connection,s:State)->Result<()> {
    let mut clients=s.clients.unwrap_or(crate::client_records::load(db)?);
    let overviews=s.overviews.unwrap_or(crate::project_overview::load(db)?);
    db.execute_batch("DELETE FROM item_project_folders; DELETE FROM project_folders; DELETE FROM item_projects; DELETE FROM projects;").map_err(err)?;
    for(id,name) in s.projects{db.execute("INSERT INTO projects VALUES(?,?)",params![id,name]).map_err(err)?;}
    for o in overviews {if db.query_row("SELECT EXISTS(SELECT 1 FROM projects WHERE id=?)",[o.project_id],|r|r.get::<_,bool>(0)).map_err(err)?{crate::project_overview::save(db,&o)?;}}
    let exists=|id:i64|db.query_row("SELECT EXISTS(SELECT 1 FROM projects WHERE id=?)",[id],|r|r.get::<_,bool>(0)).unwrap_or(false);
    clients.contacts.retain(|c|exists(c.project_id));clients.records.retain(|r|exists(r.project_id));crate::client_records::restore(db,clients)?;
    for(i,p,f) in s.members{db.execute("INSERT INTO item_projects VALUES(?,?,?)",params![i,p,f]).map_err(err)?;}
    // Insert roots first even after a folder has moved beneath a newer folder.
    let mut pending=s.folders;
    while !pending.is_empty(){let before=pending.len();let mut rest=vec![];
        for f in pending{let ready=f.parent_id.map(|p|db.query_row("SELECT EXISTS(SELECT 1 FROM project_folders WHERE id=?)",[p],|r|r.get::<_,bool>(0)).unwrap_or(false)).unwrap_or(true);
            if ready{db.execute("INSERT INTO project_folders VALUES(?,?,?,?,?)",params![f.id,f.project_id,f.parent_id,f.name,f.position]).map_err(err)?;}else{rest.push(f);}}
        if rest.len()==before{return Err("Invalid project folder hierarchy".into());}pending=rest;
    }
    for(i,f) in s.filing{db.execute("INSERT INTO item_project_folders VALUES(?,?)",params![i,f]).map_err(err)?;}
    Ok(())
}
pub fn change(db:&Connection,c:&Change)->Result<()> {
    let id=c.target.unwrap_or(0);let name=c.name.as_deref().unwrap_or("").trim();
    let parent=||->Result<Option<i64>>{let v=c.value.as_deref().unwrap_or("");if v.is_empty(){Ok(None)}else{Ok(Some(v.parse::<i64>().map_err(err)?))}};
    let list=folders(db)?;
    match c.action.as_str(){
        "unfile_project_folder"=>{
            for item in &c.ids{
                db.execute("INSERT OR IGNORE INTO item_projects(item_id,label_id) VALUES(?,?)",params![item,id]).map_err(err)?;
                db.execute("DELETE FROM item_project_folders WHERE item_id=? AND folder_id IN (SELECT id FROM project_folders WHERE project_id=?)",params![item,id]).map_err(err)?;
            }
        },
        "create_project_folder"|"rename_project_folder"|"move_project_folder"=>{
            let existing=list.iter().find(|f|f.id==id);
            let project=if c.action=="create_project_folder"{id}else{existing.ok_or("Folder no longer exists")?.project_id};
            let p=if c.action=="rename_project_folder"{existing.unwrap().parent_id}else{parent()?};
            if let Some(p)=p{let mut cursor=Some(p);let mut seen=std::collections::HashSet::new();while let Some(next)=cursor{
                if (c.action!="create_project_folder"&&next==id)||!seen.insert(next){return Err("A folder cannot be moved inside itself.".into());}
                let f=list.iter().find(|f|f.id==next&&f.project_id==project).ok_or("Choose a folder in the same project")?;cursor=f.parent_id;
            }}
            if c.action=="move_project_folder"{db.execute("UPDATE project_folders SET parent_id=?,position=NULL WHERE id=?",params![p,id]).map_err(err)?;}
            else {if name.is_empty()||name.len()>300{return Err("Enter a folder name (1–300 characters).".into());}
                if c.action=="create_project_folder"{db.execute("INSERT INTO project_folders(project_id,parent_id,name) VALUES(?,?,?)",params![project,p,name]).map_err(err)?;}
                else{db.execute("UPDATE project_folders SET name=? WHERE id=?",params![name,id]).map_err(err)?;}}
        },
        "delete_project_folder"=>{db.execute("DELETE FROM project_folders WHERE id=?",[id]).map_err(err)?;},
        "reorder_project_folders"=>{
            let mut seen=std::collections::HashSet::new();let mut scope=None;
            for (position,id) in c.ids.iter().enumerate(){let f=list.iter().find(|f|f.id==*id).ok_or("Folder no longer exists")?;
                let key=(f.project_id,f.parent_id);if !seen.insert(id)||scope.is_some_and(|s|s!=key){return Err("Reorder folders within the same parent.".into());}scope=Some(key);
                db.execute("UPDATE project_folders SET position=? WHERE id=?",params![position as i64,id]).map_err(err)?;}
        },
        "add_project_folder"|"remove_project_folder"=>{
            let f=list.iter().find(|f|f.id==id).ok_or("Folder no longer exists")?;
            for item in &c.ids{if c.action=="add_project_folder"{
                db.execute("INSERT OR IGNORE INTO item_projects(item_id,label_id) VALUES(?,?)",params![item,f.project_id]).map_err(err)?;
                db.execute("INSERT OR IGNORE INTO item_project_folders VALUES(?,?)",params![item,id]).map_err(err)?;
            }else{db.execute("DELETE FROM item_project_folders WHERE item_id=? AND folder_id=?",params![item,id]).map_err(err)?;}}
        },
        _=>return Err("Unknown project folder action".into())
    }Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db;
    use serde_json::json;
    fn change(path:&std::path::Path,value:serde_json::Value){db::change(path,serde_json::from_value(value).unwrap()).unwrap();}
    fn fixture()->(tempfile::TempDir,std::path::PathBuf){
        let temp=tempfile::tempdir().unwrap();let path=temp.path().join("library.sqlite");db::init(&path).unwrap();
        db::connect(&path).unwrap().execute_batch("INSERT INTO projects VALUES(1,'Client'),(2,'Other');INSERT INTO items(id,path,name,kind,added) VALUES(1,'https://example.org','Reference','link',1),(2,'image.png','Image','image',2);INSERT INTO item_projects(item_id,label_id) VALUES(1,1),(2,1);").unwrap();
        (temp,path)
    }
    #[test]
    fn nested_filing_shares_items_and_preserves_project_when_folder_deleted(){
        let (_temp,path)=fixture();
        change(&path,json!({"action":"create_project_folder","target":1,"name":"Research"}));
        change(&path,json!({"action":"create_project_folder","target":1,"name":"Psychodrama","value":"1"}));
        change(&path,json!({"action":"create_project_folder","target":2,"name":"Shared"}));
        for target in [1,2,3]{change(&path,json!({"action":"add_project_folder","target":target,"ids":[1,2]}));}
        let lib=db::load(&path,false).unwrap();assert_eq!(lib.items.len(),2);assert_eq!(lib.items[0].projects,vec![1,2]);assert_eq!(lib.items[0].project_folders,vec![1,2,3]);
        assert!(db::change(&path,serde_json::from_value(json!({"action":"move_project_folder","target":1,"value":"2"})).unwrap()).is_err());
        assert!(db::change(&path,serde_json::from_value(json!({"action":"move_project_folder","target":1,"value":"3"})).unwrap()).is_err());
        change(&path,json!({"action":"delete_project_folder","target":1}));
        let lib=db::load(&path,false).unwrap();assert_eq!(lib.project_folders.len(),1);assert_eq!(lib.items[0].projects,vec![1,2]);assert_eq!(lib.items[0].project_folders,vec![3]);
        change(&path,json!({"action":"undo_organisation"}));assert_eq!(db::load(&path,false).unwrap().items[0].project_folders,vec![1,2,3]);
        change(&path,json!({"action":"redo_organisation"}));assert_eq!(db::load(&path,false).unwrap().project_folders.len(),1);
        change(&path,json!({"action":"undo_organisation"}));
        change(&path,json!({"action":"pin_project","target":1,"ids":[1]}));change(&path,json!({"action":"undo_organisation"}));assert_eq!(db::load(&path,false).unwrap().items[0].project_folders,vec![1,2,3]);
        change(&path,json!({"action":"remove_project","target":1,"ids":[1]}));assert_eq!(db::load(&path,false).unwrap().items[0].project_folders,vec![3]);
        change(&path,json!({"action":"undo_organisation"}));assert_eq!(db::load(&path,false).unwrap().items[0].project_folders,vec![1,2,3]);
        change(&path,json!({"action":"delete_project","target":1}));assert_eq!(db::load(&path,false).unwrap().project_folders.len(),1);
        change(&path,json!({"action":"undo_organisation"}));assert_eq!(db::load(&path,false).unwrap().project_folders.len(),3);
        change(&path,json!({"action":"unfile_project_folder","target":1,"ids":[1,2]}));
        let unfiled=db::load(&path,false).unwrap();assert!(unfiled.items.iter().all(|i|i.projects==vec![1,2]&&i.project_folders==vec![3]));
        change(&path,json!({"action":"undo_organisation"}));assert_eq!(db::load(&path,false).unwrap().items[0].project_folders,vec![1,2,3]);
        change(&path,json!({"action":"redo_organisation"}));assert_eq!(db::load(&path,false).unwrap().items[0].project_folders,vec![3]);
        change(&path,json!({"action":"undo_organisation"}));
        change(&path,json!({"action":"remove_project_folder","target":2,"ids":[1]}));assert_eq!(db::load(&path,false).unwrap().items[0].projects,vec![1,2]);
    }
    #[test]
    fn ratings_and_folder_hierarchy_survive_backup_remapped_ids_and_undo(){
        let (temp,path)=fixture();
        change(&path,json!({"action":"create_project_folder","target":1,"name":"Child"}));
        change(&path,json!({"action":"create_project_folder","target":1,"name":"Parent"}));
        change(&path,json!({"action":"move_project_folder","target":1,"value":"2"}));
        change(&path,json!({"action":"add_project_folder","target":1,"ids":[1,2]}));
        change(&path,json!({"action":"rate_links","ids":[1,2],"value":"4"}));
        let lib=db::load(&path,false).unwrap();assert_eq!(lib.items[0].rating,Some(4));assert_eq!(lib.items[1].rating,None);
        change(&path,json!({"action":"rate_links","ids":[1],"value":""}));assert_eq!(db::load(&path,false).unwrap().items[0].rating,None);
        change(&path,json!({"action":"undo_organisation"}));assert_eq!(db::load(&path,false).unwrap().items[0].rating,Some(4));
        change(&path,json!({"action":"redo_organisation"}));assert_eq!(db::load(&path,false).unwrap().items[0].rating,None);
        change(&path,json!({"action":"undo_organisation"}));
        assert!(db::change(&path,serde_json::from_value(json!({"action":"rate_links","ids":[1],"value":"6"})).unwrap()).is_err());
        let backup=temp.path().join("backup.json");db::export(&path,backup.clone()).unwrap();
        let restored=temp.path().join("restored.sqlite");db::init(&restored).unwrap();db::connect(&restored).unwrap().execute("INSERT INTO projects VALUES(1,'Pre-existing')",[]).unwrap();
        db::import(&restored,backup.clone()).unwrap();db::import(&restored,backup).unwrap();
        let lib=db::load(&restored,false).unwrap();assert_eq!(lib.items.len(),2);assert_eq!(lib.project_folders.len(),2);
        let child=lib.project_folders.iter().find(|f|f.name=="Child").unwrap();let parent=lib.project_folders.iter().find(|f|f.name=="Parent").unwrap();assert_eq!(child.parent_id,Some(parent.id));assert_ne!(child.project_id,1);
        assert_eq!(lib.items[0].rating,Some(4));assert_eq!(lib.items[0].project_folders,vec![child.id]);assert!(lib.items[0].projects.contains(&child.project_id));
        let db=db::connect(&restored).unwrap();assert_eq!(db.query_row("PRAGMA integrity_check",[],|r|r.get::<_,String>(0)).unwrap(),"ok");assert!(!db.prepare("PRAGMA foreign_key_check").unwrap().query([]).unwrap().next().unwrap().is_some());
    }
}
