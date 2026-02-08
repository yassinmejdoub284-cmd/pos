#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
 
use std::{fs, path::{Path, PathBuf}};

use serde::Deserialize;
use tauri::{App, Manager, WebviewUrl};

#[derive(Deserialize, Debug)]
struct AppConfig {
  #[serde(rename = "TARGET_URL")] 
  target_url: String,
}

fn try_read_config(path: &Path) -> Option<AppConfig> {
  fs::read_to_string(path).ok().and_then(|raw| serde_json::from_str::<AppConfig>(&raw).ok())
}

fn read_app_config(app_handle: &tauri::AppHandle) -> AppConfig {
  let exe_dir = app_handle.path().executable_dir().ok();
  let current_dir = std::env::current_dir().ok();

  let candidates: Vec<PathBuf> = vec![
    exe_dir.as_ref().map(|p| p.join("app-config.json")),
    current_dir.as_ref().map(|p| p.join("app-config.json")),
    current_dir.as_ref().and_then(|p| p.parent().map(|pp| pp.join("app-config.json"))),
  ].into_iter().flatten().collect();

  for candidate in candidates {
    if let Some(cfg) = try_read_config(&candidate) {
      return cfg;
    }
  }

  AppConfig{ target_url: "https://patisserie.solumove.net".into() }
}

#[tauri::command]
fn get_target_url(app_handle: tauri::AppHandle) -> String {
  let cfg = read_app_config(&app_handle);
  cfg.target_url
}

#[tauri::command]
fn reload_site(app_handle: tauri::AppHandle) {
  if let Some(win) = app_handle.get_webview_window("main") {
    let target = get_target_url(app_handle);
    let _ = win.eval(&format!("window.location.replace('{}')", js_escape(&target)));
  }
}

#[tauri::command]
fn print_text_direct(_app_handle: tauri::AppHandle, text: String) -> Result<(), String> {
  println!("=== PRINT ORDER RECEIVED ===");
  println!("Timestamp: {}", chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"));
  println!("Text length: {} characters", text.len());
  println!("First 100 chars: {}", &text.chars().take(100).collect::<String>());
  println!("=============================");
  
  // Use the exact same logic as the test print - direct raw printing
  send_raw_to_printer(Some("POS-80C"), text.as_bytes())
}

#[tauri::command]
fn print_html(_app_handle: tauri::AppHandle, html: String) -> Result<(), String> {
  println!("=== HTML PRINT ORDER RECEIVED ===");
  println!("Timestamp: {}", chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"));
  println!("HTML length: {} characters", html.len());
  println!("================================");
  
  // Convert HTML to plain text and use the same raw printing logic
  let text = html_to_text(&html);
  send_raw_to_printer(Some("POS-80C"), text.as_bytes())
}

#[tauri::command]
fn print_pdf(_app_handle: tauri::AppHandle, pdfBase64: String) -> Result<(), String> {
  use base64::Engine as _;
  
  // Decode base64 PDF data
  let pdf_bytes = base64::engine::general_purpose::STANDARD
    .decode(pdfBase64)
    .map_err(|e| format!("Failed to decode PDF: {}", e))?;
  
  // For thermal printers, we need to convert PDF to plain text
  // Since we can't easily parse PDF in Rust, let's use a simpler approach
  // We'll modify the frontend to send plain text instead of PDF
  
  // For now, let's just send a placeholder message
  let text = "PDF printing not yet implemented for thermal printer.\nPlease use print_text_direct instead.";
  send_raw_to_printer(Some("POS-80C"), text.as_bytes())
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
  use winapi::um::winspool::{OpenPrinterW, ClosePrinter, StartDocPrinterW, StartPagePrinter, EndPagePrinter, EndDocPrinter, WritePrinter, DOC_INFO_1W};

  unsafe {
    let mut h_printer = null_mut();
    let to_wide = |s: &str| OsStr::new(s).encode_wide().chain(once(0)).collect::<Vec<u16>>();

    let printer = printer_name.unwrap_or("POS-80C");
    println!("Attempting to open printer: {}", printer);
    
    let mut wide_printer = to_wide(printer);
    let open_ok = OpenPrinterW(wide_printer.as_mut_ptr() as LPWSTR, &mut h_printer, null_mut());
    
    if open_ok == 0 {
      let error = std::io::Error::last_os_error();
      return Err(format!("OpenPrinterW failed for '{}': {}", printer, error));
    }

    let mut doc_name = to_wide("Tauri Test Print");
    let mut raw = to_wide("RAW");
    let mut di: DOC_INFO_1W = zeroed();
    di.pDocName = doc_name.as_mut_ptr();
    di.pOutputFile = null_mut();
    di.pDatatype = raw.as_mut_ptr();

    println!("Starting document...");
    if StartDocPrinterW(h_printer, 1, &mut di as *mut _ as _) == 0 {
      ClosePrinter(h_printer);
      return Err("StartDocPrinterW failed".into());
    }
    
    println!("Starting page...");
    if StartPagePrinter(h_printer) == 0 {
      EndDocPrinter(h_printer);
      ClosePrinter(h_printer);
      return Err("StartPagePrinter failed".into());
    }

    println!("Writing {} bytes to printer...", data.len());
    let mut written: DWORD = 0;
    let write_ok = WritePrinter(h_printer, data.as_ptr() as _, data.len() as DWORD, &mut written);

    EndPagePrinter(h_printer);
    EndDocPrinter(h_printer);
    ClosePrinter(h_printer);

    if write_ok == 0 {
      let error = std::io::Error::last_os_error();
      return Err(format!("WritePrinter failed: {}", error));
    }
    
    if written != data.len() as DWORD {
      return Err(format!("WritePrinter incomplete: wrote {}/{} bytes", written, data.len()));
    }
    
    println!("Successfully wrote {} bytes to printer", written);
  }

  Ok(())
}

#[tauri::command]
fn print_raw_bytes(_app_handle: tauri::AppHandle, data_base64: String, printer_name: Option<String>) -> Result<(), String> {
  println!("=== RAW BYTES PRINT ORDER RECEIVED ===");
  println!("Timestamp: {}", chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"));
  println!("Base64 data length: {} characters", data_base64.len());
  println!("Printer: {:?}", printer_name);
  println!("=====================================");
  
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
    Err("Raw printing not implemented on this OS".into())
  }
}

#[tauri::command]
fn open_cash_drawer(_app_handle: tauri::AppHandle) -> Result<(), String> {
  let cash_drawer_command = vec![0x1B, 0x70, 0x00, 0x19, 0xFA];
  send_raw_to_printer(Some("POS-80C"), &cash_drawer_command)
}

#[tauri::command]
fn get_available_printers() -> Result<Vec<PrinterInfo>, String> {
  Ok(vec![])
}

#[tauri::command]
fn set_default_printer(printer_name: String) -> Result<OperationResult, String> {
  Ok(OperationResult { success: false, message: format!("Not implemented: {}", printer_name) })
}

#[tauri::command]
fn check_tauri_status() -> Result<String, String> {
  let status = format!(
    "Tauri Status: ACTIVE\nTimestamp: {}\nAvailable commands: print_text_direct, print_html, print_raw_bytes\n",
    chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
  );
  println!("=== TAURI STATUS CHECK ===");
  println!("{}", status);
  println!("=========================");
  Ok(status)
}

#[derive(serde::Serialize)]
struct PrinterInfo { name: String, is_default: bool }

#[derive(serde::Serialize)]
struct OperationResult { success: bool, message: String }


fn js_escape(input: &str) -> String {
  input
    .replace('\\', "\\\\")
    .replace('`', "\\`")
    .replace('\'', "\\'")
    .replace("</", "<\u{002F}")
}



fn html_to_text(html: &str) -> String {
  let mut text = html.to_string();
  
  // Remove style and script tags completely
  text = regex::Regex::new(r"<style[^>]*>.*?</style>").unwrap().replace_all(&text, "").to_string();
  text = regex::Regex::new(r"<script[^>]*>.*?</script>").unwrap().replace_all(&text, "").to_string();
  
  // Remove all HTML tags
  text = regex::Regex::new(r"<[^>]*>").unwrap().replace_all(&text, "").to_string();
  
  // Decode HTML entities
  text = text.replace("&amp;", "&")
             .replace("&lt;", "<")
             .replace("&gt;", ">")
             .replace("&quot;", "\"")
             .replace("&#39;", "'")
             .replace("&nbsp;", " ");
  
  // Clean up whitespace and newlines
  text = regex::Regex::new(r"\s+").unwrap().replace_all(&text, " ").to_string();
  text = regex::Regex::new(r"\n\s*\n").unwrap().replace_all(&text, "\n").to_string();
  
  text.trim().to_string()
}

fn main() {
  tauri::Builder::default()
    .setup(|app: &mut App| {
      let cfg = read_app_config(&app.app_handle());
      let external = tauri::Url::parse(&cfg.target_url).unwrap_or_else(|_| tauri::Url::parse("about:blank").unwrap());
      let _ = tauri::WebviewWindowBuilder::new(app, "main", WebviewUrl::External(external))
        .title("SoluMove PoS")
        .inner_size(1366.0, 768.0)
        .resizable(true)
        .visible(true)
        .build()?;
      
      // App initialization complete - no automatic test print
      
      Ok(())
    })
    .on_window_event(|window, event| {
      use tauri::WindowEvent;
      if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
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
      check_tauri_status
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
