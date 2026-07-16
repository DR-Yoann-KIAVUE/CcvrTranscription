use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Erreur applicative renvoyée au frontend sous forme de chaîne.
pub type DbResult<T> = Result<T, String>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Patient {
    pub id: i64,
    pub nom: String,
    pub date_naissance: Option<String>,
    pub created_at: String,
    /// Nombre de comptes-rendus (rempli lors des listes).
    #[serde(default)]
    pub nb_cr: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompteRendu {
    pub id: i64,
    pub patient_id: i64,
    pub titre: String,
    /// Clé du type de compte-rendu cardiologique (ex. "ett", "ecg", "effort").
    pub type_cr: Option<String>,
    pub date_consultation: String,
    pub texte: String,
    pub audio_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Une version archivée du texte d'un compte-rendu.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrVersion {
    pub id: i64,
    pub compte_rendu_id: i64,
    pub texte: String,
    /// 'transcription' | 'regeneration' | 'edition'
    pub origine: String,
    pub created_at: String,
}

/// Résultat de recherche plein-texte : un CR + le nom du patient.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchHit {
    pub id: i64,
    pub patient_id: i64,
    pub patient_nom: String,
    pub titre: String,
    pub date_consultation: String,
    pub extrait: String,
}

/// Ouvre (ou crée) la base et applique le schéma.
pub fn open(db_path: &Path) -> DbResult<Connection> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| e.to_string())?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| e.to_string())?;
    init_schema(&conn)?;
    Ok(conn)
}

fn init_schema(conn: &Connection) -> DbResult<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS patients (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            nom            TEXT NOT NULL,
            date_naissance TEXT,
            created_at     TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS comptes_rendus (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id        INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            titre             TEXT NOT NULL,
            date_consultation TEXT NOT NULL,
            texte             TEXT NOT NULL DEFAULT '',
            audio_path        TEXT,
            created_at        TEXT NOT NULL,
            updated_at        TEXT NOT NULL,
            type_cr           TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_cr_patient ON comptes_rendus(patient_id);

        CREATE TABLE IF NOT EXISTS cr_versions (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            compte_rendu_id   INTEGER NOT NULL REFERENCES comptes_rendus(id) ON DELETE CASCADE,
            texte             TEXT NOT NULL,
            origine           TEXT NOT NULL,
            created_at        TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_ver_cr ON cr_versions(compte_rendu_id);

        CREATE TABLE IF NOT EXISTS app_config (
            cle    TEXT PRIMARY KEY,
            valeur TEXT NOT NULL
        );
        "#,
    )
    .map_err(|e| e.to_string())?;

    migrate(conn)
}

/// Migrations légères pour les bases créées avant l'ajout de colonnes.
fn migrate(conn: &Connection) -> DbResult<()> {
    let has_type_cr: bool = conn
        .prepare("SELECT 1 FROM pragma_table_info('comptes_rendus') WHERE name = 'type_cr'")
        .and_then(|mut s| s.exists([]))
        .map_err(|e| e.to_string())?;
    if !has_type_cr {
        conn.execute("ALTER TABLE comptes_rendus ADD COLUMN type_cr TEXT", [])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------- Configuration (clé/valeur) ----------

pub fn config_get(conn: &Connection, cle: &str) -> DbResult<Option<String>> {
    conn.query_row(
        "SELECT valeur FROM app_config WHERE cle = ?1",
        params![cle],
        |r| r.get::<_, String>(0),
    )
    .map(Some)
    .or_else(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Ok(None),
        other => Err(other.to_string()),
    })
}

pub fn config_set(conn: &Connection, cle: &str, valeur: &str) -> DbResult<()> {
    conn.execute(
        "INSERT INTO app_config (cle, valeur) VALUES (?1, ?2)
         ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur",
        params![cle, valeur],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

// ---------- Patients ----------

pub fn list_patients(conn: &Connection, query: Option<&str>) -> DbResult<Vec<Patient>> {
    let like = format!("%{}%", query.unwrap_or("").trim());
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.nom, p.date_naissance, p.created_at,
                    (SELECT COUNT(*) FROM comptes_rendus c WHERE c.patient_id = p.id) AS nb
             FROM patients p
             WHERE p.nom LIKE ?1 COLLATE NOCASE
             ORDER BY p.nom COLLATE NOCASE ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![like], |r| {
            Ok(Patient {
                id: r.get(0)?,
                nom: r.get(1)?,
                date_naissance: r.get(2)?,
                created_at: r.get(3)?,
                nb_cr: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn create_patient(
    conn: &Connection,
    nom: &str,
    date_naissance: Option<&str>,
    now: &str,
) -> DbResult<Patient> {
    conn.execute(
        "INSERT INTO patients (nom, date_naissance, created_at) VALUES (?1, ?2, ?3)",
        params![nom, date_naissance, now],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Patient {
        id,
        nom: nom.to_string(),
        date_naissance: date_naissance.map(|s| s.to_string()),
        created_at: now.to_string(),
        nb_cr: 0,
    })
}

pub fn delete_patient(conn: &Connection, id: i64) -> DbResult<()> {
    conn.execute("DELETE FROM patients WHERE id = ?1", params![id])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ---------- Comptes-rendus ----------

fn map_cr(r: &rusqlite::Row) -> rusqlite::Result<CompteRendu> {
    Ok(CompteRendu {
        id: r.get(0)?,
        patient_id: r.get(1)?,
        titre: r.get(2)?,
        date_consultation: r.get(3)?,
        texte: r.get(4)?,
        audio_path: r.get(5)?,
        created_at: r.get(6)?,
        updated_at: r.get(7)?,
        type_cr: r.get(8)?,
    })
}

const CR_COLS: &str =
    "id, patient_id, titre, date_consultation, texte, audio_path, created_at, updated_at, type_cr";

pub fn list_comptes_rendus(conn: &Connection, patient_id: i64) -> DbResult<Vec<CompteRendu>> {
    let sql = format!(
        "SELECT {CR_COLS} FROM comptes_rendus WHERE patient_id = ?1
         ORDER BY date_consultation DESC, id DESC"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![patient_id], map_cr)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn get_compte_rendu(conn: &Connection, id: i64) -> DbResult<CompteRendu> {
    let sql = format!("SELECT {CR_COLS} FROM comptes_rendus WHERE id = ?1");
    conn.query_row(&sql, params![id], map_cr)
        .map_err(|e| e.to_string())
}

#[allow(clippy::too_many_arguments)]
pub fn create_compte_rendu(
    conn: &Connection,
    patient_id: i64,
    titre: &str,
    type_cr: Option<&str>,
    date_consultation: &str,
    texte: &str,
    audio_path: Option<&str>,
    origine: &str,
    now: &str,
) -> DbResult<CompteRendu> {
    conn.execute(
        "INSERT INTO comptes_rendus
            (patient_id, titre, type_cr, date_consultation, texte, audio_path, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        params![patient_id, titre, type_cr, date_consultation, texte, audio_path, now],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    add_version(conn, id, texte, origine, now)?;
    get_compte_rendu(conn, id)
}

#[allow(clippy::too_many_arguments)]
pub fn update_compte_rendu(
    conn: &Connection,
    id: i64,
    titre: &str,
    type_cr: Option<&str>,
    date_consultation: &str,
    texte: &str,
    origine: &str,
    now: &str,
) -> DbResult<CompteRendu> {
    // N'archive une nouvelle version que si le texte a réellement changé.
    let previous: Option<String> = conn
        .query_row(
            "SELECT texte FROM comptes_rendus WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .ok();
    conn.execute(
        "UPDATE comptes_rendus
         SET titre = ?2, type_cr = ?3, date_consultation = ?4, texte = ?5, updated_at = ?6
         WHERE id = ?1",
        params![id, titre, type_cr, date_consultation, texte, now],
    )
    .map_err(|e| e.to_string())?;
    if previous.as_deref() != Some(texte) {
        add_version(conn, id, texte, origine, now)?;
    }
    get_compte_rendu(conn, id)
}

// ---------- Versions / archives ----------

pub fn add_version(
    conn: &Connection,
    compte_rendu_id: i64,
    texte: &str,
    origine: &str,
    now: &str,
) -> DbResult<()> {
    conn.execute(
        "INSERT INTO cr_versions (compte_rendu_id, texte, origine, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![compte_rendu_id, texte, origine, now],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

pub fn list_versions(conn: &Connection, compte_rendu_id: i64) -> DbResult<Vec<CrVersion>> {
    let mut stmt = conn
        .prepare(
            "SELECT id, compte_rendu_id, texte, origine, created_at
             FROM cr_versions WHERE compte_rendu_id = ?1
             ORDER BY id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![compte_rendu_id], |r| {
            Ok(CrVersion {
                id: r.get(0)?,
                compte_rendu_id: r.get(1)?,
                texte: r.get(2)?,
                origine: r.get(3)?,
                created_at: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn rename_compte_rendu(conn: &Connection, id: i64, titre: &str, now: &str) -> DbResult<()> {
    conn.execute(
        "UPDATE comptes_rendus SET titre = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, titre, now],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

pub fn delete_compte_rendu(conn: &Connection, id: i64) -> DbResult<Option<String>> {
    // Récupère le chemin audio pour permettre la suppression du fichier côté appelant.
    let audio: Option<String> = conn
        .query_row(
            "SELECT audio_path FROM comptes_rendus WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .optional_string()?;
    conn.execute("DELETE FROM comptes_rendus WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(audio)
}

/// Recherche plein-texte simple (LIKE) sur le titre et le contenu des CR.
pub fn search_comptes_rendus(conn: &Connection, query: &str) -> DbResult<Vec<SearchHit>> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }
    let like = format!("%{q}%");
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.patient_id, p.nom, c.titre, c.date_consultation, c.texte
             FROM comptes_rendus c
             JOIN patients p ON p.id = c.patient_id
             WHERE c.titre LIKE ?1 COLLATE NOCASE OR c.texte LIKE ?1 COLLATE NOCASE
             ORDER BY c.date_consultation DESC
             LIMIT 100",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![like], |r| {
            let texte: String = r.get(5)?;
            Ok(SearchHit {
                id: r.get(0)?,
                patient_id: r.get(1)?,
                patient_nom: r.get(2)?,
                titre: r.get(3)?,
                date_consultation: r.get(4)?,
                extrait: extrait(&texte, q),
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Construit un court extrait autour de la première occurrence du terme.
/// Travaille sur des indices de *caractères* (jamais d'octets) pour éviter tout
/// risque de découpe au milieu d'un caractère UTF-8 accentué.
fn extrait(texte: &str, terme: &str) -> String {
    let plat: String = texte
        .replace(['\n', '\r'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let chars: Vec<char> = plat.chars().collect();

    // Position (en caractères) de la première occurrence, insensible à la casse.
    let lower = plat.to_lowercase();
    let terme_l = terme.to_lowercase();
    let match_char = lower
        .find(&terme_l)
        .map(|byte_idx| lower[..byte_idx].chars().count())
        .unwrap_or(0)
        .min(chars.len());

    let start = match_char.saturating_sub(40);
    let end = (match_char + 120).min(chars.len());

    let mut s = String::new();
    if start > 0 {
        s.push('…');
    }
    s.push_str(chars[start..end].iter().collect::<String>().trim());
    if end < chars.len() {
        s.push('…');
    }
    s
}

/// Petit utilitaire pour transformer QueryReturnedNoRows en None.
trait OptionalString {
    fn optional_string(self) -> DbResult<Option<String>>;
}
impl OptionalString for rusqlite::Result<Option<String>> {
    fn optional_string(self) -> DbResult<Option<String>> {
        match self {
            Ok(v) => Ok(v),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
}
