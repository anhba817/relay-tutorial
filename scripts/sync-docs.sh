#!/usr/bin/env bash
# Sync the six chapter-source documents from the parent repo's canonical docs/
# into content/docs/. content/docs/ is machine-written only — never hand-edit.
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARENT_DOCS="$APP_ROOT/../docs"
MIRROR="$APP_ROOT/content/docs"

if [ ! -d "$PARENT_DOCS" ]; then
  echo "sync-docs: parent docs directory not found at $PARENT_DOCS — cannot sync" >&2
  exit 1
fi

mkdir -p "$MIRROR"
for f in "$PARENT_DOCS"/0[1-6]-*.md; do
  cp "$f" "$MIRROR/$(basename "$f")"
  echo "synced $(basename "$f")"
done
