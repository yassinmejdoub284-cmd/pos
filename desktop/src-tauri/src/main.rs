#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    path::{Path, PathBuf},
    process::{Child, Command},
    sync::Mutex,
    time::Duration,
};

use serde::Deserialize;
use tauri::{App, Manager, WebviewUrl};

// ── Sidecar process handle ────────────────────────────────────────────────────
struct ServerProcess(Mutex<Option<Child>>);

// ── App config (app-config.json next to the .exe) ────────────────────────────
#[derive(Deserialize, Debug)]
struct AppConfig {
    #[serde(rename = "TARGET_URL")]
    target_url: Option<String>,
}

fn try_read_config(path: &Path) -> Option<AppConfig> {
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<AppConfig>(&raw).ok())
}

fn read_app_config(app_handle: &tauri::AppHandle) -> AppConfig {
    let exe_dir   = app_handle.path().executable_dir().ok();
    let cur_dir   = std::env::current_dir().ok();

    let candidates: Vec<PathBuf> = [
        exe_dir.as_ref().map(|p| p.join("app-config.json")),
        exe_dir.as_ref().map(|p| p.join("resources").join("app-config.json")),
        cur_dir.as_ref().map(|p| p.join("app-config.json")),
        cur_dir.as_ref().map(|p| p.join("resources").join("app-config.json")),
    ]
    .into_iter()
    .flatten()
    .collect();

    for c in candidates {
        if let Some(cfg) = try_read_config(&c) {
            return cfg;
        }
    }
    AppConfig { target_url: None }
}

/// Start the bundled Express server sidecar ─────────────────────────────────
fn start_backend_server(app_handle: &tauri::AppHandle) -> Option<Child> {
    // Tauri 2 copies bundle.resources into <exe_dir>\resources\ at install time.
    // During dev / direct exe run they sit next to the exe.
    let exe_dir = app_handle.path().executable_dir().ok()?;

    // Try resources sub-folder first (installed), then exe dir (portable/dev)
    let candidates = vec![
        exe_dir.join("resources").join("pos-server.exe"),
        exe_dir.join("pos-server.exe"),
    ];

    let server_exe = candidates.into_iter().find(|p| p.exists())?;
    let server_dir = server_exe.parent().unwrap_or(&exe_dir).to_path_buf();

    // DB lives next to the exe (user-writable, persists across upgrades)
    let db_path = exe_dir.join("pos_patisserie.db");
    let db_url  = format!("file:{}", db_path.to_string_lossy().replace('\\', "/"));

    println!("[Tauri] Starting backend: {:?}", server_exe);
    println!("[Tauri] DATABASE_URL={}", db_url);

    let child = Command::new(&server_exe)
        .env("DATABASE_URL", &db_url)
        .env("JWT_SECRET",   "pos-patisserie-offline-secret-key-2024")
        .env("PORT",         "3255")
        .env("NODE_ENV",     "production")
        .env("LOG_LEVEL",    "warn")
        .current_dir(&server_dir)
        .spawn();

    match child {
        Ok(c) => { println!("[Tauri] Backend started (PID {})", c.id()); Some(c) }
        Err(e) => { eprintln!("[Tauri] Failed to start backend: {}", e); None }
    }
}

/// Wait up to `max_ms` milliseconds for the Express API to respond.
fn wait_for_server(max_ms: u64) {
    let url = "http://localhost:3255/api/auth/ping";
    let step = Duration::from_millis(300);
    let mut elapsed = 0u64;

    while elapsed < max_ms {
        if std::net::TcpStream::connect("127.0.0.1:3255").is_ok() {
            println!("[Tauri] Backend is ready ({}ms)", elapsed);
            return;
        }
        std::thread::sleep(step);
        elapsed += step.as_millis() as u64;
    }
    // Proceed anyway — the Angular app will show its own loading state
    eprintln!("[Tauri] Backend did not respond within {}ms — opening UI anyway", max_ms);
    let _ = url; // silence unused warning
}

// ── Tauri commands ────────────────────────────────────────────────────────────
#[tauri::command]
fn get_target_url(_app_handle: tauri::AppHandle) -> String {
    // Always local — desktop-only mode
    "http://localhost:3255".to_string()
}

#[tauri::command]
fn reload_site(app_handle: tauri::AppHandle) {
    if let Some(win) = app_handle.get_webview_window("main") {
        let target = get_target_url(app_handle.clone());
        let _ = win.eval(&format!("window.location.replace('{}')", js_escape(&target)));
    }
}

#[tauri::command]
fn print_text_direct(_app_handle: tauri::AppHandle, text: String) -> Result<(), String> {
    send_raw_to_printer(Some("POS-80C"), text.as_bytes())
}

#[tauri::command]
fn print_html(_app_handle: tauri::AppHandle, html: String) -> Result<(), String> {
    let text = html_to_text(&html);
    send_raw_to_printer(Some("POS-80C"), text.as_bytes())
}

#[tauri::command]
fn print_pdf(_app_handle: tauri::AppHandle, _pdfBase64: String) -> Result<(), String> {
    Err("PDF printing: use print_text_direct instead".into())
}

#[tauri::command]
fn print_raw_bytes(
    _app_handle: tauri::AppHandle,
    data_base64: String,
    printer_name: Option<String>,
) -> Result<(), String> {
    use base64::Engine as _;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64)
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    {
        send_raw_to_printer(printer_name.as_deref(), &bytes)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (bytes, printer_name);
        Err("Raw printing not implemented on this OS".into())
    }
}

#[tauri::command]
fn open_cash_drawer(_app_handle: tauri::AppHandle) -> Result<(), String> {
    let cmd = vec![0x1B, 0x70, 0x00, 0x19, 0xFA];
    send_raw_to_printer(Some("POS-80C"), &cmd)
}

#[tauri::command]
fn get_available_printers() -> Result<Vec<PrinterInfo>, String> {
    Ok(vec![])
}

#[tauri::command]
fn set_default_printer(printer_name: String) -> Result<OperationResult, String> {
    Ok(OperationResult {
        success: false,
        message: format!("Not implemented: {}", printer_name),
    })
}

#[tauri::command]
fn check_tauri_status() -> Result<String, String> {
    Ok(format!(
        "Tauri Status: ACTIVE\nTimestamp: {}\n",
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    ))
}

// ── Printer helpers ───────────────────────────────────────────────────────────
#[derive(serde::Serialize)]
struct PrinterInfo {
    name: String,
    is_default: bool,
}

#[derive(serde::Serialize)]
struct OperationResult {
    success: bool,
    message: String,
}

#[cfg(target_os = "windows")]
fn send_raw_to_printer(printer_name: Option<&str>, data: &[u8]) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::iter::once;
    use std::mem::zeroed;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr::null_mut;
    use winapi::shared::minwindef::DWORD;
    use winapi::shared::ntdef::LPWSTR;
    use winapi::um::winspool::{
        ClosePrinter, DOC_INFO_1W, EndDocPrinter, EndPagePrinter, OpenPrinterW, StartDocPrinterW,
        StartPagePrinter, WritePrinter,
    };

    unsafe {
        let mut h_printer = null_mut();
        let to_wide =
            |s: &str| OsStr::new(s).encode_wide().chain(once(0)).collect::<Vec<u16>>();

        let printer = printer_name.unwrap_or("POS-80C");
        let mut wide_printer = to_wide(printer);
        let open_ok = OpenPrinterW(
            wide_printer.as_mut_ptr() as LPWSTR,
            &mut h_printer,
            null_mut(),
        );
        if open_ok == 0 {
            let err = std::io::Error::last_os_error();
            return Err(format!("OpenPrinterW failed for '{}': {}", printer, err));
        }

        let mut doc_name = to_wide("PoS Print");
        let mut raw = to_wide("RAW");
        let mut di: DOC_INFO_1W = zeroed();
        di.pDocName = doc_name.as_mut_ptr();
        di.pOutputFile = null_mut();
        di.pDatatype = raw.as_mut_ptr();

        if StartDocPrinterW(h_printer, 1, &mut di as *mut _ as _) == 0 {
            ClosePrinter(h_printer);
            return Err("StartDocPrinterW failed".into());
        }
        if StartPagePrinter(h_printer) == 0 {
            EndDocPrinter(h_printer);
            ClosePrinter(h_printer);
            return Err("StartPagePrinter failed".into());
        }

        let mut written: DWORD = 0;
        let write_ok = WritePrinter(
            h_printer,
            data.as_ptr() as _,
            data.len() as DWORD,
            &mut written,
        );

        EndPagePrinter(h_printer);
        EndDocPrinter(h_printer);
        ClosePrinter(h_printer);

        if write_ok == 0 {
            return Err(format!(
                "WritePrinter failed: {}",
                std::io::Error::last_os_error()
            ));
        }
        if written != data.len() as DWORD {
            return Err(format!(
                "WritePrinter incomplete: wrote {}/{} bytes",
                written,
                data.len()
            ));
        }
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn send_raw_to_printer(_name: Option<&str>, _data: &[u8]) -> Result<(), String> {
    Err("Printing only supported on Windows".into())
}

fn js_escape(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('`', "\\`")
        .replace('\'', "\\'")
        .replace("</", "<\u{002F}")
}

fn html_to_text(html: &str) -> String {
    let mut t = html.to_string();
    t = regex::Regex::new(r"<style[^>]*>.*?</style>")
        .unwrap()
        .replace_all(&t, "")
        .to_string();
    t = regex::Regex::new(r"<script[^>]*>.*?</script>")
        .unwrap()
        .replace_all(&t, "")
        .to_string();
    t = regex::Regex::new(r"<[^>]*>")
        .unwrap()
        .replace_all(&t, "")
        .to_string();
    t = t
        .replace("&amp;",  "&")
        .replace("&lt;",   "<")
        .replace("&gt;",   ">")
        .replace("&quot;", "\"")
        .replace("&#39;",  "'")
        .replace("&nbsp;", " ");
    t = regex::Regex::new(r"\s+")
        .unwrap()
        .replace_all(&t, " ")
        .to_string();
    t.trim().to_string()
}

// ── main ──────────────────────────────────────────────────────────────────────
fn main() {
    tauri::Builder::default()
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app: &mut App| {
            // 1. Start the embedded Express server
            let child = start_backend_server(&app.app_handle());
            if let Some(c) = child {
                *app.state::<ServerProcess>().0.lock().unwrap() = Some(c);
            }

            // 2. Wait up to 20 s for the server to be ready
            wait_for_server(20_000);

            // 3. Always use local embedded server — 100% desktop/local mode
            let webview_url = WebviewUrl::App("index.html".into());

            let win = tauri::WebviewWindowBuilder::new(app, "main", webview_url)
                .title("PoS Number One")
                .inner_size(1366.0, 768.0)
                .resizable(true)
                .visible(true)
                .build()?;

            // Auto-retry: if the backend wasn't ready yet when the window opened,
            // inject a JS poller that reloads the page once localhost:3255 responds.
            let _ = win.eval(r#"
                (function() {
                    var maxTries = 40;
                    var tries = 0;
                    function tryLoad() {
                        tries++;
                        fetch('http://localhost:3255/api/auth/ping', { cache: 'no-store' })
                            .then(function(r) {
                                if (r.ok || r.status < 500) {
                                    window.location.replace('http://localhost:3255');
                                } else if (tries < maxTries) {
                                    setTimeout(tryLoad, 500);
                                }
                            })
                            .catch(function() {
                                if (tries < maxTries) { setTimeout(tryLoad, 500); }
                            });
                    }
                    // Only start polling if current page is the error page
                    if (document.title.indexOf('reach') !== -1 ||
                        document.body.innerText.indexOf('refused') !== -1 ||
                        document.body.innerText.indexOf('ERR_CONNECTION') !== -1) {
                        setTimeout(tryLoad, 800);
                    }
                })();
            "#);

            Ok(())
        })
        .on_window_event(|window, event| {
            use tauri::WindowEvent;
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();

                // Gracefully kill the embedded server before exiting
                if let Some(state) = window.app_handle().try_state::<ServerProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                            println!("[Tauri] Backend server stopped.");
                        }
                    }
                }

                window.app_handle().exit(0);
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_target_url,
            reload_site,
            print_text_direct,
            print_html,
            print_pdf,
            print_raw_bytes,
            open_cash_drawer,
            get_available_printers,
            set_default_printer,
            check_tauri_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
