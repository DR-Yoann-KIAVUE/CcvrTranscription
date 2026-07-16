mod auth;
mod db;
pub mod transcribe;

use db::{CompteRendu, CrVersion, Patient, SearchHit};
use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

/// Clé de configuration du hash de mot de passe.
const CFG_PASSWORD: &str = "password_hash";

/// État partagé : connexion SQLite protégée par mutex.
struct AppState {
    db: Mutex<Connection>,
}

// ---------- Helpers de chemins ----------

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Dossier de données introuvable : {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn audio_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = data_dir(app)?.join("audio");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = data_dir(app)?.join("models");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Sélectionne le fichier de modèle ggml à utiliser (priorité au français).
fn pick_model(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = models_dir(app)?;
    let preferred = [
        "ggml-large-v3-french.bin",
        "ggml-large-v3-fr.bin",
        "ggml-medium-french.bin",
        "ggml-large-v3.bin",
    ];
    for name in preferred {
        let p = dir.join(name);
        if p.exists() {
            return Ok(p);
        }
    }
    // Sinon, premier .bin trouvé.
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let p = entry.path();
        if p.extension().and_then(|e| e.to_str()) == Some("bin") {
            return Ok(p);
        }
    }
    Err(format!(
        "Aucun modèle Whisper (.bin) trouvé dans : {}",
        dir.display()
    ))
}

// ---------- Commandes : authentification ----------

#[tauri::command]
fn auth_is_configured(state: State<AppState>) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    Ok(db::config_get(&conn, CFG_PASSWORD)?.is_some())
}

#[tauri::command]
fn auth_setup(state: State<AppState>, password: String) -> Result<(), String> {
    if password.chars().count() < 8 {
        return Err("Le mot de passe doit contenir au moins 8 caractères.".into());
    }
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    if db::config_get(&conn, CFG_PASSWORD)?.is_some() {
        return Err("Un mot de passe est déjà défini.".into());
    }
    let hash = auth::hash_password(&password)?;
    db::config_set(&conn, CFG_PASSWORD, &hash)
}

#[tauri::command]
fn auth_verify(state: State<AppState>, password: String) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    match db::config_get(&conn, CFG_PASSWORD)? {
        Some(hash) => Ok(auth::verify_password(&password, &hash)),
        None => Ok(false),
    }
}

// ---------- Commandes : modèle Whisper ----------

#[tauri::command]
fn model_present(app: AppHandle) -> Result<bool, String> {
    Ok(pick_model(&app).is_ok())
}

#[tauri::command]
fn models_dir_path(app: AppHandle) -> Result<String, String> {
    Ok(models_dir(&app)?.display().to_string())
}

// ---------- Commandes : patients ----------

#[tauri::command]
fn list_patients(
    state: State<AppState>,
    query: Option<String>,
) -> Result<Vec<Patient>, String> {
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    db::list_patients(&conn, query.as_deref())
}

#[tauri::command]
fn create_patient(
    state: State<AppState>,
    nom: String,
    date_naissance: Option<String>,
    now: String,
) -> Result<Patient, String> {
    let nom = nom.trim();
    if nom.is_empty() {
        return Err("Le nom du patient est requis.".into());
    }
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    db::create_patient(&conn, nom, date_naissance.as_deref(), &now)
}

#[tauri::command]
fn delete_patient(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    db::delete_patient(&conn, id)
}

// ---------- Commandes : comptes-rendus ----------

#[tauri::command]
fn list_comptes_rendus(
    state: State<AppState>,
    patient_id: i64,
) -> Result<Vec<CompteRendu>, String> {
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    db::list_comptes_rendus(&conn, patient_id)
}

#[tauri::command]
fn get_compte_rendu(state: State<AppState>, id: i64) -> Result<CompteRendu, String> {
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    db::get_compte_rendu(&conn, id)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn create_compte_rendu(
    state: State<AppState>,
    patient_id: i64,
    titre: String,
    type_cr: Option<String>,
    date_consultation: String,
    texte: String,
    audio_path: Option<String>,
    origine: String,
    now: String,
) -> Result<CompteRendu, String> {
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    db::create_compte_rendu(
        &conn,
        patient_id,
        titre.trim(),
        type_cr.as_deref(),
        &date_consultation,
        &texte,
        audio_path.as_deref(),
        &origine,
        &now,
    )
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn update_compte_rendu(
    state: State<AppState>,
    id: i64,
    titre: String,
    type_cr: Option<String>,
    date_consultation: String,
    texte: String,
    origine: String,
    now: String,
) -> Result<CompteRendu, String> {
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    db::update_compte_rendu(
        &conn,
        id,
        titre.trim(),
        type_cr.as_deref(),
        &date_consultation,
        &texte,
        &origine,
        &now,
    )
}

#[tauri::command]
fn list_cr_versions(
    state: State<AppState>,
    compte_rendu_id: i64,
) -> Result<Vec<CrVersion>, String> {
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    db::list_versions(&conn, compte_rendu_id)
}

#[tauri::command]
fn rename_compte_rendu(
    state: State<AppState>,
    id: i64,
    titre: String,
    now: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    db::rename_compte_rendu(&conn, id, titre.trim(), &now)
}

#[tauri::command]
fn delete_compte_rendu(app: AppHandle, state: State<AppState>, id: i64) -> Result<(), String> {
    let audio = {
        let conn = state.db.lock().map_err(|_| "verrou DB")?;
        db::delete_compte_rendu(&conn, id)?
    };
    // Supprime aussi le fichier audio associé, s'il est dans notre dossier.
    if let Some(path) = audio {
        let _ = fs::remove_file(&path);
    }
    let _ = app; // conservé pour cohérence de signature / futurs usages
    Ok(())
}

#[tauri::command]
fn search_comptes_rendus(
    state: State<AppState>,
    query: String,
) -> Result<Vec<SearchHit>, String> {
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    db::search_comptes_rendus(&conn, &query)
}

// ---------- Commandes : audio ----------

/// Sauvegarde un WAV (octets bruts) dans le dossier audio et renvoie son chemin absolu.
#[tauri::command]
fn save_recording(app: AppHandle, wav: Vec<u8>, name: String) -> Result<String, String> {
    let dir = audio_dir(&app)?;
    // Nettoie le nom pour éviter tout chemin arbitraire.
    let safe: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let file = dir.join(format!("{safe}.wav"));
    fs::write(&file, &wav).map_err(|e| e.to_string())?;
    Ok(file.display().to_string())
}

// ---------- Commande : transcription ----------

#[tauri::command]
async fn transcribe(app: AppHandle, path: String) -> Result<String, String> {
    let model = pick_model(&app)?;
    let model_str = model.display().to_string();
    tauri::async_runtime::spawn_blocking(move || transcribe::run_whisper(&model_str, &path))
        .await
        .map_err(|e| format!("Erreur d'exécution : {e}"))?
}

// ---------- Commandes : export granulaire ----------

/// Écrit des octets bruts vers un chemin choisi par l'utilisateur (PDF, DOCX…).
#[tauri::command]
fn save_bytes(path: String, bytes: Vec<u8>) -> Result<String, String> {
    fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path)
}

/// Copie un fichier (ex. l'audio WAV) vers un chemin choisi.
#[tauri::command]
fn copy_file(src: String, dest: String) -> Result<String, String> {
    if !PathBuf::from(&src).exists() {
        return Err("Fichier source introuvable.".into());
    }
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(dest)
}

// ---------- Point d'entrée ----------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle();
            let db_file = data_dir(handle)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?
                .join("dictee.db");
            let conn = db::open(&db_file)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            app.manage(AppState {
                db: Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth_is_configured,
            auth_setup,
            auth_verify,
            model_present,
            models_dir_path,
            list_patients,
            create_patient,
            delete_patient,
            list_comptes_rendus,
            get_compte_rendu,
            create_compte_rendu,
            update_compte_rendu,
            list_cr_versions,
            rename_compte_rendu,
            delete_compte_rendu,
            search_comptes_rendus,
            save_recording,
            transcribe,
            save_bytes,
            copy_file,
        ])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l'application Tauri");
}
