# État honnête — v0.1 alpha

## Ce qui marche et a été vérifié

- **Compilation & build desktop** : le frontend (`tsc` + Vite) et le backend
  Rust compilent ; `npm run app:build` produit le bundle macOS (`.app` + `.dmg`).
- **Câblage complet** du pipeline : enregistrement Web Audio → WAV mono 16 kHz →
  commande Tauri `transcribe` → `whisper-rs` → nettoyage → éditeur.
- **Base SQLite**, auth Argon2id, CRUD patients/CR, recherche nom + contenu,
  export PDF + DOCX : implémentés et typés de bout en bout.

## Perfs de transcription — MESURÉES (end-to-end, réel)

Testé le 15/07/2026 avec le modèle **`bofenghuang/whisper-large-v3-french`
quantifié q5_0** (1,08 Go), sur **Apple M5 (10 cœurs)**, via la fonction réelle
`transcribe::run_whisper` (même code que la commande Tauri). Audio de test :
phrase médicale synthétisée (voix Thomas), WAV mono 16 kHz.

- **Qualité : excellente.** Transcription quasi parfaite, y compris le
  vocabulaire médical (« douleur thoracique », « tension artérielle », « bilan
  sanguin », « électrocardiogramme »). Seule divergence : « trois » → « 3 »
  (normalisation numérique) et ponctuation de fin ramenée à des virgules sur un
  débit continu (le nettoyage `cleanup.ts` re-découpe en phrases).
- **Vitesse : ~2× plus rapide que le temps réel.** 13,5 s d'audio traités en
  **6,4 s**, chargement du modèle inclus (whisper.cpp utilise Metal sur macOS).

Ordres de grandeur pour les autres cas :

- Modèle **q5_0** (1,08 Go) : excellent compromis, à recommander par défaut.
- Modèle **full `ggml-model.bin`** (3,1 Go) : un peu plus précis, plus lent.
- Sur un **CPU Windows sans accélération**, large-v3 peut être **plus lent que
  le temps réel** ; un modèle `medium`/`turbo` est alors un bon compromis.
- Le premier appel inclut le **chargement du modèle en mémoire** (~2-3 s pour
  q5_0) — actuellement rechargé à chaque transcription (voir point fragile n°2).

> Reproduire le test :
> `cargo run --release --example transcribe_test -- <modele.bin> <audio.wav>`
> (exemple dans [`src-tauri/examples/transcribe_test.rs`](src-tauri/examples/transcribe_test.rs)).

## Points fragiles / limites connues

1. **Transcription validée hors interface** (exemple `transcribe_test`, voir
   ci-dessus) mais **pas encore via un vrai enregistrement micro dans l'app**
   (le chemin MediaRecorder→WAV→IPC n'a pas été exercé avec une vraie voix). À
   faire en priorité sur la machine du médecin.
2. **Rechargement du modèle à chaque dictée** : `transcribe` recrée le
   `WhisperContext` à chaque appel. Correct mais pas optimal ; à mettre en cache
   dans l'état de l'app (v0.2).
3. **`ScriptProcessorNode`** (Web Audio) est déprécié. Il fonctionne partout
   (WKWebView/WebView2) mais devra passer à un **AudioWorklet** en v0.2.
4. **Éditeur via `document.execCommand`** : déprécié, comportement parfois
   inégal selon le webview. Suffisant pour relire/corriger, à remplacer par un
   vrai éditeur (v0.2).
5. **Audio transmis en tableau de nombres** sur l'IPC Tauri : simple mais lourd
   pour de longues dictées. Envisager un transfert binaire natif en v0.2.
6. **Recherche en `LIKE`** (pas de FTS5) : parfait pour un cabinet, à indexer si
   le volume grossit.
7. **Mot de passe local sans récupération** : hash Argon2id, aucune
   réinitialisation. L'oublier = données verrouillées. Pas de limitation du
   nombre d'essais.
8. **Build Windows non testé ici** (environnement macOS uniquement). La config
   `.msi`/`.exe` est en place mais doit être vérifiée sur une machine Windows
   (WebView2 + Build Tools C++ + CMake requis).
9. **Cible de déploiement macOS = 11.0** (imposée par `std::filesystem` de
   whisper.cpp) : ne fonctionnera pas sous macOS 10.x.
10. **Paragraphage heuristique** (regroupement de phrases) : sans horodatage de
    segments/VAD, le découpage est approximatif.
11. **Pas d'autosave** : le CR doit être enregistré explicitement.

## TODO v0.2 (proposition de priorités)

1. **Valider la transcription réelle** (qualité FR, vocabulaire médical, vitesse)
   avec `bofenghuang/whisper-large-v3-french` converti en ggml.
2. **Cacher le `WhisperContext`** en mémoire (chargement unique).
3. **`initial_prompt` médical** pour guider Whisper (termes, sigles, posologies).
4. **AudioWorklet** + indicateur de niveau plus fidèle, **pause/reprise**.
5. **Autosave** du compte-rendu + brouillons.
6. **Éditeur robuste** (remplacer execCommand).
7. **Transfert audio binaire** natif ; nettoyage des WAV orphelins.
8. **FTS5** pour la recherche de contenu.
9. **Test réel du build Windows** (`.msi`/`.exe`) et signature/notarisation
   macOS pour distribution.
10. **Transcription par segments** avec horodatage pour un meilleur découpage.
