#!/usr/bin/env bash
# Construit une release signée (macOS) et prépare les fichiers à publier pour
# l'auto-update : le .dmg (première installation) + l'artefact updater
# (.app.tar.gz) + latest.json (manifeste lu par l'app).
#
# Prérequis :
#   - Clé de signature updater générée dans ~/.ccvr/ccvr-updater.key
#   - gh (GitHub CLI) connecté si vous utilisez --publish
#
# Usage :
#   ./scripts/make-release.sh            # build + prépare dist-release/
#   ./scripts/make-release.sh --publish  # + crée la release GitHub publique
#
# Dépôt public de releases (endpoint de l'app) :
#   soraisv2/ccvr-dictee-releases

set -euo pipefail
cd "$(dirname "$0")/.."

RELEASES_REPO="soraisv2/ccvr-dictee-releases"
KEY_PATH="$HOME/.ccvr/ccvr-updater.key"
OUT="dist-release"

if [[ ! -f "$KEY_PATH" ]]; then
  echo "Clé de signature introuvable : $KEY_PATH" >&2
  echo "Générez-la : npx tauri signer generate -w \"$KEY_PATH\" -p \"\"" >&2
  exit 1
fi

VERSION=$(node -p "require('./src-tauri/tauri.conf.json').version")
case "$(uname -m)" in
  arm64) ARCH="aarch64" ;;
  x86_64) ARCH="x86_64" ;;
  *) echo "Architecture non gérée: $(uname -m)" >&2; exit 1 ;;
esac
PLATFORM="darwin-$ARCH"
echo "Version $VERSION · $PLATFORM"

# --- Build signé ---
export TAURI_SIGNING_PRIVATE_KEY_PATH="$KEY_PATH"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
echo "Build en cours (peut être long)…"
npm run app:build

# --- Localisation des artefacts ---
BUNDLE="src-tauri/target/release/bundle"
DMG=$(ls "$BUNDLE"/dmg/*.dmg | head -1)
TARGZ=$(ls "$BUNDLE"/macos/*.app.tar.gz | head -1)
SIG=$(ls "$BUNDLE"/macos/*.app.tar.gz.sig | head -1)

if [[ ! -f "$TARGZ" || ! -f "$SIG" ]]; then
  echo "Artefacts updater introuvables (.app.tar.gz / .sig)." >&2
  echo "Vérifiez que createUpdaterArtifacts=true et la clé de signature." >&2
  exit 1
fi

# --- Préparation des fichiers publiables (noms ASCII stables) ---
rm -rf "$OUT"; mkdir -p "$OUT"
DMG_NAME="CCVR-Dictee_${VERSION}_${ARCH}.dmg"
TARGZ_NAME="CCVR-Dictee_${VERSION}_${ARCH}.app.tar.gz"
cp "$DMG" "$OUT/$DMG_NAME"
cp "$TARGZ" "$OUT/$TARGZ_NAME"

SIGNATURE=$(cat "$SIG")
PUBDATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
URL="https://github.com/$RELEASES_REPO/releases/download/v${VERSION}/${TARGZ_NAME}"

cat > "$OUT/latest.json" <<JSON
{
  "version": "${VERSION}",
  "notes": "Mise à jour ${VERSION}",
  "pub_date": "${PUBDATE}",
  "platforms": {
    "${PLATFORM}": {
      "signature": "${SIGNATURE}",
      "url": "${URL}"
    }
  }
}
JSON

echo
echo "Fichiers prêts dans $OUT/ :"
ls -1 "$OUT"
echo

if [[ "${1:-}" == "--publish" ]]; then
  echo "Publication de la release v$VERSION sur $RELEASES_REPO…"
  gh release create "v$VERSION" \
    "$OUT/$DMG_NAME" "$OUT/$TARGZ_NAME" "$OUT/latest.json" \
    --repo "$RELEASES_REPO" \
    --title "v$VERSION" \
    --notes "Mise à jour $VERSION"
  echo "Release publiée. Les apps installées verront la mise à jour."
else
  echo "Pour publier :"
  echo "  gh release create v$VERSION $OUT/$DMG_NAME $OUT/$TARGZ_NAME $OUT/latest.json \\"
  echo "     --repo $RELEASES_REPO --title v$VERSION --notes \"Mise à jour $VERSION\""
fi
