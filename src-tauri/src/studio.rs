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
    pub kind: String,
    pub name: String,
    pub archived: bool,
    pub organization: Option<String>,
    pub contacts: Vec<String>,
    pub projects: Vec<i64>,
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
    pub activity_type: String,
    pub actions: Vec<crate::project_overview::Action>,
    pub moodboard: Vec<crate::project_overview::BoardNode>,
    pub stages: Vec<Stage>,
    pub created: i64,
    pub updated: i64,
}
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
    // Reuse the same validation limits as project actions and moodboards.
    if e.actions.len() > 500 || e.moodboard.len() > 300 {
        return Err("Too many actions or moodboard elements.".into());
    }
    for a in &e.actions {
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
pub fn change(db: &Connection, input: &str) -> Result<()> {
    let v: Value = serde_json::from_str(input).map_err(err)?;
    let id = v["id"].as_str().ok_or("Missing record")?;
    let old = get(db, id)?;
    let mut data = serde_json::to_value(old.clone().unwrap_or_default()).map_err(err)?;
    let patch = v["patch"].as_object().ok_or("Missing record changes")?;
    for (k, value) in patch {
        if ["id", "created", "updated"].contains(&k.as_str()) || (k == "kind" && old.is_some()) {
            return Err("Record identity cannot change.".into());
        }
        data[k] = value.clone();
    }
    data["id"] = json!(id);
    let mut e: Entry = serde_json::from_value(data).map_err(err)?;
    if old.is_none() {
        e.created = db::now();
    }
    e.updated = db::now();
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
pub fn convert(db: &Connection, id: &str) -> Result<()> {
    let mut e = get(db, id)?.ok_or("Lead no longer exists")?;
    if e.kind != "lead" || e.status != "won" || e.archived {
        return Err("Mark the lead Won before creating a project.".into());
    }
    if !e.projects.is_empty() {
        return Err("This lead already has a linked project.".into());
    }
    db.execute("INSERT INTO projects(name) VALUES(?)", [&e.name])
        .map_err(|_| {
            "A project with this name exists. Link it instead, or rename the lead.".to_string()
        })?;
    let pid = db.last_insert_rowid();
    crate::project_overview::save(
        db,
        &crate::project_overview::Overview {
            project_id: pid,
            brief: e.body.clone(),
            status: "planned".into(),
            deadline: e.end_date.clone(),
            actions: e.actions.clone(),
            moodboard: None,
        },
    )?;
    for item in &e.files {
        db.execute(
            "INSERT OR IGNORE INTO item_projects(item_id,label_id) VALUES(?,?)",
            params![item, pid],
        )
        .map_err(err)?;
    }
    for (index, id) in e.contacts.iter().enumerate() {
        let c = get(db, id)?.ok_or("Contact unavailable")?;
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
                primary: index == 0,
                ..Default::default()
            },
        )?;
    }
    e.projects.push(pid);
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
