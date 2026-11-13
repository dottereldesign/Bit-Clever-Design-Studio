//! Local CRM and campaign records. Stable IDs join records without copying assets.
use crate::db::{self, err, Result};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(default, deny_unknown_fields)]
pub struct Entry {
    pub id: String,
    pub meeting: Option<crate::calendar_sync::Meeting>,
    pub kind: String,
    pub name: String,
    pub archived: bool,
    pub organization: Option<String>,
    pub contacts: Vec<String>,
    pub projects: Vec<i64>,
    pub handover_project: Option<i64>,
    pub campaign: Option<String>,
    pub parent: Option<String>,
    pub files: Vec<i64>,
    pub tags: Vec<String>,
    pub status: String,
    pub service: String,
    pub source: String,
    pub value: Option<f64>,
    pub currency: String,
    pub date: String,
    pub end_date: String,
    pub body: String,
    pub email: String,
    pub phone: String,
    pub website: String,
    pub audience: String,
    pub message: String,
    pub offer: String,
    pub channel: String,
    pub results: String,
    pub metrics: Vec<Metric>,
    pub variant_group: String,
    pub activity_type: String,
    pub actions: Vec<crate::project_overview::Action>,
    pub milestones: Vec<crate::project_overview::Action>,
    pub moodboard: Vec<crate::project_overview::BoardNode>,
    pub stages: Vec<Stage>,
    pub created: i64,
    pub updated: i64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Metric {pub id:String,pub name:String,pub value:String,pub unit:String}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Stage {
    pub id: String,
    pub name: String,
}
pub fn init(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TABLE IF NOT EXISTS studio_records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL); CREATE INDEX IF NOT EXISTS studio_kind ON studio_records(kind);").map_err(err)?;
    // IDs retain project provenance. Never merge people just because names match.
    if db::setting(db, "studio_contacts_v1").is_none() {
        if !crate::client_records::load(db)?.contacts.is_empty() {
            if let Some(path) = db.path() {
                let folder = std::path::Path::new(path)
                    .parent()
                    .ok_or("Library path unavailable")?
                    .join("backups");
                std::fs::create_dir_all(&folder).map_err(err)?;
                let backup = folder.join("before-studio-contacts.sqlite");
                if !backup.exists() {
                    db.backup("main", &backup, None).map_err(err)?;
                }
            }
        }
        let tx = db.unchecked_transaction().map_err(err)?;
        for mut c in crate::client_records::load(&tx)?.contacts {
            c.shared_id = contact_id(&c);
            tx.execute(
                "UPDATE client_contacts SET data=? WHERE project_id=? AND id=?",
                params![serde_json::to_string(&c).map_err(err)?, c.project_id, c.id],
            )
            .map_err(err)?;
            sync_contact(&tx, &c)?;
        }
        db::set_setting(&tx, "studio_contacts_v1", "1")?;
        tx.commit().map_err(err)?;
    }
    Ok(())
}
pub fn load(db: &Connection) -> Result<Vec<Entry>> {
    let mut q = db
        .prepare("SELECT data FROM studio_records ORDER BY id")
        .map_err(err)?;
    let rows = q.query_map([], |r| r.get::<_, String>(0)).map_err(err)?;
    rows.map(|r| serde_json::from_str(&r.map_err(err)?).map_err(err))
        .collect()
}
pub fn get(db: &Connection, id: &str) -> Result<Option<Entry>> {
    db.query_row("SELECT data FROM studio_records WHERE id=?", [id], |r| {
        r.get::<_, String>(0)
    })
    .optional()
    .map_err(err)?
    .map(|s| serde_json::from_str(&s).map_err(err))
    .transpose()
}
pub fn put(db: &Connection, e: &Entry) -> Result<()> {
    if e.id.is_empty()
        || e.id.len() > 200
        || ![
            "contact",
            "organization",
            "lead",
            "campaign",
            "content",
            "activity",
            "pipeline",
            "meeting",
            "research",
        ]
        .contains(&e.kind.as_str())
        || e.name.trim().is_empty()
        || e.name.len() > 500
        || serde_json::to_string(e).map_err(err)?.len() > 1_000_000
    {
        return Err("Check the record name and size.".into());
    }
    if ["contact", "organization"].contains(&e.kind.as_str())
        && (e.name.len() > 300 || e.email.len() > 500 || e.phone.len() > 100)
    {
        return Err("Contact details are too long.".into());
    }
    if !crate::project_overview::date(&e.date)
        || !crate::project_overview::date(&e.end_date)
        || e.value.is_some_and(|v| !v.is_finite() || v < 0.)
        || e.currency.len() > 10
        || e.files.len() > 10000
        || e.contacts.len() > 500
        || e.tags.len() > 100
    {
        return Err("Check dates, value and associations.".into());
    }
    if !e.date.is_empty() && !e.end_date.is_empty() && e.end_date < e.date {
        return Err("End date must follow the start date.".into());
    }
    if e.metrics.len()>50||e.variant_group.len()>100||e.metrics.iter().any(|m|m.id.is_empty()||m.name.trim().is_empty()||m.name.len()>100||m.value.len()>100||m.unit.len()>40){return Err("Check metric names and values.".into());}
    // Reuse the same validation limits as project actions and moodboards.
    if e.actions.len() > 500 || e.milestones.len() > 100 || e.moodboard.len() > 300 {
        return Err("Too many actions or moodboard elements.".into());
    }
    for a in e.actions.iter().chain(e.milestones.iter()) {
        if a.id.is_empty()
            || a.text.trim().is_empty()
            || a.text.len() > 1000
            || !crate::project_overview::date(&a.deadline)
        {
            return Err("Check the next action and date.".into());
        }
    }
    for n in &e.moodboard {
        if !["reference", "note", "color"].contains(&n.kind.as_str())
            || n.id.is_empty()
            || n.text.len() > 10000
            || n.color.len() != 7
            || !n.color.starts_with('#')
            || !n.color[1..].bytes().all(|c| c.is_ascii_hexdigit())
            || ![n.x, n.y, n.width, n.height].iter().all(|v| v.is_finite())
            || n.x < 0.
            || n.y < 0.
            || n.width < 100.
            || n.height < 80.
            || n.x + n.width > 2000.01
            || n.y + n.height > 1400.01
        {
            return Err("Invalid moodboard element.".into());
        }
    }
    if e.kind == "pipeline" {
        let mut ids = std::collections::HashSet::new();
        if e.id != "lead-pipeline"
            || e.stages.len() < 2
            || e.stages.len() > 20
            || e.stages.iter().any(|s| {
                s.name.trim().is_empty()
                    || s.name.len() > 80
                    || s.id.is_empty()
                    || !ids.insert(&s.id)
            })
            || !e.stages.iter().any(|s| s.id == "won")
            || !e.stages.iter().any(|s| s.id == "lost")
        {
            return Err("Keep unique pipeline stages, including Won and Lost.".into());
        }
    }
    db.execute("INSERT INTO studio_records VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,data=excluded.data",params![e.id,e.kind,serde_json::to_string(e).map_err(err)?]).map_err(err)?;
    Ok(())
}
pub fn contact_id(c: &crate::client_records::Contact) -> String {
    if c.shared_id.is_empty() {
        format!("project:{}:{}", c.project_id, c.id)
    } else {
        c.shared_id.clone()
    }
}
pub fn company_id(contact: &str, name: &str) -> String {
    format!(
        "organization:{:x}",
        Sha256::digest(format!("{contact}\0{name}"))
    )
}
pub fn sync_contact(db: &Connection, c: &crate::client_records::Contact) -> Result<()> {
    let exists: bool = db
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name='studio_records')",
            [],
            |r| r.get(0),
        )
        .map_err(err)?;
    if !exists {
        return Ok(());
    }
    let id = contact_id(c);
    let mut e = get(db, &id)?.unwrap_or(Entry {
        id,
        kind: "contact".into(),
        created: db::now(),
        ..Default::default()
    });
    e.name = c.name.clone();
    e.email = c.email.clone();
    e.phone = c.phone.clone();
    if !e.projects.contains(&c.project_id) {
        e.projects.push(c.project_id);
    }
    // Company text is preserved on the original project record, with an explicit organization identity.
    let current_company = e
        .organization
        .as_deref()
        .map(|id| get(db, id))
        .transpose()?
        .flatten()
        .map(|o| o.name)
        .unwrap_or_default();
    if current_company != c.company {
        if c.company.trim().is_empty() {
            e.organization = None;
        } else {
            let oid = company_id(&e.id, &c.company);
            if get(db, &oid)?.is_none() {
                put(
                    db,
                    &Entry {
                        id: oid.clone(),
                        kind: "organization".into(),
                        name: c.company.clone(),
                        ..Default::default()
                    },
                )?;
            }
            e.organization = Some(oid);
        }
    }
    put(db, &e)?;
    propagate_contact(db, &e)
}
fn propagate_contact(db: &Connection, e: &Entry) -> Result<()> {
    for mut c in crate::client_records::load(db)?.contacts {
        if contact_id(&c) == e.id {
            c.shared_id = e.id.clone();
            c.name = e.name.clone();
            c.email = e.email.clone();
            c.phone = e.phone.clone();
            c.company = e
                .organization
                .as_deref()
                .map(|id| get(db, id))
                .transpose()?
                .flatten()
                .map(|o| o.name)
                .unwrap_or_default();
            db.execute(
                "UPDATE client_contacts SET data=? WHERE project_id=? AND id=?",
                params![serde_json::to_string(&c).map_err(err)?, c.project_id, c.id],
            )
            .map_err(err)?;
        }
    }
    Ok(())
}
pub fn validate_refs(db: &Connection, e: &Entry) -> Result<()> {
    for (id, kind) in e
        .contacts
        .iter()
        .map(|id| (id.as_str(), "contact"))
        .chain(
            e.organization
                .iter()
                .map(|id| (id.as_str(), "organization")),
        )
        .chain(e.campaign.iter().map(|id| (id.as_str(), "campaign")))
    {
        if !get(db, id)?.is_some_and(|r| r.kind == kind) {
            return Err(format!("Associated {kind} is unavailable."));
        }
    }
    if let Some(id) = &e.parent {
        if !get(db, id)?.is_some_and(|r| {
            if e.kind == "activity" {
                r.kind == "lead"
            } else {
                r.kind == "campaign"
            }
        }) {
            return Err("Parent record is unavailable.".into());
        }
    }
    for id in &e.projects {
        if !db
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM projects WHERE id=?)",
                [id],
                |r| r.get::<_, bool>(0),
            )
            .map_err(err)?
        {
            return Err("Project is unavailable.".into());
        }
    }
    for id in e
        .files
        .iter()
        .copied()
        .chain(e.moodboard.iter().filter_map(|n| n.item_id))
    {
        if !db
            .query_row("SELECT EXISTS(SELECT 1 FROM items WHERE id=?)", [id], |r| {
                r.get::<_, bool>(0)
            })
            .map_err(err)?
        {
            return Err("File is unavailable.".into());
        }
    }
    Ok(())
}
fn merge_edit(base:&Value,next:&Value,current:&Value)->Result<Value>{
    if next==base || next==current {return Ok(current.clone());}
    if base==current {return Ok(next.clone());}
    if let (Some(b),Some(n),Some(c))=(base.as_object(),next.as_object(),current.as_object()) {
        let mut result=c.clone();
        for (key,value) in n {if b.get(key)!=Some(value){result.insert(key.clone(),merge_edit(b.get(key).unwrap_or(&Value::Null),value,c.get(key).unwrap_or(&Value::Null))?);}}
        return Ok(Value::Object(result));
    }
    if let (Some(b),Some(n),Some(c))=(base.as_array(),next.as_array(),current.as_array()) {
        let keyed=b.iter().chain(n).chain(c).all(|v|v.get("id").and_then(Value::as_str).is_some());
        if keyed {
            let mut result=c.clone();
            for old in b {let id=&old["id"];if !n.iter().any(|v|&v["id"]==id){if let Some(at)=result.iter().position(|v|&v["id"]==id){if result[at]!=*old{return Err("This item changed while you were editing. Review it and try again.".into());}result.remove(at);}}}
            for value in n {let id=&value["id"];let before=b.iter().find(|v|&v["id"]==id);if before==Some(value){continue;}if let Some(at)=result.iter().position(|v|&v["id"]==id){result[at]=merge_edit(before.unwrap_or(&Value::Null),value,&result[at])?;}else if before.is_none(){result.push(value.clone());}else{return Err("This item was removed while you were editing. Review it and try again.".into());}}
            // An explicit reorder must not undo a concurrent reorder.
            let ids=|v:&Vec<Value>|v.iter().map(|v|v["id"].clone()).collect::<Vec<_>>();
            if b.len()==n.len() && ids(b)!=ids(n) && b.iter().all(|v|n.iter().any(|x|x["id"]==v["id"])) {
                if ids(c)!=ids(b){return Err("The order changed while you were editing. Try again.".into());}
                result.sort_by_key(|v|n.iter().position(|x|x["id"]==v["id"]).unwrap_or(usize::MAX));
            }
            return Ok(json!(result));
        }
        if b.iter().chain(n).chain(c).all(|v|v.is_string()||v.is_number()) {
            let mut result=c.iter().filter(|v|!b.contains(v)||n.contains(v)).cloned().collect::<Vec<_>>();
            for value in n {if !b.contains(value)&&!result.contains(value){result.push(value.clone());}}
            return Ok(json!(result));
        }
    }
    Err("This field changed while you were editing. Review the latest value and try again.".into())
}

pub fn change(db: &Connection, input: &str) -> Result<()> {
    let v: Value = serde_json::from_str(input).map_err(err)?;
    let id = v["id"].as_str().ok_or("Missing record")?;
    let old = get(db, id)?;
    if old.as_ref().is_some_and(|e|e.kind=="meeting"){return Err("Edit this meeting in Google Calendar, then sync.".into());}
    let mut data = serde_json::to_value(old.clone().unwrap_or_default()).map_err(err)?;
    let patch = v["patch"].as_object().ok_or("Missing record changes")?;
    for (k, value) in patch {
        if ["id", "created", "updated"].contains(&k.as_str()) || (k == "kind" && old.is_some()) {
            return Err("Record identity cannot change.".into());
        }
        if k=="handover_project" {return Err("Use project handover to change action ownership.".into());}
        data[k] = if let Some(base)=v["base"].get(k) { merge_edit(base,value,&data[k])? } else { value.clone() };
    }
    data["id"] = json!(id);
    let mut e: Entry = serde_json::from_value(data).map_err(err)?;
    if old.is_none() {
        e.created = db::now();
    }
    e.updated = db::now();
    if e.handover_project.is_some_and(|id|!e.projects.contains(&id)){return Err("Keep the handover project linked while it owns the work.".into());}
    validate_refs(db, &e)?;
    if e.kind == "pipeline" {
        for lead in load(db)?.iter().filter(|r| r.kind == "lead") {
            if !e.stages.iter().any(|s| s.id == lead.status) {
                return Err("Move leads out of a stage before removing it.".into());
            }
        }
    }
    if e.kind == "lead" {
        let stages = get(db, "lead-pipeline")?
            .map(|p| p.stages.iter().map(|s| s.id.clone()).collect::<Vec<_>>())
            .unwrap_or(vec![
                "new".into(),
                "contacted".into(),
                "discussing".into(),
                "proposal".into(),
                "won".into(),
                "lost".into(),
            ]);
        if !stages.contains(&e.status) {
            return Err("Choose a pipeline stage.".into());
        }
    }
    put(db, &e)?;
    if e.kind == "contact" {
        propagate_contact(db, &e)?;
    }
    if e.kind == "organization" {
        for c in load(db)?
            .iter()
            .filter(|c| c.kind == "contact" && c.organization.as_deref() == Some(&e.id))
        {
            propagate_contact(db, c)?;
        }
    }
    Ok(())
}
pub fn unlink_project(db: &Connection, project: i64) -> Result<()> {
    for mut e in load(db)?
        .into_iter()
        .filter(|e| e.projects.contains(&project))
    {
        e.projects.retain(|id| *id != project);
        if e.handover_project == Some(project) { e.handover_project=None; }
        put(db, &e)?;
    }
    Ok(())
}
pub fn replace_item(db: &Connection, old: i64, new: i64) -> Result<()> {
    for mut e in load(db)?
        .into_iter()
        .filter(|e| e.files.contains(&old) || e.moodboard.iter().any(|n| n.item_id == Some(old)))
    {
        for id in &mut e.files {
            if *id == old {
                *id = new;
            }
        }
        e.files.sort();
        e.files.dedup();
        for n in &mut e.moodboard {
            if n.item_id == Some(old) {
                n.item_id = Some(new);
            }
        }
        put(db, &e)?;
    }
    Ok(())
}
pub fn attach(db: &Connection, id: &str, item: i64) -> Result<()> {
    let mut e = get(db, id)?.ok_or("Destination no longer exists")?;
    if e.archived {
        return Err("Restore this record before adding files.".into());
    }
    if !e.files.contains(&item) {
        e.files.push(item);
        e.updated = db::now();
        put(db, &e)?;
    }
    Ok(())
}
/// Closing a successful opportunity and transferring ownership is one undoable transaction.
pub fn win(db: &Connection, id: &str, target: Option<i64>) -> Result<()> {
    let e=get(db,id)?.ok_or("Lead no longer exists")?;
    if e.kind!="lead" || e.archived {return Err("Restore the lead before closing it as Won.".into());}
    if e.handover_project.is_some() {
        return change(db,&json!({"id":id,"patch":{"status":"won"}}).to_string());
    }
    let target=if target.is_some(){target}else if e.projects.len()==1{e.projects.first().copied()}else if e.projects.len()>1 {
        return Err("Choose one handover project before marking this lead Won.".into());
    }else{
        let mut q=db.prepare("SELECT id,name FROM projects").map_err(err)?;
        let rows=q.query_map([],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?))).map_err(err)?;
        let mut matches=vec![];
        for row in rows {let (pid,name)=row.map_err(err)?;if name.trim().to_lowercase()==e.name.trim().to_lowercase(){matches.push(pid);}}
        if matches.len()>1{return Err("Choose one handover project before marking this lead Won.".into());}
        matches.first().copied()
    };
    change(db,&json!({"id":id,"patch":{"status":"won"}}).to_string())?;
    convert(db,id,target)
}
pub fn convert(db: &Connection, id: &str, target: Option<i64>) -> Result<()> {
    let mut e = get(db, id)?.ok_or("Lead no longer exists")?;
    if e.kind != "lead" || e.status != "won" || e.archived {
        return Err("Mark the lead Won before creating a project.".into());
    }
    if e.handover_project.is_some() { return Err("This lead has already been handed over. Open its project to continue.".into()); }
    let pid=if let Some(pid)=target {
        if !db.query_row("SELECT EXISTS(SELECT 1 FROM projects WHERE id=?)",[pid],|r|r.get::<_,bool>(0)).map_err(err)? {return Err("Project is unavailable.".into());} pid
    } else {
        db.execute("INSERT INTO projects(name) VALUES(?)", [&e.name]).map_err(|_| "A project with this name exists. Choose Hand over to existing project, or rename the lead.".to_string())?;
        db.last_insert_rowid()
    };
    let mut overview=crate::project_overview::load(db)?.into_iter().find(|o|o.project_id==pid).unwrap_or(crate::project_overview::Overview {
        project_id:pid,brief:String::new(),status:"planned".into(),deadline:String::new(),actions:vec![],moodboard:None
    });
    if !e.body.trim().is_empty() {
        if overview.brief.trim().is_empty(){overview.brief=e.body.clone();}
        else if overview.brief!=e.body {overview.brief.push_str(&format!("\n\nFrom lead: {}\n{}",e.name,e.body));}
    }
    if overview.deadline.is_empty(){overview.deadline=e.end_date.clone();}
    for action in e.actions.iter().filter(|a|!a.done) {
        let mut moved=action.clone();
        moved.id=format!("{:x}",Sha256::digest(format!("{}:{}",e.id,action.id)));
        // Source-record IDs in project actions refer to client records, not studio leads.
        moved.source_record=None;
        overview.actions.push(moved);
    }
    crate::project_overview::save(db,&overview)?;
    for item in &e.files {
        db.execute(
            "INSERT OR IGNORE INTO item_projects(item_id,label_id) VALUES(?,?)",
            params![item, pid],
        )
        .map_err(err)?;
    }
    for (index, id) in e.contacts.iter().enumerate() {
        let c = get(db, id)?.ok_or("Contact unavailable")?;
        if crate::client_records::load(db)?.contacts.iter().any(|existing|existing.project_id==pid && contact_id(existing)==*id) {continue;}
        crate::client_records::save_contact(
            db,
            &crate::client_records::Contact {
                id: format!("{:x}", Sha256::digest(id.as_bytes())),
                shared_id: id.clone(),
                project_id: pid,
                name: c.name,
                email: c.email,
                phone: c.phone,
                company: c
                    .organization
                    .as_deref()
                    .map(|id| get(db, id))
                    .transpose()?
                    .flatten()
                    .map(|r| r.name)
                    .unwrap_or_default(),
                primary: index == 0 && !crate::client_records::load(db)?.contacts.iter().any(|c|c.project_id==pid&&c.primary),
                ..Default::default()
            },
        )?;
    }
    if !e.projects.contains(&pid){e.projects.push(pid);}
    e.handover_project=Some(pid);
    e.actions.retain(|a|a.done);
    e.updated=db::now();
    put(db, &e)
}
#[derive(Serialize, Deserialize)]
pub struct Snapshot {
    pub id: String,
    pub entry: Option<Entry>,
    pub clients: Vec<crate::client_records::Contact>,
}
pub fn snapshot(db: &Connection, id: &str) -> Result<Snapshot> {
    let entry = get(db, id)?;
    let clients = if entry
        .as_ref()
        .is_some_and(|e| e.kind == "contact" || e.kind == "organization")
    {
        crate::client_records::load(db)?
            .contacts
            .into_iter()
            .filter(|c| {
                contact_id(c) == id || entry.as_ref().is_some_and(|e| e.kind == "organization")
            })
            .collect()
    } else {
        vec![]
    };
    Ok(Snapshot {
        id: id.into(),
        entry,
        clients,
    })
}
pub fn apply(db: &Connection, s: Snapshot) -> Result<()> {
    if let Some(e) = s.entry {
        put(db, &e)?;
    } else {
        db.execute("DELETE FROM studio_records WHERE id=?", [s.id])
            .map_err(err)?;
    }
    for c in s.clients {
        if !db
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM projects WHERE id=?)",
                [c.project_id],
                |r| r.get::<_, bool>(0),
            )
            .map_err(err)?
        {
            continue;
        }
        db.execute("INSERT INTO client_contacts VALUES(?,?,?) ON CONFLICT(project_id,id) DO UPDATE SET data=excluded.data",params![c.project_id,c.id,serde_json::to_string(&c).map_err(err)?]).map_err(err)?;
    }
    Ok(())
}
pub fn import(
    db: &Connection,
    entries: Vec<Entry>,
    projects: &HashMap<i64, i64>,
    items: &HashMap<i64, i64>,
) -> Result<()> {
    for mut e in entries {
        e.handover_project=e.handover_project.and_then(|id|projects.get(&id).copied());
        e.projects = e
            .projects
            .iter()
            .filter_map(|id| projects.get(id).copied())
            .collect();
        e.files = e
            .files
            .iter()
            .filter_map(|id| items.get(id).copied())
            .collect();
        for n in &mut e.moodboard {
            n.item_id = n.item_id.and_then(|id| items.get(&id).copied());
        }
        put(db, &e)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{content, library_export, managed_library};
    use std::path::Path;
    use std::sync::atomic::AtomicBool;
    fn command(path: &Path, action: &str, value: String) -> Result<()> {
        db::change(
            path,
            serde_json::from_value(json!({"action":action,"value":value})).unwrap(),
        )
    }
    fn edit(path: &Path, id: &str, patch: Value) {
        command(
            path,
            "update_studio",
            json!({"id":id,"patch":patch}).to_string(),
        )
        .unwrap();
    }
    fn entry(path: &Path, id: &str) -> Entry {
        get(&db::connect(path).unwrap(), id).unwrap().unwrap()
    }
    #[test]
    fn overlapping_edits_preserve_independent_changes_and_reject_conflicts() {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("db.sqlite");db::init(&path).unwrap();
        let actions=json!([{"id":"a","text":"Original","deadline":"","done":false}]);
        edit(&path,"lead",json!({"kind":"lead","name":"Client","status":"new","actions":actions,"tags":["one"]}));
        let send=|patch:Value,base:Value|command(&path,"update_studio",json!({"id":"lead","patch":patch,"base":base}).to_string());
        send(json!({"actions":[{"id":"a","text":"Changed","deadline":"","done":false}]}),json!({"actions":actions})).unwrap();
        send(json!({"actions":[{"id":"a","text":"Original","deadline":"2026-12-01","done":false}]}),json!({"actions":actions})).unwrap();
        assert_eq!(entry(&path,"lead").actions[0].text,"Changed");assert_eq!(entry(&path,"lead").actions[0].deadline,"2026-12-01");
        assert!(send(json!({"actions":[]}),json!({"actions":actions})).is_err());
        send(json!({"tags":["one","two"]}),json!({"tags":["one"]})).unwrap();
        send(json!({"tags":["one","three"]}),json!({"tags":["one"]})).unwrap();
        assert_eq!(entry(&path,"lead").tags,vec!["one","two","three"]);
        send(json!({"name":"First"}),json!({"name":"Client"})).unwrap();
        assert!(send(json!({"name":"Second"}),json!({"name":"Client"})).is_err());
        assert_eq!(entry(&path,"lead").name,"First");
        db::change(&path,serde_json::from_value(json!({"action":"undo_organisation"})).unwrap()).unwrap();
        assert_eq!(entry(&path,"lead").name,"Client");
    }
    #[test]
    fn existing_project_handover_moves_actions_preserves_context_and_undoes() {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("db.sqlite");db::init(&path).unwrap();
        db::connect(&path).unwrap().execute("INSERT INTO projects VALUES(7,'Existing')",[]).unwrap();
        crate::project_overview::change(&db::connect(&path).unwrap(),7,&json!({"field":"brief","value":"Existing brief"}).to_string()).unwrap();
        edit(&path,"lead",json!({"kind":"lead","name":"New phase","status":"won","body":"Additional scope","actions":[{"id":"next","text":"Deliver","deadline":"2026-12-01","done":false},{"id":"past","text":"Proposal","deadline":"","done":true}]}));
        let handover=||db::change(&path,serde_json::from_value(json!({"action":"convert_studio_lead","target":7,"value":"lead"})).unwrap());
        handover().unwrap();let lead=entry(&path,"lead");assert_eq!(lead.handover_project,Some(7));assert_eq!(lead.actions.len(),1);assert!(lead.actions[0].done);
        let lib=db::load(&path,false).unwrap();assert_eq!(lib.projects.len(),1);assert!(lib.project_overviews[0].brief.starts_with("Existing brief"));assert!(lib.project_overviews[0].brief.contains("Additional scope"));assert_eq!(lib.project_overviews[0].actions.len(),1);
        assert!(handover().is_err());
        db::change(&path,serde_json::from_value(json!({"action":"undo_organisation"})).unwrap()).unwrap();assert_eq!(entry(&path,"lead").actions.len(),2);assert_eq!(entry(&path,"lead").handover_project,None);assert_eq!(db::load(&path,false).unwrap().project_overviews[0].brief,"Existing brief");
        db::change(&path,serde_json::from_value(json!({"action":"redo_organisation"})).unwrap()).unwrap();assert_eq!(entry(&path,"lead").handover_project,Some(7));
        let export=dir.path().join("metadata.json");db::export(&path,export.clone()).unwrap();let target=dir.path().join("target.sqlite");db::init(&target).unwrap();db::connect(&target).unwrap().execute("INSERT INTO projects VALUES(7,'Different')",[]).unwrap();db::import(&target,export).unwrap();let restored=entry(&target,"lead");assert_ne!(restored.handover_project,Some(7));assert_eq!(restored.handover_project,restored.projects.first().copied());
    }
    #[test]
    fn milestones_validate_and_survive_history_and_backup() {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("db.sqlite");db::init(&path).unwrap();
        edit(&path,"campaign",json!({"kind":"campaign","name":"Launch","metrics":[{"id":"reach","name":"Reach","value":"1200","unit":"people"}],"milestones":[{"id":"approval","text":"Creative approval","deadline":"2026-12-01","done":false}]}));
        let export=dir.path().join("metadata.json");db::export(&path,export.clone()).unwrap();let target=dir.path().join("target.sqlite");db::init(&target).unwrap();db::import(&target,export).unwrap();assert_eq!(entry(&target,"campaign").milestones[0].text,"Creative approval");assert_eq!(entry(&target,"campaign").metrics[0].value,"1200");
        assert!(command(&path,"update_studio",json!({"id":"campaign","patch":{"milestones":[{"id":"bad","text":"Invalid date","deadline":"2026-02-30","done":false}]}}).to_string()).is_err());
        assert_eq!(entry(&path,"campaign").milestones.len(),1);
        db::change(&path,serde_json::from_value(json!({"action":"undo_organisation"})).unwrap()).unwrap();assert!(get(&db::connect(&path).unwrap(),"campaign").unwrap().is_none());
    }
    #[test]
    fn research_records_attachments_history_and_backup_roundtrip() {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("library.sqlite");db::init(&path).unwrap();
        edit(&path,"research",json!({"kind":"research","name":"Competitor pricing","status":"saved","service":"pricing","value":49,"currency":"NZD","offer":"per month","body":"Compare services","results":"Check support coverage","tags":["market"],"website":"https://example.com/pricing"}));
        let captured=content::capture(&path,serde_json::from_value(json!({"studio":"research","url":"https://example.com/source"})).unwrap()).unwrap();
        assert_eq!(entry(&path,"research").files,captured.ids);assert!(db::load(&path,false).unwrap().items[0].project_only);
        edit(&path,"research",json!({"status":"complete","archived":true}));
        db::change(&path,serde_json::from_value(json!({"action":"undo_organisation"})).unwrap()).unwrap();assert_eq!(entry(&path,"research").status,"saved");assert!(!entry(&path,"research").archived);
        let backup=dir.path().join("metadata.json");db::export(&path,backup.clone()).unwrap();let restored=dir.path().join("restored.sqlite");db::init(&restored).unwrap();db::import(&restored,backup).unwrap();
        let e=entry(&restored,"research");assert_eq!(e.kind,"research");assert_eq!(e.results,"Check support coverage");assert_eq!(e.value,Some(49.));assert_eq!(e.files.len(),1);assert_eq!(db::load(&restored,false).unwrap().items[0].path,"https://example.com/source");
    }
    #[test]
    fn winning_is_atomic_reuses_projects_and_does_not_duplicate_on_retry() {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("db.sqlite");db::init(&path).unwrap();
        edit(&path,"lead",json!({"kind":"lead","name":"New client","status":"proposal","body":"Website","actions":[{"id":"a","text":"Kickoff","deadline":"2026-12-01","done":false}]}));
        command(&path,"win_studio_lead","lead".into()).unwrap();
        let pid=entry(&path,"lead").handover_project.unwrap();
        assert_eq!(entry(&path,"lead").status,"won");assert_eq!(db::load(&path,false).unwrap().projects.len(),1);
        db::change(&path,serde_json::from_value(json!({"action":"undo_organisation"})).unwrap()).unwrap();
        assert_eq!(entry(&path,"lead").status,"proposal");assert_eq!(entry(&path,"lead").actions.len(),1);assert!(db::load(&path,false).unwrap().projects.is_empty());
        db::change(&path,serde_json::from_value(json!({"action":"redo_organisation"})).unwrap()).unwrap();
        command(&path,"win_studio_lead","lead".into()).unwrap();assert_eq!(entry(&path,"lead").handover_project,Some(pid));assert_eq!(db::load(&path,false).unwrap().projects.len(),1);
        edit(&path,"another",json!({"kind":"lead","name":" new CLIENT ","status":"new"}));command(&path,"win_studio_lead","another".into()).unwrap();assert_eq!(entry(&path,"another").handover_project,Some(pid));assert_eq!(db::load(&path,false).unwrap().projects.len(),1);
        edit(&path,"lost",json!({"kind":"lead","name":"Not proceeding","status":"lost"}));assert_eq!(db::load(&path,false).unwrap().projects.len(),1);
        edit(&path,"invalid",json!({"kind":"lead","name":"Broken target","status":"proposal"}));assert!(db::change(&path,serde_json::from_value(json!({"action":"win_studio_lead","value":"invalid","target":999})).unwrap()).is_err());assert_eq!(entry(&path,"invalid").status,"proposal");
    }
    #[test]
    fn studio_handover_contacts_and_history_are_atomic() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("library.sqlite");
        db::init(&path).unwrap();
        edit(
            &path,
            "person",
            json!({"kind":"contact","name":"Alex","email":"alex@example.com"}),
        );
        edit(
            &path,
            "campaign",
            json!({"kind":"campaign","name":"Studio launch","status":"planning"}),
        );
        edit(
            &path,
            "lead",
            json!({"kind":"lead","name":"Brand refresh","status":"new","contacts":["person"],"campaign":"campaign","body":"Identity and website"}),
        );
        assert!(command(&path, "convert_studio_lead", "lead".into()).is_err());
        edit(&path, "lead", json!({"status":"won"}));
        command(&path, "convert_studio_lead", "lead".into()).unwrap();
        let pid = entry(&path, "lead").projects[0];
        let lib = db::load(&path, false).unwrap();
        assert_eq!(lib.client_records.contacts[0].shared_id, "person");
        assert_eq!(lib.project_overviews[0].brief, "Identity and website");
        assert!(command(&path, "convert_studio_lead", "lead".into()).is_err());
        command(&path, "undo_organisation", "".into()).unwrap_err(); // Expected-label protection remains enforced.
        db::change(
            &path,
            serde_json::from_value(json!({"action":"undo_organisation"})).unwrap(),
        )
        .unwrap();
        assert!(entry(&path, "lead").projects.is_empty());
        assert!(!db::load(&path, false)
            .unwrap()
            .projects
            .iter()
            .any(|p| p.id == pid));
        db::change(
            &path,
            serde_json::from_value(json!({"action":"redo_organisation"})).unwrap(),
        )
        .unwrap();
        assert_eq!(entry(&path, "lead").projects, vec![pid]);
        edit(&path, "person", json!({"name":"Alex Updated"}));
        assert_eq!(
            db::load(&path, false).unwrap().client_records.contacts[0].name,
            "Alex Updated"
        );
        db::change(
            &path,
            serde_json::from_value(json!({"action":"undo_organisation"})).unwrap(),
        )
        .unwrap();
        assert_eq!(
            db::load(&path, false).unwrap().client_records.contacts[0].name,
            "Alex"
        );
        db::change(&path,serde_json::from_value(json!({"action":"update_client_records","target":pid,"value":json!({"type":"contact","id":db::load(&path,false).unwrap().client_records.contacts[0].id,"patch":{"phone":"123"}}).to_string()})).unwrap()).unwrap();
        assert_eq!(entry(&path, "person").phone, "123");
        db::change(
            &path,
            serde_json::from_value(json!({"action":"undo_organisation"})).unwrap(),
        )
        .unwrap();
        assert_eq!(entry(&path, "person").phone, "");
        db::change(
            &path,
            serde_json::from_value(json!({"action":"redo_organisation"})).unwrap(),
        )
        .unwrap();
        assert_eq!(entry(&path, "person").phone, "123");
        assert_eq!(
            db::load(&path, false).unwrap().client_records.contacts[0].phone,
            "123"
        );
        let before = entry(&path, "lead").name;
        for patch in [
            json!({"name":""}),
            json!({"contacts":["missing"]}),
            json!({"status":"invalid"}),
            json!({"date":"2026-02-30"}),
            json!({"value":-2}),
        ] {
            assert!(command(
                &path,
                "update_studio",
                json!({"id":"lead","patch":patch}).to_string()
            )
            .is_err());
        }
        assert_eq!(entry(&path, "lead").name, before);
    }
    #[test]
    fn studio_files_and_relationships_survive_portable_and_metadata_backup() {
        let dir = tempfile::tempdir().unwrap();
        let data = dir.path().join("data");
        std::fs::create_dir(&data).unwrap();
        let path = data.join("library.sqlite");
        db::init(&path).unwrap();
        let root = dir.path().join("Design");
        std::fs::create_dir(&root).unwrap();
        db::set_setting(&db::connect(&path).unwrap(), "root", root.to_str().unwrap()).unwrap();
        edit(&path, "person", json!({"kind":"contact","name":"Alex"}));
        edit(
            &path,
            "campaign",
            json!({"kind":"campaign","name":"Launch","status":"planning"}),
        );
        edit(
            &path,
            "lead",
            json!({"kind":"lead","name":"Client project","status":"won","contacts":["person"],"campaign":"campaign"}),
        );
        let file = dir.path().join("Proposal.docx");
        std::fs::write(&file, b"private project attachment").unwrap();
        let result = content::capture(
            &path,
            serde_json::from_value(
                json!({"studio":"lead","files":[{"path":file,"name":"Proposal.docx"}]}),
            )
            .unwrap(),
        )
        .unwrap();
        let id = result.ids[0];
        let lib = db::load(&path, false).unwrap();
        let item = lib.items.iter().find(|i| i.id == id).unwrap();
        assert!(item.project_only);
        assert!(item.projects.is_empty());
        assert!(item.design_folders.is_empty());
        assert_eq!(entry(&path, "lead").files, vec![id]);
        assert!(crate::project_files::path(&path, id).is_ok());
        command(&path, "convert_studio_lead", "lead".into()).unwrap();
        assert!(db::load(&path, false)
            .unwrap()
            .items
            .iter()
            .find(|i| i.id == id)
            .unwrap()
            .projects
            .contains(&entry(&path, "lead").projects[0]));
        let backupdir = dir.path().join("backups");
        std::fs::create_dir(&backupdir).unwrap();
        let backup = library_export::export(
            &path,
            &backupdir,
            "Studio",
            &AtomicBool::new(false),
            &mut |_| {},
        )
        .unwrap();
        let restored = managed_library::open(Path::new(&backup.path)).unwrap();
        let lead = entry(&restored, "lead");
        assert_eq!(lead.contacts, vec!["person"]);
        assert_eq!(lead.campaign.as_deref(), Some("campaign"));
        let restored_lib = db::load(&restored, false).unwrap();
        assert!(restored_lib
            .items
            .iter()
            .any(|i| i.id == lead.files[0] && Path::new(&i.path).is_file()));
        assert!(restored_lib
            .projects
            .iter()
            .any(|p| p.id == lead.projects[0]));
        let export = dir.path().join("metadata.json");
        db::export(&path, export.clone()).unwrap();
        let target = data.join("other.sqlite");
        db::init(&target).unwrap();
        db::connect(&target).unwrap().execute_batch("INSERT INTO projects VALUES(1,'Existing');INSERT INTO items(id,path,name,kind,added) VALUES(1,'https://example.com','Existing','link',1);").unwrap();
        db::import(&target, export.clone()).unwrap();
        let lead = entry(&target, "lead");
        assert_ne!(lead.files[0], id);
        let lib = db::load(&target, false).unwrap();
        assert!(lib
            .projects
            .iter()
            .any(|p| p.id == lead.projects[0] && p.name == "Client project"));
        assert_eq!(lib.client_records.contacts[0].shared_id, "person");
        assert_eq!(lib.studio.iter().filter(|e| e.kind == "contact").count(), 1);
        let mut old: Value = serde_json::from_slice(&std::fs::read(&export).unwrap()).unwrap();
        old["library"].as_object_mut().unwrap().remove("studio");
        std::fs::write(&export, old.to_string()).unwrap();
        db::import(&target, export).unwrap();
        assert_eq!(entry(&target, "campaign").name, "Launch");
    }
    #[test]
    fn migration_keeps_same_named_contacts_separate_and_is_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("library.sqlite");
        db::init(&path).unwrap();
        let db = db::connect(&path).unwrap();
        db.execute_batch("INSERT INTO projects VALUES(7,'First'),(8,'Second');DELETE FROM settings WHERE key='studio_contacts_v1';").unwrap();
        for project_id in [7, 8] {
            let c = crate::client_records::Contact {
                id: "one".into(),
                project_id,
                name: "Alex".into(),
                ..Default::default()
            };
            db.execute(
                "INSERT INTO client_contacts VALUES(?,?,?)",
                params![project_id, c.id, serde_json::to_string(&c).unwrap()],
            )
            .unwrap();
        }
        init(&db).unwrap();
        init(&db).unwrap();
        assert_eq!(
            load(&db)
                .unwrap()
                .iter()
                .filter(|e| e.kind == "contact")
                .count(),
            2
        );
        assert!(crate::client_records::load(&db)
            .unwrap()
            .contacts
            .iter()
            .all(|c| !c.shared_id.is_empty()));
    }
    #[test]
    fn studio_links_keep_original_collections_and_project_delete_roundtrips() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("library.sqlite");
        db::init(&path).unwrap();
        edit(
            &path,
            "lead",
            json!({"kind":"lead","name":"New work","status":"won"}),
        );
        let capture = |url: &str| {
            content::capture(
                &path,
                serde_json::from_value(json!({"studio":"lead","url":url})).unwrap(),
            )
            .unwrap()
        };
        let first = capture("https://example.com/private");
        let again = capture("https://example.com/private");
        assert_eq!(first.ids, again.ids);
        let lib = db::load(&path, false).unwrap();
        let link = lib.items.iter().find(|i| i.id == first.ids[0]).unwrap();
        assert!(link.project_only);
        assert_eq!(link.source, "Studio");
        assert_eq!(entry(&path, "lead").files.len(), 1);
        db::connect(&path).unwrap().execute("INSERT INTO items(path,name,kind,source,added) VALUES('https://example.com/resource','Keep resource','link','Resources/Design',1)",[]).unwrap();
        let reused = capture("https://example.com/resource");
        assert_eq!(
            db::load(&path, false)
                .unwrap()
                .items
                .iter()
                .find(|i| i.id == reused.ids[0])
                .unwrap()
                .source,
            "Resources/Design"
        );
        command(&path, "convert_studio_lead", "lead".into()).unwrap();
        let pid = entry(&path, "lead").projects[0];
        db::change(
            &path,
            serde_json::from_value(json!({"action":"delete_project","target":pid})).unwrap(),
        )
        .unwrap();
        assert!(entry(&path, "lead").projects.is_empty());
        db::change(
            &path,
            serde_json::from_value(json!({"action":"undo_organisation"})).unwrap(),
        )
        .unwrap();
        assert_eq!(entry(&path, "lead").projects, vec![pid]);
        db::change(
            &path,
            serde_json::from_value(json!({"action":"redo_organisation"})).unwrap(),
        )
        .unwrap();
        assert!(entry(&path, "lead").projects.is_empty());
    }
}
