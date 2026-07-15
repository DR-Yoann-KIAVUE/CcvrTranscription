# Dictée médicale — v0.1 alpha

Application de bureau **100 % locale** de dictée médicale. Le médecin dicte le
compte-rendu d'une consultation ; l'application enregistre l'audio, le transcrit
en français avec **Whisper en local**, produit un compte-rendu propre et
éditable, le classe par patient, permet la recherche, et l'export en **PDF** et
**DOCX**.

> **Aucune donnée ne sort de la machine.** Pas d'API cloud, pas de télémétrie,
> pas d'appel réseau pour la transcription ni le stockage. Ce sont des données
> de santé.

## Stack

| Couche          | Technologie                                            |
| --------------- | ------------------------------------------------------ |
| Empaquetage     | Tauri 2 (macOS `.dmg`, Windows `.msi` / `.exe`)        |
| Frontend        | React 19 + TypeScript + Vite                           |
| Backend         | Rust (côté Tauri)                                      |
| Transcription   | Whisper local via `whisper-rs` (bindings whisper.cpp)  |
| Base de données | SQLite local (`rusqlite`, bundled)                     |
| Mot de passe    | Hash Argon2id (`argon2`), stocké localement            |
| Export          | `docx` (DOCX) + `jspdf` (PDF), côté frontend           |

Les données (base SQLite, fichiers audio, modèle) vivent dans le **dossier de
données de l'application**, sous l'espace utilisateur :

- **macOS** : `~/Library/Application Support/com.drkiavueyoann.dictee/`
- **Windows** : `%APPDATA%\com.drkiavueyoann.dictee\`
- **Linux** : `~/.local/share/com.drkiavueyoann.dictee/`

Sous-dossiers : `dictee.db`, `audio/`, `models/`.

---

## Prérequis

1. **Node.js ≥ 20** et **npm** — <https://nodejs.org>
2. **Rust (stable) + Cargo** — <https://rustup.rs>
3. **CMake** (requis pour compiler whisper.cpp via `whisper-rs`)
   - macOS : `brew install cmake`
   - Windows : installer CMake + « Desktop development with C++ » (Visual Studio Build Tools)
4. **Dépendances système Tauri** — voir <https://tauri.app/start/prerequisites/>
   - macOS : Xcode Command Line Tools (`xcode-select --install`)
   - Windows : WebView2 (préinstallé sur Windows 10/11) + Build Tools C++

### Le modèle Whisper (à fournir, non téléchargé par l'app)

L'application **ne télécharge jamais** de modèle au runtime. Vous placez un
fichier ggml `.bin` vous-même dans le dossier `models/` du dossier de données.

Modèle recommandé (qualité française, priorité du projet) :

- **Whisper large-v3 fine-tuné français** converti en ggml, par ex. depuis
  [`bofenghuang/whisper-large-v3-french`](https://huggingface.co/bofenghuang/whisper-large-v3-french)
  (convertir en ggml avec les scripts de whisper.cpp), nommé de préférence
  `ggml-large-v3-french.bin`.
- **Fallback** : `ggml-large-v3.bin`
  ([modèles ggml officiels whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp)).
  Le français est inclus, un peu moins précis sur le vocabulaire médical.

L'application cherche, dans l'ordre :
`ggml-large-v3-french.bin`, `ggml-large-v3-fr.bin`, `ggml-medium-french.bin`,
`ggml-large-v3.bin`, puis à défaut **le premier `.bin`** trouvé dans `models/`.

**Placer le modèle :**

```bash
# macOS / Linux
./scripts/placer-modele.sh /chemin/vers/ggml-large-v3-french.bin
```

Sous Windows, copiez le `.bin` dans :
`%APPDATA%\com.drkiavueyoann.dictee\models\`

Le chemin exact est aussi affiché dans l'application (bandeau d'avertissement)
si aucun modèle n'est trouvé.

---

## Développement

```bash
npm install          # dépendances frontend + CLI Tauri
npm run app:dev      # lance Vite + la fenêtre Tauri (hot-reload)
```

- `npm run dev` — Vite seul (frontend dans un navigateur, sans backend Tauri).
- `npm run build` — vérifie les types et build le frontend (`dist/`).

Au premier lancement de `app:dev`, Cargo compile whisper.cpp : **comptez
plusieurs minutes**. Les lancements suivants sont rapides.

---

## Build des installeurs

```bash
npm run app:build
```

Les artefacts sont écrits dans `src-tauri/target/release/bundle/` :

- **macOS** : `dmg/Dictée médicale_0.1.0_<arch>.dmg` (+ `.app`)
- **Windows** : `msi/*.msi` et `nsis/*-setup.exe`

> Chaque installeur se produit **sur sa plateforme cible** : le `.dmg` se
> construit sous macOS, le `.msi`/`.exe` sous Windows. (La compilation croisée
> Tauri n'est pas utilisée ici.) Pour Windows, lancez `npm run app:build` sur
> une machine Windows avec les Build Tools C++ + CMake.

Le premier build release est long (LTO + compilation de whisper.cpp).

---

## Utilisation

1. **Connexion** — au premier lancement, créez un mot de passe local (hash
   Argon2id stocké dans la base). Ensuite, il déverrouille l'app.
2. **Bibliothèque** — créez/recherchez un patient ; sélectionnez-le pour voir
   ses comptes-rendus ; recherchez aussi **dans le contenu** de tous les CR.
3. **Nouvelle dictée** — cliquez « Démarrer la dictée » (minuteur + niveau
   sonore), puis « Arrêter ». L'audio est sauvegardé et transcrit en une passe
   par Whisper. Relisez/corrigez dans l'éditeur (gras, titres, listes),
   ajustez titre/date, puis **Enregistrer** et **Télécharger (PDF + DOCX)**.

---

## Modèle de données (SQLite)

- `patients` : `id`, `nom`, `date_naissance` (optionnel), `created_at`
- `comptes_rendus` : `id`, `patient_id` (FK, cascade), `titre`,
  `date_consultation`, `texte` (HTML formaté), `audio_path`, `created_at`,
  `updated_at`
- `app_config` : `cle` / `valeur` (dont `password_hash`)

---

## Pipeline audio → transcription

1. Enregistrement micro via **Web Audio** (pas de MediaRecorder → compatible
   WKWebView/WebView2).
2. Conversion **WAV mono 16 kHz 16 bits** côté frontend
   (`OfflineAudioContext` pour le rééchantillonnage). Pas de dépendance ffmpeg.
3. `save_recording` écrit le WAV dans `audio/`, puis la commande Tauri
   `transcribe(path) → String` appelle `whisper-rs` (langue = `fr`) dans un
   thread bloquant.
4. Le texte est nettoyé (ponctuation + paragraphes) et affiché dans l'éditeur.

---

## Périmètre v0.1 (et hors périmètre)

**Inclus** : enregistrement + minuteur + niveau, transcription Whisper locale,
nettoyage de base, éditeur (gras/titres/listes), patient + date, dossiers par
patient, recherche nom + contenu, tri par date, renommer/supprimer, export
PDF + DOCX, stockage 100 % local, verrouillage par mot de passe.

**Hors périmètre** (non implémenté, volontairement) : email/MSSanté, PDF protégé
par mot de passe, sauvegarde externe automatique, modèles d'en-tête,
dictionnaire médical, comptes cloud/Supabase, multi-utilisateur.

Voir [`NOTES.md`](NOTES.md) pour l'état honnête (perfs, points fragiles, TODO v0.2).
