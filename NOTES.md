# État honnête — v0.1 alpha

## Ce qui marche et a été vérifié

- **Compilation & build desktop** : le frontend (`tsc` + Vite) et le backend
  Rust compilent ; `npm run app:build` produit le bundle macOS (`.app` + `.dmg`).
- **Câblage complet** du pipeline : enregistrement Web Audio → WAV mono 16 kHz →
  commande Tauri `transcribe` → `whisper-rs` → nettoyage → éditeur.
- **Base SQLite**, auth Argon2id, CRUD patients/CR, recherche nom + contenu,
  export PDF + DOCX : implémentés et typés de bout en bout.

## Perfs de transcription — mesures réelles manquantes

**Je n'ai pas pu mesurer la qualité/vitesse réelle** : aucun modèle ggml n'était
présent dans l'environnement de build (le modèle est fourni par l'utilisateur,
jamais téléchargé par l'app). Le chemin de code est en place mais n'a pas été
exercé sur de l'audio réel avec un vrai modèle.

Ordres de grandeur **attendus** (à confirmer sur la machine cible) :

- `ggml-large-v3` (~3 Go) sur CPU Apple Silicon : compter **~0,5 à 1,5× la durée
  de l'audio** selon le nombre de cœurs. whisper.cpp active Metal sur macOS, ce
  qui accélère nettement (souvent nettement plus rapide que le temps réel).
- Sur un CPU Windows sans accélération, large-v3 peut être **plus lent que le
  temps réel** ; un modèle `medium` français est un bon compromis vitesse/qualité.
- Le premier appel inclut le **chargement du modèle en mémoire** (quelques
  secondes pour large-v3) — actuellement rechargé à chaque transcription.

## Points fragiles / limites connues

1. **Transcription non testée end-to-end** avec un vrai modèle (voir ci-dessus).
   À valider en priorité sur la machine du médecin.
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
