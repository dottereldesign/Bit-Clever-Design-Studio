use crate::db::{self, err, Result};
use base64::Engine;
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    fs,
    net::TcpStream,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tungstenite::{stream::MaybeTlsStream, Message, WebSocket};

#[derive(Default)]
pub struct Jobs(pub Mutex<Option<Arc<Job>>>);
#[derive(Default)]
pub struct Job {
    pub cancel: AtomicBool,
    pub resume: AtomicBool,
}
#[derive(Clone, Serialize)]
pub struct Progress {
    pub phase: &'static str,
    pub message: String,
}
#[derive(Serialize)]
pub struct Browser {
    pub id: &'static str,
    pub name: &'static str,
}
fn executable(browser: &str) -> Option<PathBuf> {
    let suffix = match browser {
        "chrome" => "Google/Chrome/Application/chrome.exe",
        "edge" => "Microsoft/Edge/Application/msedge.exe",
        _ => return None,
    };
    ["PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"]
        .iter()
        .filter_map(std::env::var_os)
        .map(|p| PathBuf::from(p).join(suffix))
        .find(|p| p.is_file())
}
pub fn browsers() -> Vec<Browser> {
    [("chrome", "Chrome"), ("edge", "Edge")]
        .into_iter()
        .filter(|(id, _)| executable(id).is_some())
        .map(|(id, name)| Browser { id, name })
        .collect()
}
fn check(job: &Job) -> Result<()> {
    if job.cancel.load(Ordering::SeqCst) {
        Err("Capture cancelled".into())
    } else {
        Ok(())
    }
}
fn wait(job: &Job, ms: u64) -> Result<()> {
    let until = Instant::now() + Duration::from_millis(ms);
    while Instant::now() < until {
        check(job)?;
        std::thread::sleep(Duration::from_millis(50));
    }
    Ok(())
}
struct BrowserProcess(Child);
impl Drop for BrowserProcess {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
struct Cdp {
    socket: WebSocket<MaybeTlsStream<TcpStream>>,
    id: u64,
    session: Option<String>,
}
impl Cdp {
    fn call(&mut self, method: &str, params: Value, job: &Job) -> Result<Value> {
        check(job)?;
        self.id += 1;
        let id = self.id;
        let mut request = json!({"id":id,"method":method,"params":params});
        if let Some(session) = &self.session {
            request["sessionId"] = json!(session);
        }
        self.socket
            .send(Message::Text(request.to_string().into()))
            .map_err(err)?;
        let deadline = Instant::now() + Duration::from_secs(45);
        while Instant::now() < deadline {
            check(job)?;
            match self.socket.read() {
                Ok(Message::Text(text)) => {
                    let v: Value = serde_json::from_str(&text).map_err(err)?;
                    if v["id"] == id {
                        if !v["error"].is_null() {
                            return Err(format!("Browser capture: {}", v["error"]));
                        }
                        return Ok(v["result"].clone());
                    }
                }
                Ok(_) => {}
                Err(tungstenite::Error::Io(e))
                    if [std::io::ErrorKind::WouldBlock, std::io::ErrorKind::TimedOut]
                        .contains(&e.kind()) => {}
                Err(e) => return Err(format!("Capture browser closed or disconnected: {e}")),
            }
        }
        Err("The website took too long to respond. Try again or paste an image.".into())
    }
    fn js(&mut self, expression: &str, job: &Job) -> Result<Value> {
        let r = self.call(
            "Runtime.evaluate",
            json!({"expression":expression,"awaitPromise":true,"returnByValue":true}),
            job,
        )?;
        if !r["exceptionDetails"].is_null() {
            return Err("This page could not be prepared for capture.".into());
        }
        Ok(r["result"]["value"].clone())
    }
}
// One render, never a sequence of stitched screen images. Scrolling only activates lazy content.
pub fn capture(
    data: &Path,
    browser: &str,
    url: &str,
    job: &Job,
    headless: bool,
    send: &mut impl FnMut(Progress),
) -> Result<crate::content::CaptureFile> {
    check(job)?;
    db::valid_url(url)?;
    let exe = executable(browser).ok_or("Install Chrome or Edge to use automatic capture.")?;
    let profile = data.join("cache/website-browser").join(browser);
    fs::create_dir_all(&profile).map_err(err)?;
    let port_file = profile.join("DevToolsActivePort");
    if port_file.exists() {
        fs::remove_file(&port_file).map_err(err)?;
    }
    let mut command = Command::new(exe);
    command.args([
        "--remote-debugging-port=0",
        "--remote-debugging-address=127.0.0.1",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-extensions",
        "--disable-sync",
        "--window-size=1460,1000",
        "--force-device-scale-factor=1",
    ]);
    command.arg(format!("--user-data-dir={}", profile.display()));
    if headless {
        command.arg("--headless=new");
    }
    command
        .arg("about:blank")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    send(Progress {
        phase: "opening",
        message: "Opening capture browser · 1440 × 900".into(),
    });
    let mut child = BrowserProcess(command.spawn().map_err(err)?);
    let started = Instant::now();
    let endpoint = loop {
        check(job)?;
        if let Ok(text) = fs::read_to_string(&port_file) {
            let mut lines = text.lines();
            if let (Some(port), Some(path)) = (lines.next(), lines.next()) {
                if port.parse::<u16>().is_ok() && path.starts_with("/devtools/browser/") {
                    break format!("ws://127.0.0.1:{port}{path}");
                }
            }
        }
        if child.0.try_wait().map_err(err)?.is_some() {
            return Err("The capture browser closed before it was ready.".into());
        }
        if started.elapsed() > Duration::from_secs(20) {
            return Err("Could not connect to the capture browser.".into());
        }
        wait(job, 100)?;
    };
    let (mut socket, _) = tungstenite::connect(endpoint).map_err(err)?;
    if let MaybeTlsStream::Plain(stream) = socket.get_mut() {
        stream
            .set_read_timeout(Some(Duration::from_millis(250)))
            .map_err(err)?;
        stream
            .set_write_timeout(Some(Duration::from_secs(5)))
            .map_err(err)?;
    }
    socket.set_config(|config| {
        config.max_message_size = Some(160 * 1024 * 1024);
        config.max_frame_size = Some(160 * 1024 * 1024);
    });
    let mut cdp = Cdp {
        socket,
        id: 0,
        session: None,
    };
    let result = (|| {
        let target = cdp.call("Target.createTarget", json!({"url":"about:blank"}), job)?;
        let attached = cdp.call(
            "Target.attachToTarget",
            json!({"targetId":target["targetId"],"flatten":true}),
            job,
        )?;
        cdp.session = Some(
            attached["sessionId"]
                .as_str()
                .ok_or("Could not attach capture page")?
                .into(),
        );
        cdp.call(
            "Emulation.setDeviceMetricsOverride",
            json!({"width":1440,"height":900,"deviceScaleFactor":1,"mobile":false}),
            job,
        )?;
        cdp.call(
            "Emulation.setEmulatedMedia",
            json!({"features":[{"name":"prefers-reduced-motion","value":"reduce"}]}),
            job,
        )?;
        cdp.call("Page.enable", json!({}), job)?;
        cdp.call("Page.bringToFront", json!({}), job)?;
        send(Progress {
            phase: "loading",
            message: "Loading website".into(),
        });
        let navigation = cdp.call("Page.navigate", json!({"url":url}), job)?;
        if let Some(error) = navigation["errorText"].as_str() {
            return Err(format!("Website could not load: {error}"));
        }
        let start = Instant::now();
        loop {
            wait(job, 300)?;
            if cdp
                .js(
                    "document.readyState==='complete' && location.href!=='about:blank'",
                    job,
                )?
                .as_bool()
                == Some(true)
            {
                break;
            }
            if start.elapsed() > Duration::from_secs(30) {
                return Err("Page did not finish loading. Try again or paste an image.".into());
            }
        }
        wait(job, 1000)?;
        let blocked=cdp.js(include_str!("capture-blockers.js"),job)?.as_bool().unwrap_or(false);
        if blocked {
            job.resume.store(false, Ordering::SeqCst);
            send(Progress{phase:"attention",message:"Handle the website notice, then click Continue capture in the browser or here.".into()});
            cdp.js(include_str!("capture-controls.js"),job)?;
            let start = Instant::now();
            while !job.resume.load(Ordering::SeqCst) {
                wait(job, 150)?;
                cdp.js(include_str!("capture-controls.js"),job)?;
                match cdp.js("window.__bitcleverCaptureAction || ''",job)?.as_str() {
                    Some("continue")=>job.resume.store(true,Ordering::SeqCst),
                    Some("cancel")=>{job.cancel.store(true,Ordering::SeqCst);check(job)?;},
                    _=>{}
                }
                if start.elapsed() > Duration::from_secs(300) {
                    return Err("Capture paused too long. Start again when ready.".into());
                }
            }
        }
        cdp.js("document.getElementById('bitclever-capture-controls')?.remove();delete window.__bitcleverCaptureAction;true",job)?;
        send(Progress {
            phase: "preparing",
            message: "Loading images and revealing page sections".into(),
        });
        cdp.js("document.documentElement.style.setProperty('scroll-behavior','auto','important');true",job)?;
        let mut previous = 0u64;
        let mut stable = 0;
        let mut y = 0u64;
        for step in 0..100 {
            let height=cdp.js("Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0)",job)?.as_u64().unwrap_or(0);
            if height > 40000 || height == 0 {
                return Err("This page exceeds the 40,000px capture limit. Use a manual image instead; no partial screenshot was saved.".into());
            }
            if y >= height.saturating_sub(900) {
                if height == previous {
                    stable += 1;
                } else {
                    stable = 0;
                }
                if stable >= 3 {
                    break;
                }
            }
            previous = height;
            cdp.js(&format!("window.scrollTo(0,{y});true"), job)?;
            wait(job, 350)?;
            y = (y + 700).min(height.saturating_sub(900));
            if step == 99 {
                return Err("Page keeps growing or scrolling indefinitely. No partial screenshot was saved.".into());
            }
        }
        cdp.js(r#"(async()=>{await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,5000))]);await Promise.race([Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,8000))]);document.querySelectorAll('video,audio').forEach(v=>v.pause());document.getAnimations().forEach(a=>{try{a.finish()}catch{a.pause()}});const style=document.createElement('style');style.textContent='html{scroll-behavior:auto!important}*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}';document.head.append(style);window.scrollTo(0,0);return true})()"#,job)?;
        wait(job, 800)?;
        let metrics = cdp.call("Page.getLayoutMetrics", json!({}), job)?;
        let height = metrics["cssContentSize"]["height"]
            .as_f64()
            .ok_or("Could not measure the page")?
            .ceil();
        let width = metrics["cssContentSize"]["width"].as_f64().unwrap_or(1440.);
        if height > 40000. || width > 1441. {
            return Err(
                "The page overflows the capture size. No cropped or partial screenshot was saved."
                    .into(),
            );
        }
        send(Progress {
            phase: "capturing",
            message: format!("Capturing full page · 1440 × {}", height as u64),
        });
        let shot=cdp.call("Page.captureScreenshot",json!({"format":"png","fromSurface":true,"captureBeyondViewport":true,"clip":{"x":0,"y":0,"width":1440,"height":height,"scale":1}}),job)?;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(shot["data"].as_str().ok_or("Browser returned no image")?)
            .map_err(err)?;
        check(job)?;
        let image = image::load_from_memory(&bytes).map_err(err)?;
        if image.width() != 1440 || image.height() != height as u32 {
            return Err("Screenshot dimensions did not match the full page. Try again.".into());
        }
        let folder = data.join("staging");
        fs::create_dir_all(&folder).map_err(err)?;
        let path = folder.join(format!("website-{}.png", crate::content::nonce()));
        fs::write(&path, bytes).map_err(err)?;
        Ok(crate::content::CaptureFile {
            path: path.to_string_lossy().into_owned(),
            name: "Website.png".into(),
        })
    })();
    cdp.session = None;
    let _ = cdp.call("Browser.close", json!({}), &Job::default());
    if job.cancel.load(Ordering::SeqCst) {
        if let Ok(file) = &result { let _ = fs::remove_file(&file.path); }
        return Err("Capture cancelled".into());
    }
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invalid_browser_and_cancel_are_rejected() {
        assert!(executable("unknown").is_none());
        let j = Job::default();
        j.cancel.store(true, Ordering::SeqCst);
        assert!(wait(&j, 1).is_err());
    }
    #[test]
    #[ignore = "Launches an isolated headless browser against a local fixture"]
    fn full_page_has_consistent_width_and_no_scroll_seams() {
        use std::io::{Read, Write};
        let browser = browsers().into_iter().next().expect("Chrome or Edge");
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        std::thread::spawn(move || {
            for stream in listener.incoming().take(8) {
                let mut stream = stream.unwrap();
                let mut buf = [0; 4096];
                let _ = stream.read(&mut buf);
                let body="<!doctype html><style>html,body{margin:0}body{height:4200px;background:linear-gradient(#f00,#00f)}</style><div style='height:100px;background:#0f0'>Capture fixture</div><div role='dialog' style='height:233px;position:fixed;visibility:hidden'>Hidden region dialog</div><div style='opacity:0'><div role='dialog' style='position:fixed;height:80px'>Hidden parent</div></div>";
                let body=if String::from_utf8_lossy(&buf).contains("GET /prompt ") {
                    format!("{body}<div id='cookie' role='dialog' style='position:fixed;top:0;background:white'>Cookies</div><script>let t=setInterval(()=>{{let h=document.getElementById('bitclever-capture-controls');if(h){{document.getElementById('cookie').remove();h.shadowRoot.getElementById('continue').click();clearInterval(t);}}}},50)</script>")
                }else{body.to_owned()};
                let _=write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body);
            }
        });
        let temp = tempfile::tempdir().unwrap();
        let file = capture(
            temp.path(),
            browser.id,
            &format!("http://{address}/"),
            &Job::default(),
            true,
            &mut |p| {assert_ne!(p.phase,"attention","Hidden dialogs must not pause capture");},
        )
        .unwrap();
        let image = image::open(file.path).unwrap().to_rgb8();
        assert_eq!(image.dimensions(), (1440, 4200));
        for y in [899, 900, 901, 1799, 1800, 1801, 2699, 2700, 2701] {
            let p = image.get_pixel(720, y).0;
            assert!(p[1] < 5, "Unexpected gap at {y}");
        }
        assert!(image.get_pixel(720, 4199).0[2] > 240);
        let mut paused=false;
        let file=capture(temp.path(),browser.id,&format!("http://{address}/prompt"),&Job::default(),true,&mut |p|{if p.phase=="attention"{paused=true;}}).unwrap();
        assert!(paused,"Visible dialog must offer browser controls");
        let image=image::open(file.path).unwrap().to_rgb8();assert_eq!(image.dimensions(),(1440,4200));
        assert_eq!(image.get_pixel(1300,50).0,[0,255,0],"Capture controls must be removed from screenshot");

    }
}
