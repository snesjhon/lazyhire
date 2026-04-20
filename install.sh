#!/bin/bash
set -e

REPO="snesjhon/lazyhire"
GH_BASE="https://github.com/$REPO/releases"

# Require curl
if ! command -v curl &>/dev/null; then
  echo "Error: curl is required but not installed." >&2
  exit 1
fi

echo "Installing lazyhire..."

# Detect platform
OS=$(uname -s)

case "$OS" in
  Darwin*)
    PLATFORM="darwin-arm64"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    PLATFORM="windows-x64"
    ;;
  *)
    echo "Error: Unsupported platform: $OS." >&2
    exit 1
    ;;
esac

# Fetch latest version tag
VERSION=$(curl -fsSL "$GH_BASE/latest/download/latest.txt")

if [ -z "$VERSION" ]; then
  echo "Error: Could not fetch latest version." >&2
  exit 1
fi

# Fetch manifest (contains platform download URLs + SHA256s)
MANIFEST=$(curl -fsSL "$GH_BASE/download/$VERSION/manifest.json")

# Parse manifest for the target platform
if command -v jq &>/dev/null; then
  URL=$(echo "$MANIFEST" | jq -r ".platforms[\"$PLATFORM\"].url")
  CHECKSUM=$(echo "$MANIFEST" | jq -r ".platforms[\"$PLATFORM\"].sha256")
else
  # Minimal bash regex fallback — extract the block for PLATFORM then pull fields
  BLOCK=$(echo "$MANIFEST" | grep -A2 "\"$PLATFORM\"")
  URL=$(echo "$BLOCK" | grep '"url"' | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
  CHECKSUM=$(echo "$BLOCK" | grep '"sha256"' | grep -o '"sha256":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$URL" ] || [ -z "$CHECKSUM" ]; then
  echo "Error: Could not parse manifest for platform $PLATFORM." >&2
  exit 1
fi

# Download binary to a temp file
TMP=$(mktemp)
curl -fsSL "$URL" -o "$TMP"

# Verify SHA256 checksum
if command -v shasum &>/dev/null; then
  echo "$CHECKSUM  $TMP" | shasum -a 256 -c - >/dev/null 2>&1 || { echo "Error: Checksum verification failed." >&2; rm -f "$TMP"; exit 1; }
elif command -v sha256sum &>/dev/null; then
  echo "$CHECKSUM  $TMP" | sha256sum -c - >/dev/null 2>&1 || { echo "Error: Checksum verification failed." >&2; rm -f "$TMP"; exit 1; }
else
  echo "Warning: No checksum tool found, skipping verification." >&2
fi

# Run the binary's own install subcommand (handles PATH setup)
chmod +x "$TMP"
"$TMP" install

# Cleanup temp file
rm -f "$TMP"
