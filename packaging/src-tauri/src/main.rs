// Blackwire Desktop - Tauri Main (v2)
// Manages Docker container lifecycle and provides native window

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Command, Child};
use std::sync::Mutex;
use std::time::Duration;
use std::thread;
use tauri::{Manager, State};
use serde::{Deserialize, Serialize};

// ============================================
// State Management
// ============================================

struct DockerState {
    container_id: Mutex<Option<String>>,
    process: Mutex<Option<Child>>,
}

#[derive(Serialize, Deserialize)]
struct DockerStatus {
    running: bool,
    container_id: Option<String>,
    error: Option<String>,
}

// ============================================
// Docker Management Commands
// ============================================

#[tauri::command]
async fn start_docker_container(state: State<'_, DockerState>) -> Result<DockerStatus, String> {
    // Check if Docker is available
    let docker_check = Command::new("docker")
        .arg("--version")
        .output();

    if docker_check.is_err() {
        return Ok(DockerStatus {
            running: false,
            container_id: None,
            error: Some("Docker not installed or not running".to_string()),
        });
    }

    // Check if container already running
    let existing = Command::new("docker")
        .args(&["ps", "-q", "-f", "name=blackwire"])
        .output()
        .map_err(|e| e.to_string())?;

    if !existing.stdout.is_empty() {
        let container_id = String::from_utf8_lossy(&existing.stdout).trim().to_string();
        *state.container_id.lock().unwrap() = Some(container_id.clone());

        return Ok(DockerStatus {
            running: true,
            container_id: Some(container_id),
            error: None,
        });
    }

    // Get app directory
    let app_dir = get_resource_dir();

    // Start container with docker compose (v2 plugin or v1 standalone)
    let compose = compose_command()
        .args(&["up", "-d"])
        .current_dir(&app_dir)
        .spawn();

    match compose {
        Ok(child) => {
            // Wait for container to start
            std::thread::sleep(std::time::Duration::from_secs(3));

            // Get container ID
            let id_output = Command::new("docker")
                .args(&["ps", "-q", "-f", "name=blackwire"])
                .output()
                .map_err(|e| e.to_string())?;

            let container_id = String::from_utf8_lossy(&id_output.stdout).trim().to_string();
            *state.container_id.lock().unwrap() = Some(container_id.clone());
            *state.process.lock().unwrap() = Some(child);

            Ok(DockerStatus {
                running: true,
                container_id: Some(container_id),
                error: None,
            })
        }
        Err(e) => Ok(DockerStatus {
            running: false,
            container_id: None,
            error: Some(format!("Failed to start container: {}", e)),
        }),
    }
}

#[tauri::command]
async fn stop_docker_container(state: State<'_, DockerState>) -> Result<(), String> {
    let app_dir = get_resource_dir();

    // Stop container
    compose_command()
        .args(&["down"])
        .current_dir(&app_dir)
        .output()
        .map_err(|e| e.to_string())?;

    // Clear state
    *state.container_id.lock().unwrap() = None;
    if let Some(mut process) = state.process.lock().unwrap().take() {
        let _ = process.kill();
    }

    Ok(())
}

#[tauri::command]
async fn get_docker_status(state: State<'_, DockerState>) -> Result<DockerStatus, String> {
    let container_id = state.container_id.lock().unwrap().clone();

    if let Some(id) = &container_id {
        // Check if container is still running
        let check = Command::new("docker")
            .args(&["ps", "-q", "-f", format!("id={}", id).as_str()])
            .output()
            .map_err(|e| e.to_string())?;

        if check.stdout.is_empty() {
            *state.container_id.lock().unwrap() = None;
            return Ok(DockerStatus {
                running: false,
                container_id: None,
                error: Some("Container stopped".to_string()),
            });
        }

        Ok(DockerStatus {
            running: true,
            container_id: Some(id.clone()),
            error: None,
        })
    } else {
        Ok(DockerStatus {
            running: false,
            container_id: None,
            error: None,
        })
    }
}

#[tauri::command]
async fn get_docker_logs(state: State<'_, DockerState>) -> Result<String, String> {
    let container_id = state.container_id.lock().unwrap().clone();

    if let Some(id) = container_id {
        let logs = Command::new("docker")
            .args(&["logs", "--tail", "100", &id])
            .output()
            .map_err(|e| e.to_string())?;

        Ok(String::from_utf8_lossy(&logs.stdout).to_string())
    } else {
        Err("No container running".to_string())
    }
}

// ============================================
// Helper Functions
// ============================================

/// Devuelve un `Command` para Docker Compose, prefiriendo el plugin v2
/// (`docker compose`) y cayendo al binario standalone v1 (`docker-compose`).
/// En sistemas modernos solo existe el plugin v2, así que invocar
/// `docker-compose` directamente fallaba con "Failed to start container".
fn compose_command() -> Command {
    let v2_ok = Command::new("docker")
        .args(&["compose", "version"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    if v2_ok {
        let mut c = Command::new("docker");
        c.arg("compose");
        c
    } else {
        Command::new("docker-compose")
    }
}

fn check_backend_ready() -> bool {
    // Chequeo nativo por TCP/HTTP (sin shell-out a `curl`): dentro de un AppImage,
    // los procesos hijos heredan LD_LIBRARY_PATH y los binarios dinámicos del sistema
    // como curl suelen fallar al cargar libs incompatibles, dando falsos negativos.
    use std::io::{Read, Write};
    use std::net::{SocketAddr, TcpStream};
    use std::time::Duration;

    let addr: SocketAddr = match "127.0.0.1:5000".parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    let mut stream = match TcpStream::connect_timeout(&addr, Duration::from_secs(2)) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
    let req = "GET /api/proxy/status HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n";
    if stream.write_all(req.as_bytes()).is_err() {
        return false;
    }
    let mut resp = String::new();
    let _ = stream.read_to_string(&mut resp);
    resp.lines().next().unwrap_or("").contains(" 200")
}

fn get_resource_dir() -> std::path::PathBuf {
    let mut locations: Vec<std::path::PathBuf> = Vec::new();

    // AppImage sets APPDIR to the mount point (e.g. /tmp/.mount_xxx).
    // Tauri bundles resources with the product name as directory and prefixes
    // relative "../" paths with "_up_/", so "../docker-compose.yml" ends up at
    // usr/lib/Blackwire/_up_/docker-compose.yml inside the AppImage.
    if let Ok(appdir) = std::env::var("APPDIR") {
        let base = std::path::PathBuf::from(&appdir);
        // Primary: where Tauri actually places resources in AppImage bundles
        locations.push(base.join("usr").join("lib").join("Blackwire").join("_up_"));
        locations.push(base.join("usr").join("lib").join("blackwire").join("_up_"));
        locations.push(base.join("usr").join("lib").join("Blackwire"));
        locations.push(base.join("usr").join("lib").join("blackwire"));
        locations.push(base.join("usr").join("share").join("blackwire"));
        locations.push(base.join("usr"));
    }

    // When installed as a .deb/.rpm the binary lives in /usr/bin and resources
    // are placed next to it in ../lib/blackwire or ../share/blackwire.
    if let Ok(exe) = std::env::current_exe() {
        if let Some(bin_dir) = exe.parent() {           // …/usr/bin
            if let Some(usr_dir) = bin_dir.parent() {  // …/usr
                locations.push(usr_dir.join("lib").join("Blackwire").join("_up_"));
                locations.push(usr_dir.join("lib").join("blackwire").join("_up_"));
                locations.push(usr_dir.join("lib").join("blackwire"));
                locations.push(usr_dir.join("share").join("blackwire"));
            }
        }
    }

    // Traditional install locations
    locations.push(std::path::PathBuf::from("/usr/share/blackwire"));
    locations.push(std::path::PathBuf::from("/opt/blackwire"));

    // Development / current working directory
    if let Ok(cwd) = std::env::current_dir() {
        locations.push(cwd);
    }

    for loc in &locations {
        if loc.join("docker-compose.yml").exists() {
            return loc.clone();
        }
    }

    // Fallback to current directory
    std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
}

fn docker_image_exists(image: &str) -> bool {
    Command::new("docker")
        .args(&["images", "-q", image])
        .output()
        .map(|o| !o.stdout.is_empty())
        .unwrap_or(false)
}

fn load_docker_image(resource_dir: &std::path::Path) -> Result<(), String> {
    let tarball = resource_dir.join("blackwire-image.tar.gz");
    if !tarball.exists() {
        return Err(format!(
            "Bundled Docker image not found at {:?}. The AppImage may be corrupt.",
            tarball
        ));
    }

    println!("[Blackwire] Loading bundled Docker image (first run — this may take a minute)...");

    let output = Command::new("docker")
        .args(&["load", "-i"])
        .arg(&tarball)
        .output()
        .map_err(|e| format!("Failed to run docker load: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("docker load failed: {}", stderr));
    }

    println!("[Blackwire] Docker image loaded successfully");
    Ok(())
}

fn remove_existing_container() {
    let _ = Command::new("docker")
        .args(&["rm", "-f", "blackwire"])
        .output();
}

fn setup_host_directories() -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/root".to_string());
    let base = std::path::Path::new(&home).join("Blackwire");
    // Create all required host paths before docker-compose bind-mounts them.
    // If these don't exist Docker would create them as root, breaking permissions.
    for dir in &["certs", "data/projects", "extensions"] {
        let path = base.join(dir);
        std::fs::create_dir_all(&path)
            .map_err(|e| format!("Failed to create {}: {}", path.display(), e))?;
    }
    println!("[Blackwire] Host directories ready at ~/Blackwire/");
    Ok(())
}

fn start_docker_sync(dev_projects: bool) -> Result<(), String> {
    println!("[Blackwire] Checking Docker...");

    // Check if Docker is running
    let docker_check = Command::new("docker")
        .args(&["ps"])
        .output();

    if docker_check.is_err() {
        return Err("Docker is not running. Please start Docker and try again.".to_string());
    }

    println!("[Blackwire] Docker is running");

    // Get resource directory where docker-compose.yml is located
    let resource_dir = get_resource_dir();
    println!("[Blackwire] Using resource directory: {:?}", resource_dir);

    let compose_file = resource_dir.join("docker-compose.yml");
    if !compose_file.exists() {
        return Err(format!("docker-compose.yml not found. Searched in: {:?}", compose_file));
    }

    // Ensure ~/Blackwire/{certs,projects,shared,extensions} exist on the host
    // before docker-compose tries to bind-mount them (Docker would create them
    // as root otherwise).
    setup_host_directories()?;

    // Ensure the Docker image is available — load from bundle on first run
    if !docker_image_exists("blackwire:latest") {
        println!("[Blackwire] Docker image not found locally, loading from bundle...");
        load_docker_image(&resource_dir)?;
    } else {
        println!("[Blackwire] Docker image already present");
    }

    // Always remove any existing container to avoid name conflicts
    remove_existing_container();

    if dev_projects {
        println!("[Blackwire] --dev-projects: ~/Blackwire/projects is always mounted");
    }

    println!("[Blackwire] Creating container...");
    compose_command()
        .args(&["up", "-d"])
        .current_dir(&resource_dir)
        .output()
        .map_err(|e| format!("Failed to start Docker container: {}", e))?;

    // Wait for backend to be ready (max 30 seconds)
    println!("[Blackwire] Waiting for backend to start...");
    for i in 1..=30 {
        if check_backend_ready() {
            println!("[Blackwire] Backend is ready!");
            return Ok(());
        }
        println!("[Blackwire] Attempt {}/30...", i);
        thread::sleep(Duration::from_secs(1));
    }

    Err("Backend failed to start within 30 seconds. Check Docker logs with: docker logs blackwire".to_string())
}

// ============================================
// Main
// ============================================

fn main() {
    // Start Docker container BEFORE creating the Tauri app
    println!("[Blackwire] Starting Blackwire Desktop...");

    let dev_projects = std::env::args().any(|a| a == "--dev-projects");
    if dev_projects {
        println!("[Blackwire] Mode: --dev-projects (~/Blackwire/projects will be mounted)");
    }

    if let Err(e) = start_docker_sync(dev_projects) {
        eprintln!("[Blackwire] ERROR: {}", e);
        eprintln!("[Blackwire] Please ensure:");
        eprintln!("  1. Docker is installed and running");
        eprintln!("  2. You have permissions to use Docker (run: sudo usermod -aG docker $USER)");
        std::process::exit(1);
    }

    tauri::Builder::default()
        .manage(DockerState {
            container_id: Mutex::new(None),
            process: Mutex::new(None),
        })
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            start_docker_container,
            stop_docker_container,
            get_docker_status,
            get_docker_logs
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // Maximize window on startup for better visibility
            let _ = window.maximize();

            // Open DevTools for debugging
            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }

            // Stop Docker container when window is closed
            let app_handle = app.handle().clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    println!("[Blackwire] Stopping Docker container...");
                    let _ = Command::new("docker")
                        .args(&["rm", "-f", "blackwire"])
                        .output();
                    println!("[Blackwire] Goodbye!");
                    app_handle.exit(0);
                }
            });

            println!("[Blackwire] Application ready!");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
