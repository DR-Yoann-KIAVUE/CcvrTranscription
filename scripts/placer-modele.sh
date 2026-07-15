#!/usr/bin/env bash
# Copie un modèle Whisper ggml (.bin) dans le dossier de données de l'application.
# Aucun téléchargement réseau n'est effectué : vous fournissez le fichier.
#
# Usage :
#   ./scripts/placer-modele.sh /chemin/vers/ggml-large-v3-french.bin
#
# Le modèle recommandé est un Whisper large-v3 fine-tuné français converti en
# ggml, par ex. depuis bofenghuang/whisper-large-v3-french. À défaut,
# ggml-large-v3.bin fonctionne (français inclus, un peu moins précis sur le
# vocabulaire médical).

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <chemin-du-modele.bin>" >&2
  exit 1
fi

SRC="$1"
if [[ ! -f "$SRC" ]]; then
  echo "Fichier introuvable : $SRC" >&2
  exit 1
fi

# Dossier de données de l'app selon la plateforme (identifier = com.drkiavueyoann.dictee).
IDENT="com.drkiavueyoann.dictee"
case "$(uname -s)" in
  Darwin)
    DEST_DIR="$HOME/Library/Application Support/$IDENT/models"
    ;;
  Linux)
    DEST_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/$IDENT/models"
    ;;
  *)
    echo "Sous Windows, utilisez :" >&2
    echo '  %APPDATA%\'"$IDENT"'\models\' >&2
    exit 1
    ;;
esac

mkdir -p "$DEST_DIR"
BASENAME="$(basename "$SRC")"
echo "Copie de $BASENAME vers :"
echo "  $DEST_DIR"
cp "$SRC" "$DEST_DIR/$BASENAME"
echo "✓ Modèle en place. Relancez l'application."
