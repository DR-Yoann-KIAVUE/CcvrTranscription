# Distribution & mises à jour automatiques

Ce document explique comment donner l'application à un collègue et comment il
reçoit les mises à jour en cliquant sur un bouton, sans que vous ayez à
renvoyer un `.dmg` à chaque fois.

## Principe

- **Code source** : dépôt **privé** (ex. `soraisv2/ccvr-dictee`). Personne ne le voit.
- **Releases** : dépôt **public** dédié (`soraisv2/ccvr-dictee-releases`) qui ne
  contient **que** les binaires compilés + `latest.json`. Aucune source, aucune
  donnée patient, aucun secret.
- L'app interroge `latest.json` au lancement. Si une version plus récente
  existe, une bannière **« Mise à jour disponible »** apparaît ; un clic sur
  **« Mettre à jour »** télécharge, installe et relance l'app.
- L'installeur (`.dmg`) et chaque mise à jour sont **signés** avec votre clé
  privée (`~/.ccvr/ccvr-updater.key`). L'app vérifie cette signature avec la clé
  publique intégrée : une mise à jour non signée par vous est refusée.

> L'updater est le **seul** accès réseau de l'app. Il ne contacte que le dépôt
> de releases et n'envoie aucune donnée. Les comptes-rendus et l'audio restent
> 100 % locaux.

## Réglage unique (à faire une fois)

1. **Clé de signature** (déjà générée) : `~/.ccvr/ccvr-updater.key`.
   La garder secrète et sauvegardée. Si perdue, les mises à jour ne peuvent plus
   être signées. La clé publique est déjà dans `src-tauri/tauri.conf.json`.
2. **Créer le dépôt public de releases** (une fois) :
   ```bash
   gh repo create soraisv2/ccvr-dictee-releases --public \
     --description "Releases CCVR Dictée (binaires uniquement)"
   ```
   (Aucune source n'y est poussée : seulement les fichiers de release.)

## Donner l'app au collègue (première fois)

1. Construire l'installeur signé :
   ```bash
   ./scripts/make-release.sh
   ```
   → produit `dist-release/CCVR-Dictee_<version>_<arch>.dmg` (+ artefacts update).
2. Envoyer ce `.dmg` au collègue (AirDrop, mail, lien…).
3. Le collègue ouvre le `.dmg` et glisse l'app dans Applications.

> **Gatekeeper macOS** : l'app n'étant pas notariée par Apple, au **premier**
> lancement macOS affiche un avertissement. Le collègue doit faire
> **clic droit sur l'app → Ouvrir → Ouvrir** (une seule fois). Les lancements
> suivants et les mises à jour se font normalement.
> Pour supprimer complètement cet avertissement, il faudrait un compte Apple
> Developer (signature + notarisation) — non requis pour un usage interne.

## Publier une mise à jour

1. **Incrémenter la version** dans `src-tauri/tauri.conf.json` (`"version"`),
   par ex. `0.1.0` → `0.1.1`. (Idéalement aussi dans `package.json`.)
2. Construire et publier :
   ```bash
   ./scripts/make-release.sh --publish
   ```
   Le script build en signé, prépare `latest.json`, et crée la release GitHub
   `v<version>` sur le dépôt public avec le `.dmg`, l'artefact `.app.tar.gz` et
   `latest.json`.
3. C'est tout. Les apps déjà installées détecteront la mise à jour au prochain
   lancement et proposeront **« Mettre à jour »**.

Sans `--publish`, le script prépare seulement `dist-release/` et affiche la
commande `gh release create` à lancer manuellement.

## Côté collègue

- Au lancement, si une version plus récente est publiée : bannière
  **« Mise à jour disponible · Version x.y.z »** en bas à droite.
- Clic sur **« Mettre à jour »** → téléchargement + installation + redémarrage
  automatique. Aucune réinstallation manuelle, aucun nouveau `.dmg` à envoyer.

## Windows

Le même mécanisme fonctionne sous Windows : `make-release.sh` doit être adapté
(artefact `.msi`/`-setup.exe` + `.sig`, plateforme `windows-x86_64`). À faire
lors du premier build Windows. La clé de signature et l'endpoint sont communs.

## Résumé des fichiers d'une release (dépôt public)

- `CCVR-Dictee_<version>_<arch>.dmg` — installeur (première fois)
- `CCVR-Dictee_<version>_<arch>.app.tar.gz` — paquet de mise à jour signé
- `latest.json` — manifeste lu par l'app (version + URL + signature)
