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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // On garde uniquement l'activation du plugin SQL
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_printers])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}