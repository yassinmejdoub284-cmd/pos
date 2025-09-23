// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use base64::Engine; // for .decode on base64 engines
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Printing::{
    EnumPrintersW, GetDefaultPrinterW, OpenPrinterW, ClosePrinter, SetDefaultPrinterW, StartDocPrinterW,
    StartPagePrinter, WritePrinter, EndPagePrinter, EndDocPrinter, DOC_INFO_1W, PRINTER_INFO_2W,
    PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL,
};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::*;
#[cfg(target_os = "windows")]
use windows::core::{PCWSTR, PWSTR};
#[cfg(target_os = "windows")]
use core::ffi::c_void;

#[derive(Serialize, Deserialize)]
struct PrintResult {
    success: bool,
    message: String,
}

impl std::fmt::Display for PrintResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "PrintResult {{ success: {}, message: {} }}", self.success, self.message)
    }
}

#[derive(Serialize, Deserialize)]
struct PrinterInfo {
    name: String,
    is_default: bool,
}

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_available_printers() -> Result<Vec<PrinterInfo>, String> {
    log::info!("Getting available printers via WinSpool");
    #[cfg(target_os = "windows")]
    unsafe {
        let mut needed: u32 = 0;
        let mut returned: u32 = 0;
        // First call to get buffer size
        let _ = EnumPrintersW(
            PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS,
            PCWSTR::null(),
            2,
            None,
            &mut needed,
            &mut returned,
        );

        if needed == 0 {
            return Ok(Vec::new());
        }

        let mut buffer = vec![0u8; needed as usize];
        let res = EnumPrintersW(
            PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS,
            PCWSTR::null(),
            2,
            Some(buffer.as_mut_slice()),
            &mut needed,
            &mut returned,
        );

        if res.is_err() {
            return Err("EnumPrintersW failed".to_string());
        }

        // Get default printer name
        let default_name = get_default_printer_name_win().unwrap_or_default();

        let mut printers: Vec<PrinterInfo> = Vec::new();
        let ptr = buffer.as_ptr() as *const PRINTER_INFO_2W;
        let slice = std::slice::from_raw_parts(ptr, returned as usize);
        for info in slice.iter() {
            let name = utf16_ptr_to_string(info.pPrinterName);
            if !name.is_empty() {
                let is_default = name == default_name;
                printers.push(PrinterInfo { name, is_default });
            }
        }
        Ok(printers)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Printer detection not implemented for this platform".to_string())
    }
}

#[cfg(target_os = "windows")]
fn str_to_wide_null(s: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
}

#[cfg(target_os = "windows")]
fn utf16_ptr_to_string(ptr: PWSTR) -> String {
    if ptr.is_null() {
        return String::new();
    }
    unsafe {
        let mut len = 0usize;
        let p = ptr.0;
        while *p.add(len) != 0 { len += 1; }
        String::from_utf16_lossy(std::slice::from_raw_parts(p, len))
    }
}

#[cfg(target_os = "windows")]
fn get_default_printer_name_win() -> Option<String> {
    unsafe {
        let mut needed: u32 = 0;
        let _ = GetDefaultPrinterW(PWSTR::null(), &mut needed);
        if needed == 0 { return None; }
        let mut buf: Vec<u16> = vec![0u16; needed as usize];
        let ok = GetDefaultPrinterW(PWSTR(buf.as_mut_ptr()), &mut needed).as_bool();
        if ok {
            let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
            Some(String::from_utf16_lossy(&buf[..len]))
        } else { None }
    }
}

#[tauri::command]
async fn set_default_printer(printer_name: String) -> Result<PrintResult, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        let wide = str_to_wide_null(&printer_name);
        let ok = SetDefaultPrinterW(PCWSTR(wide.as_ptr())).as_bool();
        if ok {
            return Ok(PrintResult { success: true, message: format!("Default printer set to {}", printer_name) });
        }
        return Err("SetDefaultPrinter failed".to_string());
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Setting default printer not implemented for this platform".to_string())
    }
}

#[tauri::command]
async fn print_raw_bytes(data_base64: String, printer_name: Option<String>) -> Result<PrintResult, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64)
        .map_err(|e| format!("base64 decode failed: {}", e))?;
    send_raw_to_printer(bytes, printer_name).await
}

#[tauri::command]
async fn print_text_direct(text: String, printer_name: Option<String>) -> Result<PrintResult, String> {
    // No transformations: send as UTF-8 bytes exactly as provided
    send_raw_to_printer(text.into_bytes(), printer_name).await
}

#[tauri::command]
async fn print_pdf_raw(pdf_base64: String, printer_name: Option<String>) -> Result<PrintResult, String> {
    // Exact raw send; relies on printer supporting PDF passthrough
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(pdf_base64)
        .map_err(|e| format!("base64 decode failed: {}", e))?;
    send_raw_to_printer(bytes, printer_name).await
}

async fn send_raw_to_printer(data: Vec<u8>, printer_name: Option<String>) -> Result<PrintResult, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        let target = match printer_name {
            Some(n) if !n.trim().is_empty() => n,
            _ => get_default_printer_name_win().ok_or_else(|| "No default printer configured".to_string())?,
        };

        let mut hprinter: HANDLE = HANDLE::default();
        let wide_name = str_to_wide_null(&target);
        let open_res = OpenPrinterW(PCWSTR(wide_name.as_ptr()), &mut hprinter, None);
        if open_res.is_err() || hprinter.is_invalid() {
            return Err(format!("OpenPrinterW failed for {}", target));
        }

        let doc_name = str_to_wide_null("POS Raw Job");
        let data_type = str_to_wide_null("RAW");
        let di = DOC_INFO_1W {
            pDocName: PWSTR(doc_name.as_ptr() as *mut u16),
            pOutputFile: PWSTR::null(),
            pDatatype: PWSTR(data_type.as_ptr() as *mut u16),
        };

        let started = StartDocPrinterW(hprinter, 1, &di as *const DOC_INFO_1W);
        if started == 0 { let _ = ClosePrinter(hprinter); return Err("StartDocPrinterW failed".to_string()); }
        let page_ok = StartPagePrinter(hprinter).as_bool();
        if !page_ok { let _ = EndDocPrinter(hprinter); let _ = ClosePrinter(hprinter); return Err("StartPagePrinter failed".to_string()); }

        let mut written: u32 = 0;
        let write_ok = WritePrinter(
            hprinter,
            data.as_ptr() as *const c_void,
            data.len() as u32,
            &mut written as *mut u32,
        ).as_bool();

        let _ = EndPagePrinter(hprinter);
        let _ = EndDocPrinter(hprinter);
        let _ = ClosePrinter(hprinter);

        if !write_ok || written != data.len() as u32 {
            return Err(format!("WritePrinter failed (written {} of {})", written, data.len()));
        }
        Ok(PrintResult { success: true, message: format!("Sent {} bytes to {}", written, target) })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Raw printing not implemented for this platform".to_string())
    }
}


// Create a properly formatted receipt for 72mm thermal printer
/*fn create_test_receipt() -> String {
    // Optimized for 72mm thermal printer (32 characters max width)
    
    format!(r#"========================
      REÇU DE VENTE
========================

    HENTETI GROUP
123 Avenue Habib Bourguiba
     Tunis 1000
   +216 71 123 456

Date: 20/01/2025 14:30:00

------------------------
Produit      Qté Prix Total
------------------------
Test Produit   1 10.000 10.000
Test Service   1  2.500  2.500

------------------------
SOUS-TOTAL:        12.500
REMISE:             0.000
NET À PAYER:       12.500

MODE DE PAIEMENT: ESPÈCES

------------------------
   Merci de votre visite!
------------------------

"#,
        esc_pos_init,
        esc_pos_center,
        esc_pos_bold,
        esc_pos_double_height,
        esc_pos_normal,
        esc_pos_bold_off,
        esc_pos_center,
        esc_pos_bold,
        esc_pos_bold_off,
        esc_pos_left,
        esc_pos_bold,
        "20/01/2025",
        "14:30:00",
        esc_pos_bold_off,
        esc_pos_left,
        esc_pos_bold,
        esc_pos_bold_off,
        esc_pos_bold,
        esc_pos_bold_off,
        esc_pos_bold,
        esc_pos_bold_off,
        esc_pos_bold,
        esc_pos_bold_off,
        esc_pos_bold,
        esc_pos_bold_off,
        esc_pos_bold,
        esc_pos_bold_off,
        esc_pos_center,
        esc_pos_bold,
        esc_pos_bold_off,
        esc_pos_center,
        esc_pos_bold,
        esc_pos_bold_off,
        esc_pos_cut
    )
}*/


#[tauri::command]
async fn print_receipt(html_content: String, printer_name: String) -> Result<PrintResult, String> {
    log::info!("Print command received for printer: {}", printer_name);
    log::info!("HTML content length: {} characters", html_content.len());
    
    // Step 1: Try to render HTML to PDF
    match render_html_to_pdf(&html_content).await {
        Ok(pdf_data) => {
            // Step 2: Print PDF silently to specified printer
            print_pdf_silently(pdf_data, printer_name).await
        },
        Err(e) => {
            log::warn!("PDF rendering failed: {}, falling back to ESC/POS printing", e);
            // Fallback: Convert HTML to ESC/POS and print directly
            let escpos_data = convert_html_to_escpos(&html_content);
            print_escpos_direct(escpos_data, printer_name).await
        }
    }
}

// Render HTML content to PDF using headless browser
async fn render_html_to_pdf(html_content: &str) -> Result<Vec<u8>, String> {
    let temp_dir = std::env::temp_dir();
    let html_file = temp_dir.join("receipt_to_render.html");
    let pdf_file = temp_dir.join("receipt_rendered.pdf");
    
    // Write HTML content to temporary file
    if let Err(e) = std::fs::write(&html_file, html_content) {
        return Err(format!("Failed to create temporary HTML file: {}", e));
    }
    
    let html_file_str = html_file.to_string_lossy().to_string();
    log::info!("Created temporary HTML file: {}", html_file_str);
    
    // Try different PDF rendering methods in order of preference
    let pdf_data = if let Ok(data) = render_with_chrome(&html_file, &pdf_file).await {
        data
    } else if let Ok(data) = render_with_wkhtmltopdf(&html_file, &pdf_file).await {
        data
    } else if let Ok(data) = render_with_puppeteer(&html_file, &pdf_file).await {
        data
    } else {
        // Fallback: Create a simple text-based PDF using basic HTML to text conversion
        log::warn!("No PDF rendering method available, using fallback text conversion");
        return render_html_to_simple_pdf(html_content);
    };
    
    // Clean up temporary files
    let _ = std::fs::remove_file(&html_file);
    let _ = std::fs::remove_file(&pdf_file);
    
    Ok(pdf_data)
}

// Method 1: Chrome/Chromium headless (most reliable)
async fn render_with_chrome(html_file: &std::path::Path, pdf_file: &std::path::Path) -> Result<Vec<u8>, String> {
    use std::process::Command;
    
    let chrome_paths = if cfg!(target_os = "windows") {
        vec![
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            r"C:\Users\{}\AppData\Local\Google\Chrome\Application\chrome.exe",
        ]
    } else if cfg!(target_os = "macos") {
        vec![
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
    } else {
        vec![
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
            "/snap/bin/chromium",
        ]
    };
    
    let mut chrome_path = None;
    for path in chrome_paths {
        if cfg!(target_os = "windows") && path.contains("{}") {
            // Replace {} with actual username
            if let Ok(user) = std::env::var("USERNAME") {
                let full_path = path.replace("{}", &user);
                if std::path::Path::new(&full_path).exists() {
                    chrome_path = Some(full_path);
                    break;
                }
            }
        } else if std::path::Path::new(path).exists() {
            chrome_path = Some(path.to_string());
            break;
        }
    }
    
    let chrome_path = chrome_path.ok_or("Chrome/Chromium not found")?;
    
    let pdf_arg = format!("--pdf={}", pdf_file.to_string_lossy());
    let file_arg = format!("file://{}", html_file.to_string_lossy());
    
    let args = vec![
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-plugins",
        "--disable-images",
        "--disable-javascript",
        "--print-to-pdf",
        "--print-to-pdf-no-header",
        "--virtual-time-budget=5000",
        "--run-all-compositor-stages-before-draw",
        &pdf_arg,
        &file_arg,
    ];
    
    log::info!("Trying Chrome headless: {} with args: {:?}", chrome_path, args);
    
    let result = Command::new(&chrome_path)
        .args(&args)
        .output();
    
    match result {
        Ok(output) => {
            if output.status.success() && pdf_file.exists() {
                let pdf_data = std::fs::read(pdf_file).map_err(|e| format!("Failed to read PDF file: {}", e))?;
                log::info!("Successfully rendered PDF with Chrome, size: {} bytes", pdf_data.len());
                Ok(pdf_data)
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("Chrome rendering failed: {}", stderr))
            }
        }
        Err(e) => Err(format!("Failed to execute Chrome: {}", e))
    }
}

// Method 2: wkhtmltopdf (lightweight alternative)
async fn render_with_wkhtmltopdf(html_file: &std::path::Path, pdf_file: &std::path::Path) -> Result<Vec<u8>, String> {
    use std::process::Command;
    
    let wkhtmltopdf_path = if cfg!(target_os = "windows") {
        "wkhtmltopdf.exe"
    } else {
        "wkhtmltopdf"
    };
    
    let args = [
        "--page-size", "A4",
        "--margin-top", "0.75in",
        "--margin-right", "0.75in",
        "--margin-bottom", "0.75in",
        "--margin-left", "0.75in",
        "--encoding", "UTF-8",
        "--disable-smart-shrinking",
        "--print-media-type",
    ];
    
    log::info!("Trying wkhtmltopdf with args (paths elided)");
    
    let result = Command::new(wkhtmltopdf_path)
        .args(&args)
        .arg(html_file)
        .arg(pdf_file)
        .output();
    
    match result {
        Ok(output) => {
            if output.status.success() && pdf_file.exists() {
                let pdf_data = std::fs::read(pdf_file).map_err(|e| format!("Failed to read PDF file: {}", e))?;
                log::info!("Successfully rendered PDF with wkhtmltopdf, size: {} bytes", pdf_data.len());
                Ok(pdf_data)
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("wkhtmltopdf rendering failed: {}", stderr))
            }
        }
        Err(e) => Err(format!("Failed to execute wkhtmltopdf: {}", e))
    }
}

// Method 3: Puppeteer via Node.js (fallback)
async fn render_with_puppeteer(html_file: &std::path::Path, pdf_file: &std::path::Path) -> Result<Vec<u8>, String> {
    use std::process::Command;
    
    let script_content = format!(r#"
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {{
    try {{
        const browser = await puppeteer.launch({{
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }});
        
        const page = await browser.newPage();
        await page.goto('file://{}', {{ waitUntil: 'networkidle0' }});
        
        const pdf = await page.pdf({{
            format: 'A4',
            margin: {{
                top: '0.75in',
                right: '0.75in',
                bottom: '0.75in',
                left: '0.75in'
            }},
            printBackground: true
        }});
        
        await browser.close();
        
        fs.writeFileSync('{}', pdf);
        console.log('PDF generated successfully');
    }} catch (error) {{
        console.error('Error:', error.message);
        process.exit(1);
    }}
}})();
"#, html_file.to_str().unwrap(), pdf_file.to_str().unwrap());
    
    let script_file = std::env::temp_dir().join("puppeteer_render.js");
    if let Err(e) = std::fs::write(&script_file, script_content) {
        return Err(format!("Failed to create Puppeteer script: {}", e));
    }
    
    let result = Command::new("node")
        .arg(script_file.to_string_lossy().to_string())
        .output();
    
    // Clean up script file
    let _ = std::fs::remove_file(&script_file);
    
    match result {
        Ok(output) => {
            if output.status.success() && pdf_file.exists() {
                let pdf_data = std::fs::read(pdf_file).map_err(|e| format!("Failed to read PDF file: {}", e))?;
                log::info!("Successfully rendered PDF with Puppeteer, size: {} bytes", pdf_data.len());
                Ok(pdf_data)
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("Puppeteer rendering failed: {}", stderr))
            }
        }
        Err(e) => Err(format!("Failed to execute Node.js/Puppeteer: {}", e))
    }
}

// Fallback: Create a simple text-based PDF from HTML content
fn render_html_to_simple_pdf(html_content: &str) -> Result<Vec<u8>, String> {
    // Extract text content from HTML (basic implementation)
    let text_content = extract_text_from_html(html_content);
    
    // Create a minimal PDF structure
    let pdf_content = create_simple_pdf(&text_content);
    
    Ok(pdf_content.into_bytes())
}

// Extract text content from HTML (optimized for thermal printing)
fn extract_text_from_html(html: &str) -> String {
    // Remove HTML tags and decode entities
    let mut text = html.to_string();
    
    // Remove script and style elements
    text = regex::Regex::new(r"<script[^>]*>.*?</script>").unwrap().replace_all(&text, "").to_string();
    text = regex::Regex::new(r"<style[^>]*>.*?</style>").unwrap().replace_all(&text, "").to_string();
    
    // Convert specific HTML elements to thermal printer format
    text = text.replace("<div class=\"center\">", "").replace("<div class=\"center bold\">", "");
    text = text.replace("<div class=\"header\">", "").replace("<div class=\"header bold\">", "");
    text = text.replace("<div class=\"bold\">", "");
    text = text.replace("<div class=\"info-line\">", "");
    
    // Convert table rows to lines
    text = regex::Regex::new(r"<tr[^>]*>").unwrap().replace_all(&text, "").to_string();
    text = regex::Regex::new(r"</tr>").unwrap().replace_all(&text, "\n").to_string();
    text = regex::Regex::new(r"<td[^>]*>").unwrap().replace_all(&text, "").to_string();
    text = regex::Regex::new(r"</td>").unwrap().replace_all(&text, " ").to_string();
    
    // Remove HTML tags
    text = regex::Regex::new(r"<[^>]+>").unwrap().replace_all(&text, "").to_string();
    
    // Decode HTML entities
    text = text.replace("&amp;", "&")
               .replace("&lt;", "<")
               .replace("&gt;", ">")
               .replace("&quot;", "\"")
               .replace("&#39;", "'")
               .replace("&nbsp;", " ");
    
    // Clean up whitespace and format for thermal printer
    text = regex::Regex::new(r"\s+").unwrap().replace_all(&text, " ").to_string();
    text = regex::Regex::new(r"\n\s*\n").unwrap().replace_all(&text, "\n").to_string();
    
    // Format specific sections for better thermal printing
    let lines: Vec<&str> = text.split('\n').collect();
    let mut formatted_lines = Vec::new();
    
    for line in lines {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            // Add separators for important sections
            if trimmed.contains("REÇU DE VENTE") || trimmed.contains("RAPPORT") {
                formatted_lines.push("================================");
                formatted_lines.push(trimmed);
                formatted_lines.push("================================");
            } else if trimmed.contains("TOTAL A PAYER") || trimmed.contains("TOTAL") {
                formatted_lines.push("--------------------------------");
                formatted_lines.push(trimmed);
                formatted_lines.push("--------------------------------");
            } else {
                formatted_lines.push(trimmed);
            }
        }
    }
    
    formatted_lines.join("\n")
}

// Create a simple PDF structure (minimal implementation)
fn create_simple_pdf(text: &str) -> String {
    // This is a very basic PDF structure - in production, you'd want to use a proper PDF library
    format!(r#"%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length {}
>>
stream
BT
/F1 12 Tf
72 720 Td
({}) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000380 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
{}
%%EOF"#, 
        text.len() + 50, // Length of content stream
        text.replace("(", "\\(").replace(")", "\\)"), // Escape parentheses
        text.len() + 450 // Startxref position
    )
}

// Print PDF using SumatraPDF (best for silent printing)
#[cfg(target_os = "windows")]
async fn print_with_sumatra(pdf_file: &std::path::Path, printer_name: &str) -> Result<PrintResult, String> {
    use std::process::Command;
    
    // Try common SumatraPDF locations
    let sumatra_paths = vec![
        "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
        "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe",
        "sumatrapdf.exe", // If in PATH
    ];
    
    for sumatra_path in sumatra_paths {
        let result = Command::new(sumatra_path)
            .args(&["-print-to", printer_name, "-silent", &pdf_file.to_string_lossy()])
            .output();
        
        match result {
            Ok(output) => {
                if output.status.success() {
                    log::info!("Successfully printed PDF using SumatraPDF to {}", printer_name);
                    return Ok(PrintResult {
                        success: true,
                        message: format!("PDF printed successfully to {} using SumatraPDF", printer_name),
                    });
                }
            }
            Err(_) => continue, // Try next path
        }
    }
    
    Err("SumatraPDF not found or failed".to_string())
}

// Print PDF using Adobe Reader
#[cfg(target_os = "windows")]
async fn print_with_adobe_reader(pdf_file: &std::path::Path, printer_name: &str) -> Result<PrintResult, String> {
    use std::process::Command;
    
    // Try common Adobe Reader locations
    let adobe_paths = vec![
        "C:\\Program Files\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe",
        "C:\\Program Files (x86)\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe",
        "C:\\Program Files\\Adobe\\Reader 11.0\\Reader\\AcroRd32.exe",
        "C:\\Program Files (x86)\\Adobe\\Reader 11.0\\Reader\\AcroRd32.exe",
    ];
    
    for adobe_path in adobe_paths {
        let result = Command::new(adobe_path)
            .args(&["/t", &pdf_file.to_string_lossy(), printer_name])
            .output();
        
        match result {
            Ok(output) => {
                if output.status.success() {
                    log::info!("Successfully printed PDF using Adobe Reader to {}", printer_name);
                    return Ok(PrintResult {
                        success: true,
                        message: format!("PDF printed successfully to {} using Adobe Reader", printer_name),
                    });
                }
            }
            Err(_) => continue, // Try next path
        }
    }
    
    Err("Adobe Reader not found or failed".to_string())
}

// Print PDF using Windows print command
#[cfg(target_os = "windows")]
async fn print_with_windows_print(pdf_file: &std::path::Path, printer_name: &str) -> Result<PrintResult, String> {
    use std::process::Command;
    
    // First, verify the printer exists and is accessible
    if !verify_printer_exists(printer_name).await {
        return Err(format!("Printer {} not found or not accessible", printer_name));
    }
    
    // Use Windows print command with better error handling
    let result = Command::new("cmd")
        .args(&["/C", "print", "/D:", &format!("\\\\{}\\", printer_name), &pdf_file.to_string_lossy()])
        .output();
    
    match result {
        Ok(output) => {
            if output.status.success() {
                // Check if the print job was actually queued
                let stdout = String::from_utf8_lossy(&output.stdout);
                log::info!("Windows print command output: {}", stdout);
                
                // Wait a moment and check if the print job is in the queue
                tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
                
                if verify_print_job_queued(printer_name).await {
                    log::info!("Successfully printed PDF using Windows print command to {}", printer_name);
                    return Ok(PrintResult {
                        success: true,
                        message: format!("PDF printed successfully to {} using Windows print", printer_name),
                    });
                } else {
                    log::warn!("Print command succeeded but no print job found in queue");
                    return Err("Print command succeeded but job not queued - printer may not be responding".to_string());
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("Windows print command failed: {}", stderr))
            }
        }
        Err(e) => Err(format!("Failed to execute Windows print command: {}", e))
    }
}

// Verify that a printer exists and is accessible
#[cfg(target_os = "windows")]
async fn verify_printer_exists(printer_name: &str) -> bool {
    use std::process::Command;
    
    // Use wmic to check if printer exists
    let result = Command::new("wmic")
        .args(&["printer", "where", &format!("name='{}'", printer_name), "get", "name"])
        .output();
    
    match result {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                stdout.contains(printer_name)
            } else {
                false
            }
        }
        Err(_) => false
    }
}

// Verify that a print job is in the queue
#[cfg(target_os = "windows")]
async fn verify_print_job_queued(printer_name: &str) -> bool {
    use std::process::Command;
    
    // Use wmic to check print jobs
    let result = Command::new("wmic")
        .args(&["printjob", "where", &format!("printername='{}'", printer_name), "get", "jobid"])
        .output();
    
    match result {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                // If there are any job IDs, the print job was queued
                stdout.contains("JobId") && stdout.lines().count() > 2
            } else {
                false
            }
        }
        Err(_) => false
    }
}

// Convert HTML content to ESC/POS commands
fn convert_html_to_escpos(html_content: &str) -> String {
    // Extract text content from HTML
    let text_content = extract_text_from_html(html_content);
    
    // Convert to ESC/POS format with proper formatting for 80mm thermal printer
    let mut escpos = String::new();
    
    // Initialize printer
    escpos.push_str("\x1B\x40");
    
    // Configure printer for 80mm thermal paper (full width) - More aggressive settings
    escpos.push_str("\x1B\x57\x00\x00\x00\x00\x30\x00"); // Set print area to full width
    escpos.push_str("\x1B\x4C\x00\x00"); // Set left margin to 0
    escpos.push_str("\x1B\x51\x00"); // Set right margin to 0
    
    // Additional commands to force full width
    escpos.push_str("\x1B\x1D\x57\x00\x00\x00\x00\x30\x00"); // Set print area (alternative command)
    escpos.push_str("\x1B\x1D\x4C\x00\x00"); // Set left margin (alternative command)
    escpos.push_str("\x1B\x1D\x51\x00"); // Set right margin (alternative command)
    
    // Set character width for 80mm paper (64 characters per line for full width)
    escpos.push_str("\x1B\x21\x00"); // Normal character size
    escpos.push_str("\x1B\x33\x00"); // Set line spacing to 0
    
    // Configure for thermal printer
    escpos.push_str("\x1B\x4D\x00"); // Select character font A
    escpos.push_str("\x1B\x45\x00"); // Turn off emphasized mode
    escpos.push_str("\x1B\x46\x00"); // Turn off double-strike mode
    
    // Set character size and alignment - Use left align for full width
    escpos.push_str("\x1B\x21\x00"); // Normal size
    escpos.push_str("\x1B\x61\x00"); // Left align (not center)
    
    // Add the text content with proper line breaks
    let lines: Vec<&str> = text_content.split('\n').collect();
    for line in lines {
        let trimmed_line = line.trim();
        if !trimmed_line.is_empty() {
            // Truncate line to fit 80mm width (64 characters for full width)
            let truncated_line = if trimmed_line.len() > 64 {
                &trimmed_line[..64]
            } else {
                trimmed_line
            };
            escpos.push_str(truncated_line);
            escpos.push_str("\x0A"); // Line feed
        }
    }
    
    // Add some spacing
    escpos.push_str("\x0A\x0A"); // Two line feeds
    
    // Cut paper
    escpos.push_str("\x1D\x56\x00");
    
    escpos
}

// Print ESC/POS data directly to printer
async fn print_escpos_direct(escpos_data: String, printer_name: String) -> Result<PrintResult, String> {
    log::info!("Printing ESC/POS data directly to printer: {}", printer_name);
    
    #[cfg(target_os = "windows")]
    {
        // Try multiple methods for ESC/POS printing
        
        // Method 1: Try using copy command with printer share name
        if let Ok(result) = print_escpos_with_copy(&escpos_data, &printer_name).await {
            return Ok(result);
        }
        
        // Method 2: Try using net use and copy
        if let Ok(result) = print_escpos_with_net_use(&escpos_data, &printer_name).await {
            return Ok(result);
        }
        
        // Method 3: Try using Windows API directly (best for USB printers)
        if let Ok(result) = print_with_windows_api(&escpos_data, &printer_name).await {
            return Ok(result);
        }
        
        // Method 4: Try using simple text printing (for thermal printers that don't support ESC/POS)
        if let Ok(result) = print_simple_text(&escpos_data, &printer_name).await {
            return Ok(result);
        }
        
        // Method 4: Try using PowerShell Out-Printer (more reliable for ESC/POS)
        if let Ok(result) = print_escpos_with_powershell_out_printer(&escpos_data, &printer_name).await {
            return Ok(result);
        }
        
        // Method 4: Try using PowerShell with raw data
        if let Ok(result) = print_escpos_with_powershell(&escpos_data, &printer_name).await {
            return Ok(result);
        }
        
        // Method 4: Fallback - try to print to default printer
        log::warn!("All ESC/POS methods failed, trying default printer");
        if let Ok(_result) = print_escpos_with_copy(&escpos_data, "PRN").await {
            return Ok(PrintResult {
                success: true,
                message: format!("Receipt printed to default printer (could not target {} specifically)", printer_name)
            });
        }
        
        Err(format!("Failed to print ESC/POS data to printer: {}", printer_name))
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // For non-Windows systems, we'll use a different approach
        // This could be extended to support Linux/macOS printing
        Err("ESC/POS direct printing not yet implemented for this platform".to_string())
    }
}

// Method 1: Print ESC/POS using copy command with enhanced debugging
#[cfg(target_os = "windows")]
async fn print_escpos_with_copy(escpos_data: &str, printer_name: &str) -> Result<PrintResult, String> {
    use std::process::Command;
    
    let temp_file = std::env::temp_dir().join("receipt_escpos.txt");
    
    // Write ESC/POS data to temporary file
    if let Err(e) = std::fs::write(&temp_file, escpos_data.as_bytes()) {
        return Err(format!("Failed to create temporary ESC/POS file: {}", e));
    }
    
    log::info!("ESC/POS data written to: {}", temp_file.to_string_lossy());
    log::info!("ESC/POS data length: {} bytes", escpos_data.len());
    log::info!("ESC/POS data preview: {:?}", &escpos_data[..std::cmp::min(50, escpos_data.len())]);
    
    // Try different printer name formats (prioritize USB and direct connections)
    let printer_formats = vec![
        format!("{}", printer_name),                 // Direct printer name (best for USB)
        format!("\\\\{}\\", printer_name),           // Network printer format
        format!("USB004"),                          // USB port (from your printer config)
        format!("LPT1:"),                           // Parallel port
        format!("COM1:"),                           // Serial port
        format!("PRN"),                             // Default printer
    ];
    
    for printer_format in printer_formats {
        log::info!("Trying ESC/POS copy to: {}", printer_format);
        
        let result = Command::new("cmd")
            .args(&["/C", "copy", "/B", &temp_file.to_string_lossy(), &printer_format])
            .output();
        
        match result {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                
                log::info!("Copy command output for {}: stdout='{}', stderr='{}', success={}", 
                    printer_format, stdout, stderr, output.status.success());
                
                if output.status.success() {
                    // Additional verification - check if the file was actually copied
                    if stdout.contains("copied") || stdout.contains("1 file(s) copied") {
                        log::info!("ESC/POS data sent successfully to printer: {}", printer_format);
                        // Clean up temporary file
                        let _ = std::fs::remove_file(&temp_file);
                        return Ok(PrintResult {
                            success: true,
                            message: format!("Receipt printed successfully to {}", printer_format)
                        });
                    } else {
                        log::warn!("Copy command succeeded but no copy confirmation for {}", printer_format);
                    }
                } else {
                    log::warn!("Copy command failed for {}: {}", printer_format, stderr);
                }
            }
            Err(e) => {
                log::warn!("Failed to execute copy command for {}: {}", printer_format, e);
            }
        }
    }
    
    // Clean up temporary file
    let _ = std::fs::remove_file(&temp_file);
    Err(format!("All copy command attempts failed for printer: {}", printer_name))
}

// Method 2: Print ESC/POS using net use and copy
#[cfg(target_os = "windows")]
async fn print_escpos_with_net_use(escpos_data: &str, printer_name: &str) -> Result<PrintResult, String> {
    use std::process::Command;
    
    let temp_file = std::env::temp_dir().join("receipt_escpos.txt");
    
    // Write ESC/POS data to temporary file
    if let Err(e) = std::fs::write(&temp_file, escpos_data.as_bytes()) {
        return Err(format!("Failed to create temporary ESC/POS file: {}", e));
    }
    
    // Try to map printer as network drive
    let net_use_result = Command::new("net")
        .args(&["use", "L:", &format!("\\\\{}\\", printer_name)])
        .output();
    
    let copy_result = if net_use_result.is_ok() {
        // If mapping succeeded, copy to mapped drive
        Command::new("cmd")
            .args(&["/C", "copy", "/B", &temp_file.to_string_lossy(), "L:\\"]) 
            .output()
    } else {
        // If mapping failed, try direct copy
        Command::new("cmd")
            .args(&["/C", "copy", "/B", &temp_file.to_string_lossy(), &format!("\\\\{}\\", printer_name)])
            .output()
    };
    
    // Clean up temporary file
    let _ = std::fs::remove_file(&temp_file);
    
    // Try to disconnect the mapped drive
    let _ = Command::new("net")
        .args(&["use", "L:", "/delete"])
        .output();
    
    match copy_result {
        Ok(output) => {
            if output.status.success() {
                log::info!("ESC/POS data sent successfully to printer: {}", printer_name);
                Ok(PrintResult {
                    success: true,
                    message: format!("Receipt printed successfully to {}", printer_name)
                })
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("Net use copy command failed: {}", stderr))
            }
        }
        Err(e) => Err(format!("Failed to execute net use copy command: {}", e))
    }
}

// Method 3: Print using Windows API directly (best for USB printers)
#[cfg(target_os = "windows")]
async fn print_with_windows_api(escpos_data: &str, printer_name: &str) -> Result<PrintResult, String> {
    use std::process::Command;
    
    let temp_file = std::env::temp_dir().join("receipt_windows_api.txt");
    
    // Write ESC/POS data to temporary file
    if let Err(e) = std::fs::write(&temp_file, escpos_data.as_bytes()) {
        return Err(format!("Failed to create temporary file: {}", e));
    }
    
    log::info!("Trying Windows API printing to: {}", printer_name);
    
    // Use Windows API through PowerShell with raw data
    let ps_command = format!(
        r#"
        $printer = "{}"
        $file = "{}"
        try {{
            $content = [System.IO.File]::ReadAllBytes($file)
            $printerJob = New-Object -ComObject WScript.Network
            $printerJob.AddWindowsPrinterConnection($printer)
            $printerJob.SetDefaultPrinter($printer)
            
            # Send raw data to printer
            $printerPort = "USB004"
            $fileStream = [System.IO.File]::OpenWrite($printerPort)
            $fileStream.Write($content, 0, $content.Length)
            $fileStream.Close()
            
            Write-Output "Success"
        }} catch {{
            Write-Error $_.Exception.Message
        }}
        "#,
        printer_name.replace("\\", "\\\\"),
        temp_file.to_string_lossy().replace("\\", "\\\\")
    );
    
    log::info!("Windows API PowerShell command: {}", ps_command);
    
    let result = Command::new("powershell")
        .args(&["-Command", &ps_command])
        .output();
    
    // Clean up temporary file
    let _ = std::fs::remove_file(&temp_file);
    
    match result {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            
            log::info!("Windows API print output: stdout='{}', stderr='{}', success={}", 
                stdout, stderr, output.status.success());
            
            if output.status.success() && stdout.contains("Success") {
                log::info!("Windows API print successful to {}", printer_name);
                Ok(PrintResult {
                    success: true,
                    message: format!("Receipt printed successfully to {} using Windows API", printer_name)
                })
            } else {
                Err(format!("Windows API printing failed: {}", stderr))
            }
        }
        Err(e) => Err(format!("Failed to execute Windows API printing command: {}", e))
    }
}

// Method 4: Print simple text (for thermal printers that don't support ESC/POS)
#[cfg(target_os = "windows")]
async fn print_simple_text(escpos_data: &str, printer_name: &str) -> Result<PrintResult, String> {
    use std::process::Command;
    
    // Extract just the text content without ESC/POS commands
    let text_content = escpos_data
        .replace("\x1B\x40", "") // Remove ESC @
        .replace("\x1B\x21\x00", "") // Remove character size
        .replace("\x1B\x61\x01", "") // Remove center align
        .replace("\x1D\x56\x00", "") // Remove cut command
        .replace("\x0A", "\n") // Convert line feeds to newlines
        .trim()
        .to_string();
    
    let temp_file = std::env::temp_dir().join("receipt_simple.txt");
    
    // Write simple text to temporary file
    if let Err(e) = std::fs::write(&temp_file, text_content.as_bytes()) {
        return Err(format!("Failed to create temporary text file: {}", e));
    }
    
    log::info!("Trying simple text printing to: {}", printer_name);
    log::info!("Text content: {}", text_content);
    
    // Use PowerShell Out-Printer with simple text
    let ps_command = format!(
        r#"Get-Content "{}" | Out-Printer -Name "{}""#,
        &temp_file.to_string_lossy().replace("\\", "\\\\"),
        printer_name.replace("\\", "\\\\")
    );
    
    log::info!("Simple text PowerShell command: {}", ps_command);
    
    let result = Command::new("powershell")
        .args(&["-Command", &ps_command])
        .output();
    
    // Clean up temporary file
    let _ = std::fs::remove_file(&temp_file);
    
    match result {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            
            log::info!("Simple text print output: stdout='{}', stderr='{}', success={}", 
                stdout, stderr, output.status.success());
            
            if output.status.success() {
                log::info!("Simple text sent successfully to {}", printer_name);
                Ok(PrintResult {
                    success: true,
                    message: format!("Receipt printed successfully to {} using simple text", printer_name)
                })
            } else {
                Err(format!("Simple text printing failed: {}", stderr))
            }
        }
        Err(e) => Err(format!("Failed to execute simple text printing command: {}", e))
    }
}

// Method 4: Print ESC/POS using PowerShell Out-Printer (more reliable)
#[cfg(target_os = "windows")]
async fn print_escpos_with_powershell_out_printer(escpos_data: &str, printer_name: &str) -> Result<PrintResult, String> {
    use std::process::Command;
    
    let temp_file = std::env::temp_dir().join("receipt_escpos.txt");
    
    // Write ESC/POS data to temporary file
    if let Err(e) = std::fs::write(&temp_file, escpos_data.as_bytes()) {
        return Err(format!("Failed to create temporary ESC/POS file: {}", e));
    }
    
    log::info!("Trying PowerShell Out-Printer for ESC/POS to: {}", printer_name);
    
    // Use PowerShell Out-Printer command
    let ps_command = format!(
        r#"Get-Content "{}" -Raw | Out-Printer -Name "{}""#,
        temp_file.to_string_lossy().replace("\\", "\\\\"),
        printer_name.replace("\\", "\\\\")
    );
    
    log::info!("PowerShell Out-Printer command: {}", ps_command);
    
    let result = Command::new("powershell")
        .args(&["-Command", &ps_command])
        .output();
    
    // Clean up temporary file
    let _ = std::fs::remove_file(&temp_file);
    
    match result {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            
            log::info!("PowerShell Out-Printer output: stdout='{}', stderr='{}', success={}", 
                stdout, stderr, output.status.success());
            
            if output.status.success() {
                log::info!("ESC/POS data sent successfully using PowerShell Out-Printer to {}", printer_name);
                Ok(PrintResult {
                    success: true,
                    message: format!("Receipt printed successfully to {} using PowerShell Out-Printer", printer_name)
                })
            } else {
                Err(format!("PowerShell Out-Printer failed: {}", stderr))
            }
        }
        Err(e) => Err(format!("Failed to execute PowerShell Out-Printer command: {}", e))
    }
}

// Method 4: Print ESC/POS using PowerShell
#[cfg(target_os = "windows")]
async fn print_escpos_with_powershell(escpos_data: &str, printer_name: &str) -> Result<PrintResult, String> {
    use std::process::Command;
    
    // Encode ESC/POS data as base64 for PowerShell
    use base64::{Engine as _, engine::general_purpose};
    let encoded_data = general_purpose::STANDARD.encode(escpos_data.as_bytes());
    
    let ps_command = format!(
        r#"
        $data = [System.Convert]::FromBase64String('{}')
        $printer = '{}'
        try {{
            $port = New-Object System.IO.Ports.SerialPort $printer
            $port.Open()
            $port.Write($data, 0, $data.Length)
            $port.Close()
            Write-Output "Success"
        }} catch {{
            Write-Error $_.Exception.Message
        }}
        "#,
        encoded_data, printer_name
    );
    
    let result = Command::new("powershell")
        .args(&["-Command", &ps_command])
        .output();
    
    match result {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if stdout.contains("Success") {
                    log::info!("ESC/POS data sent successfully to printer: {}", printer_name);
                    Ok(PrintResult {
                        success: true,
                        message: format!("Receipt printed successfully to {}", printer_name)
                    })
                } else {
                    Err("PowerShell ESC/POS command failed".to_string())
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("PowerShell ESC/POS command failed: {}", stderr))
            }
        }
        Err(e) => Err(format!("Failed to execute PowerShell ESC/POS command: {}", e))
    }
}

// Print PDF silently to specified printer
async fn print_pdf_silently(pdf_data: Vec<u8>, printer_name: String) -> Result<PrintResult, String> {
    let temp_dir = std::env::temp_dir();
    let pdf_file = temp_dir.join("receipt_to_print.pdf");
    
    // Write PDF data to temporary file
    if let Err(e) = std::fs::write(&pdf_file, &pdf_data) {
        return Err(format!("Failed to create temporary PDF file: {}", e));
    }
    
    log::info!("Created temporary PDF file: {}", pdf_file.to_string_lossy());
    log::info!("Printing to printer: {}", printer_name);
    
           #[cfg(target_os = "windows")]
           {
               use std::process::Command;
               
        // Try multiple methods to print PDF to specific printer
        
        // Method 1: Use SumatraPDF if available (best for silent printing)
        if let Ok(result) = print_with_sumatra(&pdf_file, &printer_name).await {
            return Ok(result);
        }
        
        // Method 2: Use Adobe Reader if available
        if let Ok(result) = print_with_adobe_reader(&pdf_file, &printer_name).await {
            return Ok(result);
        }
        
        // Method 3: Use Windows print command
        if let Ok(result) = print_with_windows_print(&pdf_file, &printer_name).await {
            return Ok(result);
        }
        
        // Method 4: Try ESC/POS fallback for thermal printers
        log::warn!("All PDF printing methods failed, trying ESC/POS fallback");
        let escpos_data = convert_html_to_escpos(&std::fs::read_to_string(&pdf_file).unwrap_or_default());
        if let Ok(_result) = print_escpos_direct(escpos_data, printer_name.clone()).await {
            return Ok(PrintResult {
                success: true,
                message: format!("Receipt printed using ESC/POS fallback to {}", printer_name),
            });
        }
        
        // Method 5: Fallback to default printer with PowerShell
        let ps_command = format!(
            r#"Start-Process -FilePath "{}" -Verb Print -WindowStyle Hidden"#,
            pdf_file.to_string_lossy().replace("\\", "\\\\")
        );
        
        log::info!("Trying PowerShell fallback print command: {}", ps_command);
        
        let result = Command::new("powershell")
            .args(&["-Command", &ps_command])
            .output();
        
        match result {
            Ok(output) => {
                if output.status.success() {
                    log::info!("Successfully sent PDF print job to default printer (printer-specific printing failed)");
                    Ok(PrintResult {
                        success: true,
                        message: format!("PDF print job sent to default printer (could not target {} specifically)", printer_name),
                    })
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    log::error!("PowerShell print command failed: {}", stderr);
                    Err(format!("Failed to print PDF to {}. Check if printer is connected and driver is installed.", printer_name))
                }
            }
            Err(e) => {
                log::error!("PowerShell command failed: {}", e);
                Err(format!("Failed to print PDF to {}: {}", printer_name, e))
            }
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        // Use lpr command for silent printing on macOS
        let result = Command::new("lpr")
            .args(&["-P", &printer_name, &pdf_file.to_string_lossy()])
            .output();
        
        match result {
            Ok(output) => {
                       if output.status.success() {
                    log::info!("Successfully sent PDF print job to {}", printer_name);
                    Ok(PrintResult {
                               success: true,
                        message: format!("PDF print job sent to {} successfully", printer_name),
                    })
                       } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    log::error!("lpr command failed: {}", stderr);
                    Err(format!("Failed to print PDF to {}. Check if printer is connected and driver is installed.", printer_name))
                       }
                   }
                   Err(e) => {
                log::error!("lpr command failed: {}", e);
                Err(format!("Failed to print PDF to {}: {}", printer_name, e))
            }
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        // Use lp command for silent printing on Linux
        let result = Command::new("lp")
            .args(&["-d", &printer_name, &pdf_file.to_string_lossy()])
                   .output();
               
               match result {
                   Ok(output) => {
                if output.status.success() {
                    log::info!("Successfully sent PDF print job to {}", printer_name);
                    Ok(PrintResult {
                        success: true,
                        message: format!("PDF print job sent to {} successfully", printer_name),
                    })
                } else {
                       let stderr = String::from_utf8_lossy(&output.stderr);
                    log::error!("lp command failed: {}", stderr);
                    Err(format!("Failed to print PDF to {}. Check if printer is connected and driver is installed.", printer_name))
                }
            }
            Err(e) => {
                log::error!("lp command failed: {}", e);
                Err(format!("Failed to print PDF to {}: {}", printer_name, e))
            }
        }
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("PDF printing not supported on this operating system".to_string())
    }
}

#[tauri::command]
async fn print_receipt_preview(html_content: String) -> Result<PrintResult, String> {
    log::info!("Print preview command received");
    log::info!("HTML content length: {} characters", html_content.len());
    
    // Step 1: Try to render HTML to PDF
    match render_html_to_pdf(&html_content).await {
        Ok(pdf_data) => {
            // Step 2: Open PDF in default viewer for preview
            let temp_dir = std::env::temp_dir();
            let pdf_file = temp_dir.join("receipt_preview.pdf");
            
            // Write PDF data to temporary file
            if let Err(e) = std::fs::write(&pdf_file, &pdf_data) {
                return Err(format!("Failed to create temporary PDF file: {}", e));
            }
            
            log::info!("Created temporary PDF file for preview: {}", pdf_file.to_string_lossy());
            
            #[cfg(target_os = "windows")]
            {
                use std::process::Command;
                
                // Open PDF in default viewer
        let result = Command::new("cmd")
            .args(&["/C", "start", "", &pdf_file.to_string_lossy()])
            .output();
            
        match result {
            Ok(output) => {
                       if output.status.success() {
                    log::info!("PDF preview opened successfully");
                    Ok(PrintResult {
                               success: true,
                        message: "PDF preview opened successfully".to_string(),
                    })
                       } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    log::error!("Failed to open PDF preview: {}", stderr);
                    Err(format!("Failed to open PDF preview: {}", stderr))
                       }
                   }
                   Err(e) => {
                log::error!("Failed to open PDF preview: {}", e);
                Err(format!("Failed to open PDF preview: {}", e))
                   }
               }
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        let result = Command::new("open")
            .arg(&pdf_file.to_string_lossy().to_string())
            .output();
            
        match result {
            Ok(output) => {
                if output.status.success() {
                    log::info!("PDF preview opened successfully");
                Ok(PrintResult {
                    success: true,
                        message: "PDF preview opened successfully".to_string(),
                })
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    log::error!("Failed to open PDF preview: {}", stderr);
                    Err(format!("Failed to open PDF preview: {}", stderr))
                }
            }
            Err(e) => {
                log::error!("Failed to open PDF preview: {}", e);
                Err(format!("Failed to open PDF preview: {}", e))
            }
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        let result = Command::new("xdg-open")
            .arg(&pdf_file.to_string_lossy().to_string())
            .output();
            
        match result {
            Ok(output) => {
                if output.status.success() {
                    log::info!("PDF preview opened successfully");
                Ok(PrintResult {
                    success: true,
                        message: "PDF preview opened successfully".to_string(),
                })
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    log::error!("Failed to open PDF preview: {}", stderr);
                    Err(format!("Failed to open PDF preview: {}", stderr))
                }
            }
            Err(e) => {
                log::error!("Failed to open PDF preview: {}", e);
                Err(format!("Failed to open PDF preview: {}", e))
            }
        }
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("PDF preview not supported on this operating system".to_string())
    }
        },
        Err(e) => {
            log::warn!("PDF rendering failed for preview: {}, creating text preview", e);
            // Fallback: Create a text file preview
            let text_content = extract_text_from_html(&html_content);
            let temp_dir = std::env::temp_dir();
            let text_file = temp_dir.join("receipt_preview.txt");
            
            if let Err(e) = std::fs::write(&text_file, &text_content) {
                return Err(format!("Failed to create text preview file: {}", e));
            }
            
            log::info!("Created text preview file: {}", text_file.to_string_lossy());
            
            #[cfg(target_os = "windows")]
            {
                use std::process::Command;
                
                let result = Command::new("cmd")
                    .args(&["/C", "start", "notepad", &text_file.to_string_lossy()])
                    .output();
                
                match result {
                    Ok(output) => {
                        if output.status.success() {
                            log::info!("Text preview opened successfully");
                            Ok(PrintResult {
                                success: true,
                                message: "Text preview opened successfully".to_string(),
                            })
                        } else {
                            let stderr = String::from_utf8_lossy(&output.stderr);
                            log::error!("Failed to open text preview: {}", stderr);
                            Err(format!("Failed to open text preview: {}", stderr))
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to open text preview: {}", e);
                        Err(format!("Failed to open text preview: {}", e))
                    }
                }
            }
            
            #[cfg(not(target_os = "windows"))]
            {
                Err("Text preview not supported on this operating system".to_string())
            }
        }
    }
}

#[tauri::command]
async fn test_printer_connection(printer_name: String) -> Result<PrintResult, String> {
    log::info!("Testing printer connection for: {}", printer_name);
    
    #[cfg(target_os = "windows")]
    {
        // Test 1: Check if printer exists
        if !verify_printer_exists(&printer_name).await {
            return Err(format!("Printer {} not found in system", printer_name));
        }
        
        // Test 2: Try to send a full-width test print using multiple methods
        let test_data = "\x1B\x40\x1B\x57\x00\x00\x00\x00\x30\x00\x1B\x4C\x00\x00\x1B\x51\x00\x1B\x21\x00\x1B\x61\x01Test Print - Full Width\x0A================================\x0A\x0A\x1D\x56\x00"; // ESC/POS test command with full width
        let temp_file = std::env::temp_dir().join("test_print.txt");
        
        if let Err(e) = std::fs::write(&temp_file, test_data.as_bytes()) {
            return Err(format!("Failed to create test file: {}", e));
        }
        
        log::info!("Testing printer {} with ESC/POS test data", printer_name);
        
        // Try multiple test methods
        use std::process::Command;
        
        // Method 1: PowerShell Out-Printer
        let ps_command = format!(
            r#"Get-Content "{}" -Raw | Out-Printer -Name "{}""#,
            temp_file.to_string_lossy().replace("\\", "\\\\"),
            printer_name.replace("\\", "\\\\")
        );
        
        let result = Command::new("powershell")
            .args(&["-Command", &ps_command])
            .output();
        
        match result {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                
                log::info!("Printer test (PowerShell Out-Printer) output: stdout='{}', stderr='{}', success={}", 
                    stdout, stderr, output.status.success());
                
                if output.status.success() {
                    // Clean up test file
                    let _ = std::fs::remove_file(&temp_file);
                    return Ok(PrintResult {
                        success: true,
                        message: format!("Printer {} is accessible and responding (PowerShell Out-Printer)", printer_name)
                    });
                }
            }
            Err(e) => {
                log::warn!("PowerShell Out-Printer test failed: {}", e);
            }
        }
        
        // Method 2: Copy command
        let result = Command::new("cmd")
            .args(&["/C", "copy", "/B", &temp_file.to_string_lossy(), &format!("\\\\{}\\", printer_name)])
            .output();
        
        match result {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                
                log::info!("Printer test (Copy command) output: stdout='{}', stderr='{}', success={}", 
                    stdout, stderr, output.status.success());
                
                if output.status.success() && (stdout.contains("copied") || stdout.contains("1 file(s) copied")) {
                    // Clean up test file
                    let _ = std::fs::remove_file(&temp_file);
                    return Ok(PrintResult {
                        success: true,
                        message: format!("Printer {} is accessible and responding (Copy command)", printer_name)
                    });
                }
            }
            Err(e) => {
                log::warn!("Copy command test failed: {}", e);
            }
        }
        
        // Clean up test file
        let _ = std::fs::remove_file(&temp_file);
        
        Err(format!("Printer {} not responding to any test method", printer_name))
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Printer testing not implemented for this platform".to_string())
    }
}

#[tauri::command]
async fn print_esc_pos(esc_pos_data: String, printer_name: String) -> Result<PrintResult, String> {
    log::info!("ESC/POS print command received for printer: {}", printer_name);
    log::info!("ESC/POS data length: {} characters", esc_pos_data.len());
    
    // Create a temporary file for ESC/POS data
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join("escpos_to_print.txt");
    
    // Write ESC/POS data to temporary file
    if let Err(e) = std::fs::write(&temp_file, &esc_pos_data) {
        return Err(format!("Failed to create temporary file: {}", e));
    }
    
    log::info!("Created temp file: {}", temp_file.to_string_lossy());
    
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        // Use PowerShell Out-Printer for ESC/POS data
        let ps_command = format!(
            r#"Get-Content "{}" | Out-Printer -Name "{}""#,
            temp_file.to_string_lossy().replace("\\", "\\\\"),
            printer_name.replace("\\", "\\\\")
        );
        
        log::info!("Trying PowerShell Out-Printer command: {}", ps_command);
        
        let result = Command::new("powershell")
            .args(&["-Command", &ps_command])
            .output();
        
        match result {
            Ok(output) => {
                if output.status.success() {
                    log::info!("Successfully sent ESC/POS data to {}", printer_name);
                    return Ok(PrintResult {
                        success: true,
                        message: format!("ESC/POS data sent to {} successfully", printer_name),
                    });
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    log::error!("PowerShell Out-Printer failed: {}", stderr);
                    return Err(format!("Failed to print ESC/POS data to {}. Check if printer is connected and driver is installed.", printer_name));
                }
            }
            Err(e) => {
                log::error!("PowerShell command failed: {}", e);
                return Err(format!("Failed to print ESC/POS data to {}: {}", printer_name, e));
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("ESC/POS printing not supported on this operating system".to_string())
    }
}

#[tauri::command]
async fn open_cash_drawer(printer_name: String) -> Result<PrintResult, String> {
    log::info!("Open cash drawer command received for printer: {}", printer_name);
    
    // ESC/POS command to open cash drawer: ESC p 0 25 250
    let cash_drawer_command = String::from_utf8_lossy(b"\x1B\x70\x00\x19\xFA").to_string();
    
    // Create a temporary file for cash drawer command
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join("cash_drawer_command.txt");
    
    // Write cash drawer command to temporary file
    if let Err(e) = std::fs::write(&temp_file, cash_drawer_command) {
        return Err(format!("Failed to create temporary file: {}", e));
    }
    
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        // Use PowerShell Out-Printer for cash drawer command
        let ps_command = format!(
            r#"Get-Content "{}" | Out-Printer -Name "{}""#,
            temp_file.to_string_lossy().replace("\\", "\\\\"),
            printer_name.replace("\\", "\\\\")
        );
        
        log::info!("Trying PowerShell Out-Printer command for cash drawer: {}", ps_command);
        
        let result = Command::new("powershell")
            .args(&["-Command", &ps_command])
            .output();
        
        match result {
            Ok(output) => {
                if output.status.success() {
                    log::info!("Successfully sent cash drawer command to {}", printer_name);
                    return Ok(PrintResult {
                        success: true,
                        message: format!("Cash drawer opened on {}", printer_name),
                    });
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    log::error!("PowerShell Out-Printer failed for cash drawer: {}", stderr);
                    return Err(format!("Failed to open cash drawer on {}. Check if printer is connected and driver is installed.", printer_name));
                }
            }
            Err(e) => {
                log::error!("PowerShell command failed for cash drawer: {}", e);
                return Err(format!("Failed to open cash drawer on {}: {}", printer_name, e));
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("Cash drawer control not supported on this operating system".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            // New raw printing API
            get_available_printers,
            set_default_printer,
            print_raw_bytes,
            print_text_direct,
            print_pdf_raw,
            // Legacy (kept for compatibility; can be removed if not needed)
            test_printer_connection,
            print_receipt,
            print_receipt_preview,
            print_esc_pos,
            open_cash_drawer
        ])
        .setup(|app| {
            // Let Tauri use the configured devUrl (localhost:4200) for development
            
            // Test printer connection on startup (without printing)
            let _app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                log::info!("Testing printer connection on startup...");
                match test_printer_connection("POS-80C".to_string()).await {
                    Ok(result) => {
                        log::info!("Printer test successful: {}", result);
                    }
                    Err(e) => {
                        log::warn!("Printer test failed: {}", e);
                    }
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
