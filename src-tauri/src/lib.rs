use std::process::Command;

#[tauri::command]
fn get_printers() -> Vec<String> {
    let mut printers = Vec::new();
    
    // Sur Windows, utiliser PowerShell pour lister les imprimantes
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("powershell")
            .args(&["-Command", "Get-Printer | Select-Object -ExpandProperty Name"])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                printers = stdout
                    .lines()
                    .filter(|line| !line.trim().is_empty())
                    .map(|line| line.trim().to_string())
                    .collect();
            }
        }
    }
    
    // Sur Linux/Mac, utiliser lpstat
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = Command::new("lpstat")
            .args(&["-p"])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                printers = stdout
                    .lines()
                    .filter_map(|line| {
                        line.strip_prefix("printer ")
                            .and_then(|s| s.split_whitespace().next())
                            .map(|s| s.to_string())
                    })
                    .collect();
            }
        }
    }
    
    // Ajouter une imprimante par défaut si aucune n'est trouvée
    if printers.is_empty() {
        printers.push("Imprimante par défaut".to_string());
        printers.push("Microsoft Print to PDF".to_string());
    }
    
    printers
}

use std::io::Write;
use std::fs::File;


#[tauri::command]
fn print_pdf(printer_name: String, file_content: Vec<u8>) -> Result<String, String> {
    // 1. Save buffer to a temporary file (PNG)
    let mut temp_dir = std::env::temp_dir();
    let file_name = format!("ticket_{}.png", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    temp_dir.push(file_name);
    let file_path = temp_dir.to_str().unwrap().to_string();

    let mut file = File::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(&file_content).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?; // Ensure flush
    drop(file); // Explicitly release lock before spawning PowerShell

    // 2. Print using PowerShell (System.Drawing) - Works for Images without external PDF viewer
    #[cfg(target_os = "windows")]
    {
        let ps_script = format!(
            r#"
            Add-Type -AssemblyName System.Drawing
            $doc = New-Object System.Drawing.Printing.PrintDocument
            $doc.PrinterSettings.PrinterName = "{printer_name}"
            $doc.DocumentName = "Ticket Caisse"
            # Remove default margins which cause "zoom" or whitespace
            $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
            
            # Custom Page Handling
            $doc.add_PrintPage({{
                param($sender, $e)
                try {{
                    # Retry logic to handle file locking/race conditions
                    $bytes = $null
                    $retries = 0
                    while ($retries -lt 10) {{
                        try {{
                            $bytes = [System.IO.File]::ReadAllBytes("{file_path}")
                            break
                        }} catch {{
                            Start-Sleep -Milliseconds 100
                            $retries++
                        }}
                    }}
                    
                    if ($null -eq $bytes) {{ throw "Timeout reading file: {file_path}" }}

                    $ms = New-Object System.IO.MemoryStream(,$bytes)
                    $img = [System.Drawing.Image]::FromStream($ms)
                    
                    # Force 80mm styling. 280 units (1/100 inch) = 71.12mm. Standard printable is ~72mm.
                    # 280 leaves a tiny buffer to avoid clipping.
                    # DEFAULT UNIT IS 1/100 INCH - DO NOT CHANGE PageUnit
                    $printableWidth = 280 
                    
                    # Calculate Aspect Ratio
                    $ratio = $img.Height / $img.Width
                    $newHeight = $printableWidth * $ratio
                    
                    # Quality Settings for Thermal Printing
                    $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
                    $e.Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                    $e.Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
                    $e.Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

                    # Draw Scaled
                    $e.Graphics.DrawImage($img, 0, 0, $printableWidth, $newHeight)
                    
                    $img.Dispose()
                    $ms.Dispose()
                }} catch {{
                    Write-Error $_
                }}
            }})
            
            try {{
                $doc.Print()
                "SUCCESS"
            }} catch {{
                Write-Error $_
                exit 1
            }}
            "#
        );

        let output = Command::new("powershell")
            .args(&["-NoProfile", "-Command", &ps_script])
            .output()
            .map_err(|e| e.to_string())?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        if !output.status.success() || !stderr.is_empty() {
             return Err(format!("PS Error (Exit: {}): {}\nStdout: {}", output.status, stderr, stdout));
        }
        
        return Ok("Printed Successfully".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Linux/Mac implementation (lp supports images usually)
        let status = Command::new("lp")
            .arg("-d")
            .arg(&printer_name)
            .arg(&file_path)
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err("LP command failed".to_string());
        }
        
        Ok("Printed successfully".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // On garde uniquement l'activation du plugin SQL
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_printers, print_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}