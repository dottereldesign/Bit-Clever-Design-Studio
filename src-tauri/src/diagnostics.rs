use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc::{sync_channel, SyncSender},
        OnceLock,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
static LOGGER: OnceLock<Logger> = OnceLock::new();
struct Logger {
    root: PathBuf,
    tx: SyncSender<Event>,
    dropped: AtomicU64,
    failures: AtomicU64,
    session: String,
}
const CAP: u64 = 100 * 1024 * 1024;
pub fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Event {
    #[serde(default)]
    pub time: u64,
    pub name: String,
    #[serde(default)]
    pub operation: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub duration: f64,
    #[serde(default)]
    pub fields: serde_json::Value,
}
fn token(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_ascii_alphanumeric() || "._-:".contains(*c))
        .take(120)
        .collect()
}
// Never accept arbitrary clipboard text, URLs, paths, exception messages or argument dumps.
fn clean(mut e: Event) -> Event {
    let observed = now();
    if e.time == 0 || e.time > observed + 60000 || e.time < observed.saturating_sub(86400000) {
        e.time = observed;
    }
    e.name = token(&e.name);
    e.operation = token(&e.operation);
    e.status = token(&e.status);
    if !e.duration.is_finite() {
        e.duration = 0.;
    }
    e.duration = e.duration.max(0.);
    let mut fields = serde_json::Map::new();
    if let Some(input) = e.fields.as_object() {
        for (key, value) in input {
            if [
                "count",
                "id",
                "project",
                "folder",
                "pending",
                "bytes",
                "completed",
                "total",
                "width",
                "height",
                "items",
                "rendered",
                "elapsed",
                "added",
                "reused",
                "failed",
                "queue_ms",
                "error_code",
                "phase",
                "view",
                "action",
                "source",
                "session",
                "build",
                "mode",
            ]
            .contains(&key.as_str())
            {
                if value.is_number() || value.is_boolean() || value.is_null() {
                    fields.insert(key.clone(), value.clone());
                } else if let Some(v) = value.as_str() {
                    fields.insert(key.clone(), serde_json::Value::String(token(v)));
                }
            }
        }
    }
    e.fields = fields.into();
    e
}
fn files(root: &Path) -> Vec<PathBuf> {
    let mut result = std::fs::read_dir(root)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().is_some_and(|s| s == "sqlite"))
        .collect::<Vec<_>>();
    result.sort();
    result
}
fn prune(root: &Path, today: u64) -> std::io::Result<()> {
    let paths = files(root);
    let mut size = paths
        .iter()
        .filter_map(|p| p.metadata().ok())
        .map(|m| m.len())
        .sum::<u64>();
    for path in paths {
        let day = path
            .file_stem()
            .and_then(|s| s.to_str())
            .and_then(|s| s.strip_prefix("events-"))
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(today);
        let bytes = path.metadata()?.len();
        if day + 7 <= today || (size > CAP && day < today) {
            std::fs::remove_file(path)?;
            size = size.saturating_sub(bytes);
        }
    }
    Ok(())
}
fn write(root: &Path, events: &[Event]) -> Result<(), String> {
    let day = now() / 86400000;
    prune(root, day).map_err(|e| e.to_string())?;
    let path = root.join(format!("events-{day}.sqlite"));
    if path.metadata().map(|m| m.len() >= CAP).unwrap_or(false) {
        return Err("Daily diagnostics capacity reached".into());
    }
    let mut db = Connection::open(path).map_err(|e| e.to_string())?;
    db.execute_batch("CREATE TABLE IF NOT EXISTS events(time INTEGER NOT NULL,name TEXT NOT NULL,status TEXT NOT NULL,body TEXT NOT NULL); CREATE INDEX IF NOT EXISTS event_time ON events(time);").map_err(|e|e.to_string())?;
    let tx = db.transaction().map_err(|e| e.to_string())?;
    for event in events {
        tx.execute(
            "INSERT INTO events VALUES(?,?,?,?)",
            params![
                event.time,
                event.name,
                event.status,
                serde_json::to_string(event).unwrap()
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    prune(root, day).map_err(|e| e.to_string())
}
pub fn record(e: Event) {
    if let Some(l) = LOGGER.get() {
        let mut e = clean(e);
        e.fields["session"] = l.session.clone().into();
        if l.tx.try_send(e).is_err() {
            l.dropped.fetch_add(1, Ordering::Relaxed);
        }
    }
}
pub fn event(name: &str, status: &str, duration: f64, fields: serde_json::Value) {
    record(Event {
        time: 0,
        name: name.into(),
        operation: String::new(),
        status: status.into(),
        duration,
        fields,
    });
}
pub fn init(data: &Path) {
    let root = data.join("Diagnostics");
    if std::fs::create_dir_all(&root).is_err() {
        return;
    }
    let interrupted = root.join("active-session.json").exists();
    let session = now().to_string();
    let _ = std::fs::write(root.join("active-session.json"), &session);
    let (tx, rx) = sync_channel(2048);
    if LOGGER
        .set(Logger {
            root: root.clone(),
            tx,
            dropped: AtomicU64::new(0),
            failures: AtomicU64::new(0),
            session,
        })
        .is_err()
    {
        return;
    }
    std::thread::spawn(move || loop {
        let mut batch = Vec::new();
        match rx.recv_timeout(Duration::from_secs(1)) {
            Ok(e) => batch.push(e),
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
            Err(_) => {}
        }
        batch.extend(rx.try_iter().take(255));
        let result = if batch.is_empty() {
            prune(&root, now() / 86400000).map_err(|e| e.to_string())
        } else {
            write(&root, &batch)
        };
        if result.is_err() {
            if let Some(l) = LOGGER.get() {
                l.failures
                    .fetch_add(batch.len().max(1) as u64, Ordering::Relaxed);
            }
        }
    });
    event(
        "session.start",
        "success",
        0.,
        serde_json::json!({"build":env!("BITCLEVER_COMMIT"),"mode":if cfg!(debug_assertions){"development"}else{"standalone"}}),
    );
    if interrupted {
        event(
            "session.previous_interrupted",
            "warning",
            0.,
            serde_json::json!({}),
        );
    }
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        if let Some(l) = LOGGER.get() {
            let _ = std::fs::write(
                l.root.join("crash.json"),
                serde_json::json!({"time":now(),"session":l.session,"kind":"native-panic"})
                    .to_string(),
            );
        }
        previous(info);
    }));
}
pub fn shutdown() {
    if let Some(l) = LOGGER.get() {
        let e = clean(Event {
            time: 0,
            name: "session.end".into(),
            operation: String::new(),
            status: "success".into(),
            duration: 0.,
            fields: serde_json::json!({"session":l.session}),
        });
        let _ = write(&l.root, &[e]);
        let _ = std::fs::remove_file(l.root.join("active-session.json"));
    }
}
#[tauri::command]
pub fn diagnostics_record(events: Vec<Event>) {
    for e in events.into_iter().take(256) {
        record(e);
    }
}
#[tauri::command]
pub async fn diagnostics_read() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| snapshot(20000))
        .await
        .map_err(|e| e.to_string())?
}
fn read_file(path: &Path, limit: usize) -> Result<(u64, Vec<serde_json::Value>), String> {
    let db = Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| e.to_string())?;
    db.busy_timeout(Duration::from_millis(200))
        .map_err(|e| e.to_string())?;
    let cutoff = now().saturating_sub(7 * 86400000);
    let total = db
        .query_row("SELECT count(*) FROM events WHERE time>=?", [cutoff], |r| {
            r.get::<_, u64>(0)
        })
        .map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT body FROM events WHERE time>=? ORDER BY time DESC,rowid DESC LIMIT ?")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![cutoff, limit], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    let mut events = Vec::new();
    for row in rows {
        events.push(
            serde_json::from_str(&row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())?,
        );
    }
    Ok((total, events))
}
fn snapshot(limit: usize) -> Result<serde_json::Value, String> {
    let l = LOGGER.get().ok_or("Diagnostics is unavailable")?;
    let mut events = Vec::<serde_json::Value>::new();
    let mut bytes = 0;
    let mut total = 0;
    let mut unreadable = 0;
    for path in files(&l.root).into_iter().rev() {
        bytes += path.metadata().map(|m| m.len()).unwrap_or(0);
        match read_file(&path, limit.saturating_sub(events.len())) {
            Ok((count, rows)) => {
                total += count;
                events.extend(rows);
            }
            Err(_) => unreadable += 1,
        }
    }
    Ok(
        serde_json::json!({"events":events,"total":total,"bytes":bytes,"unreadable_files":unreadable,"dropped":l.dropped.load(Ordering::Relaxed),"failed_writes":l.failures.load(Ordering::Relaxed),"retention_days":7,"cap_bytes":CAP,"version":env!("CARGO_PKG_VERSION"),"commit":env!("BITCLEVER_COMMIT"),"platform":std::env::consts::OS,"mode":if cfg!(debug_assertions){"development"}else{"standalone"},"crash":std::fs::read_to_string(l.root.join("crash.json")).ok()}),
    )
}
#[tauri::command]
pub fn diagnostics_folder() -> Result<String, String> {
    Ok(LOGGER
        .get()
        .ok_or("Diagnostics is unavailable")?
        .root
        .to_string_lossy()
        .into_owned())
}
#[tauri::command]
pub async fn diagnostics_export(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let data = snapshot(1_000_000)?;
        let mut output = std::fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(path)
            .map_err(|e| e.to_string())?;
        use std::io::Write;
        output
            .write_all(
                serde_json::to_string_pretty(&data)
                    .map_err(|e| e.to_string())?
                    .as_bytes(),
            )
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn privacy() {
        let e = clean(Event {
            time: 0,
            name: "paste".into(),
            operation: "op-1".into(),
            status: "failed".into(),
            duration: 12.,
            fields: serde_json::json!({"url":"https://secret/?token=abc","path":"C:/Private","clipboard":"secret","count":2,"error_code":"timeout"}),
        });
        assert_eq!(e.fields.as_object().unwrap().len(), 2);
        assert_eq!(e.fields["count"], 2);
    }
    #[test]
    fn retention_and_readable_events() {
        let temp = tempfile::tempdir().unwrap();
        let day = now() / 86400000;
        let expired = temp.path().join(format!("events-{}.sqlite", day - 7));
        std::fs::write(&expired, "old").unwrap();
        write(
            temp.path(),
            &[clean(Event {
                time: 0,
                name: "test".into(),
                operation: "one".into(),
                status: "success".into(),
                duration: 1.,
                fields: serde_json::json!({}),
            })],
        )
        .unwrap();
        assert!(!expired.exists());
        let db = Connection::open(files(temp.path()).pop().unwrap()).unwrap();
        assert_eq!(
            db.query_row("SELECT count(*) FROM events", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            1
        );
    }
}

#[cfg(test)]
mod failure_tests {
    use super::*;
    #[test]
    fn capacity_and_corruption_are_errors() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir
            .path()
            .join(format!("events-{}.sqlite", now() / 86400000));
        std::fs::File::create(&path).unwrap().set_len(CAP).unwrap();
        assert!(write(dir.path(), &[]).is_err());
        assert!(read_file(&path, 10).is_err());
    }
    #[test]
    fn invalid_destination_does_not_panic() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("file");
        std::fs::write(&file, "x").unwrap();
        assert!(write(&file, &[]).is_err());
    }
}
