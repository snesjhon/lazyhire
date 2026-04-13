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

# Fetch latest version tag
VERSION=$(curl -fsSL "$GH_BASE/latest/download/latest.txt")

if [ -z "$VERSION" ]; then
  echo "Error: Could not fetch latest version." >&2
  exit 1
fi

# Fetch manifest (contains download URL + SHA256)
MANIFEST=$(curl -fsSL "$GH_BASE/download/$VERSION/manifest.json")

# Parse manifest — use jq if available, fall back to bash regex
if command -v jq &>/dev/null; then
  URL=$(echo "$MANIFEST" | jq -r '.url')
  CHECKSUM=$(echo "$MANIFEST" | jq -r '.sha256')
else
  URL=$(echo "$MANIFEST" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
  CHECKSUM=$(echo "$MANIFEST" | grep -o '"sha256":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$URL" ] || [ -z "$CHECKSUM" ]; then
  echo "Error: Could not parse manifest." >&2
  exit 1
fi

# Download binary to a temp file
TMP=$(mktemp)
curl -fsSL "$URL" -o "$TMP"

# Verify SHA256 checksum
echo "$CHECKSUM  $TMP" | shasum -a 256 -c - >/dev/null 2>&1 || {
  echo "Error: Checksum verification failed." >&2
  rm -f "$TMP"
  exit 1
}

# Run the binary's own install subcommand (handles PATH setup)
chmod +x "$TMP"
"$TMP" install

# Cleanup temp file
rm -f "$TMP"
