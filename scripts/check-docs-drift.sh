#!/usr/bin/env bash
# Fail loudly if any mirrored document in content/docs/ diverges from its
# canonical source in the parent repo's docs/. Skips (with a warning) when the
# parent repo is absent — e.g. a standalone clone or CI.
set -uo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARENT_DOCS="$APP_ROOT/../docs"
MIRROR="$APP_ROOT/content/docs"

if [ ! -d "$PARENT_DOCS" ]; then
  echo "check-docs-drift: parent docs directory not found — skipping drift check" >&2
  exit 0
fi

status=0
for f in "$MIRROR"/0[1-6]-*.md; do
  name="$(basename "$f")"
  if [ ! -f "$PARENT_DOCS/$name" ]; then
    echo "DRIFT: $name has no canonical source in $PARENT_DOCS" >&2
    status=1
  elif ! diff -q "$PARENT_DOCS/$name" "$f" > /dev/null; then
    echo "DRIFT: content/docs/$name differs from docs/$name — run pnpm sync:docs" >&2
    status=1
  fi
done

[ "$status" -eq 0 ] && echo "check-docs-drift: all mirrored docs match their sources"
exit "$status"
