mod auth;
mod db;
pub mod transcribe;

use db::{CompteRendu, CrVersion, Patient, SearchHit};
use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

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
    // 1) Modèle embarqué dans l'application (ressource livrée avec l'installeur).
    if let Ok(p) = app
        .path()
        .resolve("models/ggml-large-v3-french.bin", tauri::path::BaseDirectory::Resource)
    {
        if p.exists() {
            return Ok(p);
        }
    }
    // 2) Sinon, modèle fourni par l'utilisateur dans le dossier de données.
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
    let app_ev = app.clone();
    let mut last = -1i32;
    tauri::async_runtime::spawn_blocking(move || {
        transcribe::run_whisper(&model_str, &path, move |pct| {
            // N'émet que sur changement, pour limiter le trafic d'événements.
            if pct != last {
                last = pct;
                let _ = app_ev.emit("transcribe-progress", pct);
            }
        })
    })
    .await
    .map_err(|e| format!("Erreur d'exécution : {e}"))?
}

// ---------- Réglages : moteur de transcription ----------

const CFG_PROVIDER: &str = "stt_provider";
const CFG_ELEVEN_KEY: &str = "eleven_api_key";

#[tauri::command]
fn get_stt_provider(state: State<AppState>) -> Result<String, String> {
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    Ok(db::config_get(&conn, CFG_PROVIDER)?.unwrap_or_else(|| "local".into()))
}

#[tauri::command]
fn set_stt_provider(state: State<AppState>, provider: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    db::config_set(&conn, CFG_PROVIDER, &provider)
}

#[tauri::command]
fn eleven_key_present(state: State<AppState>) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    Ok(db::config_get(&conn, CFG_ELEVEN_KEY)?
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false))
}

#[tauri::command]
fn set_eleven_key(state: State<AppState>, key: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "verrou DB")?;
    db::config_set(&conn, CFG_ELEVEN_KEY, key.trim())
}

/// Transcription cloud via ElevenLabs (l'audio est envoyé à un service tiers).
#[tauri::command]
async fn transcribe_elevenlabs(
    state: State<'_, AppState>,
    path: String,
) -> Result<String, String> {
    let key = {
        let conn = state.db.lock().map_err(|_| "verrou DB")?;
        db::config_get(&conn, CFG_ELEVEN_KEY)?.unwrap_or_default()
    };
    let key = key.trim().to_string();
    if key.is_empty() {
        return Err("Clé API ElevenLabs manquante (voir Réglages).".into());
    }
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let part = reqwest::multipart::Part::bytes(bytes)
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;
    let form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("model_id", "scribe_v2")
        .text("language_code", "fra");
    let resp = reqwest::Client::new()
        .post("https://api.elevenlabs.io/v1/speech-to-text")
        .header("xi-api-key", key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Connexion à ElevenLabs impossible : {e}"))?;
    let status = resp.status();
    let body = resp.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("ElevenLabs (HTTP {}) : {}", status.as_u16(), body));
    }
    let v: serde_json::Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    Ok(v.get("text")
        .and_then(|t| t.as_str())
        .unwrap_or_default()
        .trim()
        .to_string())
}

/// Télécharge le modèle Whisper français (mode local) dans le dossier de
/// données, avec progression. L'app reste légère : le modèle n'est pas embarqué.
#[tauri::command]
async fn download_model(app: AppHandle) -> Result<String, String> {
    use futures_util::StreamExt;
    use std::io::Write;

    let dir = models_dir(&app)?;
    let dest = dir.join("ggml-large-v3-french.bin");
    if dest.exists() {
        return Ok(dest.display().to_string());
    }
    let url = "https://github.com/DR-Yoann-KIAVUE/CcvrTranscription/releases/download/model-fr-v1/ggml-large-v3-french.bin";
    let resp = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Téléchargement impossible : {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Téléchargement du modèle : HTTP {}", resp.status().as_u16()));
    }
    let total = resp.content_length().unwrap_or(0);
    let tmp = dir.join("ggml-large-v3-french.bin.part");
    let mut file = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut last = -1i64;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        if total > 0 {
            let pct = (downloaded * 100 / total) as i64;
            if pct != last {
                last = pct;
                let _ = app.emit("model-download-progress", pct);
            }
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    drop(file);
    std::fs::rename(&tmp, &dest).map_err(|e| e.to_string())?;
    Ok(dest.display().to_string())
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

// ---------- Commandes : données / sauvegarde ----------

#[derive(serde::Serialize)]
struct DataStats {
    dir: String,
    patients: i64,
    comptes_rendus: i64,
    versions: i64,
    audio_count: u64,
    db_bytes: u64,
    audio_bytes: u64,
}

#[tauri::command]
fn data_stats(app: AppHandle, state: State<AppState>) -> Result<DataStats, String> {
    let dir = data_dir(&app)?;
    let (patients, comptes_rendus, versions) = {
        let conn = state.db.lock().map_err(|_| "verrou DB")?;
        let count = |sql: &str| conn.query_row(sql, [], |r| r.get::<_, i64>(0)).unwrap_or(0);
        (
            count("SELECT COUNT(*) FROM patients"),
            count("SELECT COUNT(*) FROM comptes_rendus"),
            count("SELECT COUNT(*) FROM cr_versions"),
        )
    };
    let db_bytes = fs::metadata(dir.join("dictee.db")).map(|m| m.len()).unwrap_or(0);
    let (mut audio_count, mut audio_bytes) = (0u64, 0u64);
    if let Ok(rd) = fs::read_dir(dir.join("audio")) {
        for e in rd.flatten() {
            if let Ok(m) = e.metadata() {
                if m.is_file() {
                    audio_count += 1;
                    audio_bytes += m.len();
                }
            }
        }
    }
    Ok(DataStats {
        dir: dir.display().to_string(),
        patients,
        comptes_rendus,
        versions,
        audio_count,
        db_bytes,
        audio_bytes,
    })
}

/// Sauvegarde complète : copie cohérente de la base + tous les audios vers un
/// sous-dossier du dossier choisi. Renvoie le chemin de la sauvegarde.
#[tauri::command]
fn backup_data(
    app: AppHandle,
    state: State<AppState>,
    dest_dir: String,
    folder_name: String,
) -> Result<String, String> {
    let safe: String = folder_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();
    let out = PathBuf::from(&dest_dir).join(if safe.is_empty() { "ccvr-sauvegarde".into() } else { safe });
    fs::create_dir_all(&out).map_err(|e| e.to_string())?;

    // Copie cohérente de la base via VACUUM INTO (inclut les données du WAL).
    let db_out = out.join("dictee.db");
    let _ = fs::remove_file(&db_out);
    {
        let conn = state.db.lock().map_err(|_| "verrou DB")?;
        conn.execute("VACUUM INTO ?1", [db_out.to_str().ok_or("chemin invalide")?])
            .map_err(|e| e.to_string())?;
    }

    // Copie des fichiers audio.
    let audio_src = audio_dir(&app)?;
    let audio_dst = out.join("audio");
    fs::create_dir_all(&audio_dst).map_err(|e| e.to_string())?;
    if let Ok(rd) = fs::read_dir(&audio_src) {
        for e in rd.flatten() {
            let p = e.path();
            if p.is_file() {
                if let Some(name) = p.file_name() {
                    let _ = fs::copy(&p, audio_dst.join(name));
                }
            }
        }
    }

    Ok(out.display().to_string())
}

// ---------- Point d'entrée ----------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
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
            get_stt_provider,
            set_stt_provider,
            eleven_key_present,
            set_eleven_key,
            transcribe_elevenlabs,
            download_model,
            save_bytes,
            copy_file,
            data_stats,
            backup_data,
        ])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l'application Tauri");
}
